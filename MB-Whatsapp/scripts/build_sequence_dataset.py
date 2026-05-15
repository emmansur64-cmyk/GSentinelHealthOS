from __future__ import annotations

import argparse
import json
from collections import deque
from pathlib import Path
from typing import Any, Deque

import numpy as np


FEATURE_COLUMNS = [
    'event_type_encoded',
    'source_hash',
    'action_hash',
    'diagnosis_hash',
    'message_hash',
    'severity_score',
    'status_score',
    'outcome_score',
    'hour_of_day',
    'day_of_week',
    'time_since_prev_min',
    'relative_time_min',
    'frequency_1h',
    'frequency_24h',
    'frequency_7d',
    'retry_count',
    'logs_count',
    'metrics_count',
    'latency_ms',
    'errors_last_5m',
    'cpu_usage',
    'memory_usage',
    'success_rate_last_10',
    'failure_rate_last_10',
    'audit_failure_rate_last_10',
    'metadata_size',
]

EVENT_TYPE_MAP = {
    'incident': 0.0,
    'outcome': 1.0,
    'audit': 2.0,
}

STATUS_SCORE_MAP = {
    'SUCCESS': 0.0,
    'FAILED': 1.0,
    'BLOCKED': 0.75,
}

OUTCOME_SCORE_MAP = {
    'success': 0.0,
    'failure': 1.0,
    'blocked': 0.75,
    'simulated': 0.25,
}


def load_json(path: Path) -> list[dict[str, Any]]:
    with path.open('r', encoding='utf-8') as handle:
        data = json.load(handle)
    if not isinstance(data, list):
        raise ValueError(f'Expected a list in {path}')
    return data


def hash_token(value: Any) -> float:
    text = str(value or '')
    hashed = 0
    for char in text:
        hashed = ((hashed * 31) + ord(char)) & 0xFFFFFFFF
    return float(hashed % 1000) / 1000.0


def as_number(value: Any, fallback: float = 0.0) -> float:
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        try:
            return float(value)
        except ValueError:
            return fallback
    return fallback


def infer_severity_score(message: str, severity_raw: str) -> float:
    severity = str(severity_raw or '').lower()
    if severity == 'critical':
        return 1.0
    if severity == 'high':
        return 0.75
    if severity == 'medium':
        return 0.5
    if severity == 'low':
        return 0.25

    msg = message.lower()
    if 'critical' in msg or 'panic' in msg or 'security' in msg:
        return 1.0
    if 'error' in msg or 'failed' in msg or 'crash' in msg:
        return 0.75
    if 'warn' in msg or 'degraded' in msg or 'timeout' in msg:
        return 0.5
    return 0.25


def normalize_timestamp(timestamp: str) -> np.datetime64:
    return np.datetime64(timestamp.replace('Z', '+00:00'))


def is_abnormal_incident(
    event: dict[str, Any],
    retry_threshold: float,
    frequency_threshold: float,
) -> bool:
    severity_score = float(event['severity_score'])
    retry_count = float(event['retry_count'])
    freq_1h = float(event['frequency_1h'])
    message = str(event.get('message', '')).lower()
    return (
        severity_score >= 1.0
        or retry_count > retry_threshold
        or freq_1h > frequency_threshold
        or 'panic' in message
        or 'security' in message
    )


def to_incident_event(
    record: dict[str, Any],
    retry_threshold: float,
    frequency_threshold: float,
) -> dict[str, Any]:
    incident = record.get('incident', {})
    metadata = incident.get('metadata', {}) or {}
    data = metadata.get('data', {}) or {}
    metrics = metadata.get('metrics', {}) or {}
    logs = metadata.get('logs', []) if isinstance(metadata.get('logs', []), list) else []

    event = {
        'event_id': f"incident:{incident.get('id', 'unknown')}",
        'incident_id': incident.get('id', ''),
        'event_type': 'incident',
        'timestamp': incident.get('timestamp', record.get('storedAt')),
        'source': incident.get('source', 'unknown'),
        'message': incident.get('message', ''),
        'action': '',
        'diagnosis_code': str(metadata.get('originalType', 'unknown')),
        'severity_score': infer_severity_score(
            str(incident.get('message', '')),
            str(data.get('severity', '')),
        ),
        'status_score': 0.0,
        'outcome_score': 0.0,
        'frequency_1h': as_number(data.get('frequency_1h')),
        'frequency_24h': as_number(data.get('frequency_24h')),
        'frequency_7d': as_number(data.get('frequency_7d')),
        'retry_count': as_number(data.get('retry_count')),
        'logs_count': float(len(logs)),
        'metrics_count': float(len(metrics)),
        'latency_ms': as_number(metrics.get('latency_ms')),
        'errors_last_5m': as_number(metrics.get('errors_last_5m')),
        'cpu_usage': as_number(metrics.get('cpu')),
        'memory_usage': as_number(metrics.get('memory')),
        'metadata_size': float(len(metadata)),
    }
    event['is_abnormal'] = is_abnormal_incident(event, retry_threshold, frequency_threshold)
    return event


def to_outcome_event(record: dict[str, Any], incident_index: dict[str, dict[str, Any]]) -> dict[str, Any]:
    incident_record = incident_index.get(str(record.get('incidentId', '')))
    incident = incident_record.get('incident', {}) if incident_record else {}
    outcome = str(record.get('outcome', 'success')).lower()
    return {
        'event_id': f"outcome:{record.get('incidentId', 'unknown')}",
        'incident_id': str(record.get('incidentId', '')),
        'event_type': 'outcome',
        'timestamp': record.get('recordedAt'),
        'source': incident.get('source', 'unknown'),
        'message': outcome,
        'action': str(record.get('action', '')),
        'diagnosis_code': '',
        'severity_score': 0.0,
        'status_score': 0.0,
        'outcome_score': OUTCOME_SCORE_MAP.get(outcome, 0.5),
        'frequency_1h': 0.0,
        'frequency_24h': 0.0,
        'frequency_7d': 0.0,
        'retry_count': 0.0,
        'logs_count': 0.0,
        'metrics_count': 0.0,
        'latency_ms': 0.0,
        'errors_last_5m': 0.0,
        'cpu_usage': 0.0,
        'memory_usage': 0.0,
        'metadata_size': 0.0,
        'is_abnormal': outcome in {'failure', 'blocked'},
    }


def to_audit_event(record: dict[str, Any]) -> dict[str, Any]:
    status = str(record.get('status', 'SUCCESS')).upper()
    return {
        'event_id': f"audit:{record.get('incidentId', 'unknown')}",
        'incident_id': str(record.get('incidentId', '')),
        'event_type': 'audit',
        'timestamp': record.get('createdAt'),
        'source': str(record.get('source', 'unknown')),
        'message': str(record.get('decisionAction', '')),
        'action': str(record.get('decisionAction', '')),
        'diagnosis_code': str(record.get('diagnosisCode', '')),
        'severity_score': 0.0,
        'status_score': STATUS_SCORE_MAP.get(status, 0.0),
        'outcome_score': 0.0,
        'frequency_1h': 0.0,
        'frequency_24h': 0.0,
        'frequency_7d': 0.0,
        'retry_count': 0.0,
        'logs_count': 0.0,
        'metrics_count': 0.0,
        'latency_ms': 0.0,
        'errors_last_5m': 0.0,
        'cpu_usage': 0.0,
        'memory_usage': 0.0,
        'metadata_size': 0.0,
        'is_abnormal': status in {'FAILED', 'BLOCKED'},
    }


def build_timeline(data_dir: Path) -> list[dict[str, Any]]:
    incidents = load_json(data_dir / 'incidents.json')
    outcomes = load_json(data_dir / 'outcomes.json')
    audits = load_json(data_dir / 'audit.json')

    incident_freq_values = [
        as_number(
            ((item.get('incident', {}) or {}).get('metadata', {}) or {}).get('data', {}).get('frequency_1h')
        )
        for item in incidents
    ]
    incident_retry_values = [
        as_number(
            ((item.get('incident', {}) or {}).get('metadata', {}) or {}).get('data', {}).get('retry_count')
        )
        for item in incidents
    ]
    frequency_threshold = max(8.0, float(np.quantile(np.asarray(incident_freq_values, dtype=np.float32), 0.95)))
    retry_threshold = max(5.0, float(np.quantile(np.asarray(incident_retry_values, dtype=np.float32), 0.95)))

    incident_index = {
        str(item.get('incident', {}).get('id', '')): item
        for item in incidents
        if item.get('incident', {}).get('id')
    }

    events: list[dict[str, Any]] = []
    events.extend(
        to_incident_event(item, retry_threshold=retry_threshold, frequency_threshold=frequency_threshold)
        for item in incidents
    )
    events.extend(to_outcome_event(item, incident_index) for item in outcomes)
    events.extend(to_audit_event(item) for item in audits)

    filtered = [event for event in events if event.get('timestamp')]
    filtered.sort(key=lambda item: item['timestamp'])
    return filtered


def compute_context(prior_events: Deque[dict[str, Any]]) -> dict[str, float]:
    if not prior_events:
        return {
            'success_rate_last_10': 0.0,
            'failure_rate_last_10': 0.0,
            'audit_failure_rate_last_10': 0.0,
        }

    outcome_events = [event for event in prior_events if event['event_type'] == 'outcome']
    audit_events = [event for event in prior_events if event['event_type'] == 'audit']
    success_count = sum(1 for event in outcome_events if event['outcome_score'] == 0.0)
    failure_count = sum(1 for event in outcome_events if event['outcome_score'] >= 0.75)
    audit_failures = sum(1 for event in audit_events if event['status_score'] >= 0.75)

    return {
        'success_rate_last_10': success_count / max(1, len(outcome_events)),
        'failure_rate_last_10': failure_count / max(1, len(outcome_events)),
        'audit_failure_rate_last_10': audit_failures / max(1, len(audit_events)),
    }


def encode_event(
    event: dict[str, Any],
    prev_timestamp: np.datetime64,
    window_start: np.datetime64,
    context: dict[str, float],
) -> list[float]:
    event_timestamp = normalize_timestamp(str(event['timestamp']))
    hour_of_day = float(str(event_timestamp).split('T')[1][0:2]) if 'T' in str(event_timestamp) else 0.0
    day_of_week = float((event_timestamp.astype('datetime64[D]').astype(int) + 3) % 7)
    time_since_prev_min = max(0.0, float((event_timestamp - prev_timestamp) / np.timedelta64(1, 'm')))
    relative_time_min = max(0.0, float((event_timestamp - window_start) / np.timedelta64(1, 'm')))

    feature_map = {
        'event_type_encoded': EVENT_TYPE_MAP.get(str(event['event_type']), 0.0),
        'source_hash': hash_token(event.get('source', '')),
        'action_hash': hash_token(event.get('action', '')),
        'diagnosis_hash': hash_token(event.get('diagnosis_code', '')),
        'message_hash': hash_token(event.get('message', '')),
        'severity_score': float(event.get('severity_score', 0.0)),
        'status_score': float(event.get('status_score', 0.0)),
        'outcome_score': float(event.get('outcome_score', 0.0)),
        'hour_of_day': hour_of_day,
        'day_of_week': day_of_week,
        'time_since_prev_min': time_since_prev_min,
        'relative_time_min': relative_time_min,
        'frequency_1h': float(event.get('frequency_1h', 0.0)),
        'frequency_24h': float(event.get('frequency_24h', 0.0)),
        'frequency_7d': float(event.get('frequency_7d', 0.0)),
        'retry_count': float(event.get('retry_count', 0.0)),
        'logs_count': float(event.get('logs_count', 0.0)),
        'metrics_count': float(event.get('metrics_count', 0.0)),
        'latency_ms': float(event.get('latency_ms', 0.0)),
        'errors_last_5m': float(event.get('errors_last_5m', 0.0)),
        'cpu_usage': float(event.get('cpu_usage', 0.0)),
        'memory_usage': float(event.get('memory_usage', 0.0)),
        'success_rate_last_10': context['success_rate_last_10'],
        'failure_rate_last_10': context['failure_rate_last_10'],
        'audit_failure_rate_last_10': context['audit_failure_rate_last_10'],
        'metadata_size': float(event.get('metadata_size', 0.0)),
    }
    return [float(feature_map[column]) for column in FEATURE_COLUMNS]


def build_windows(events: list[dict[str, Any]], sequence_length: int) -> tuple[np.ndarray, np.ndarray, list[list[str]]]:
    sequences: list[np.ndarray] = []
    normal_mask: list[bool] = []
    sequence_ids: list[list[str]] = []

    for end in range(sequence_length, len(events) + 1):
        window = events[end - sequence_length : end]
        encoded_rows: list[list[float]] = []
        prior_context: Deque[dict[str, Any]] = deque(maxlen=10)
        window_start = normalize_timestamp(str(window[0]['timestamp']))
        prev_ts = window_start

        for event in window:
            context = compute_context(prior_context)
            encoded_rows.append(encode_event(event, prev_ts, window_start, context))
            prior_context.append(event)
            prev_ts = normalize_timestamp(str(event['timestamp']))

        sequences.append(np.asarray(encoded_rows, dtype=np.float32))

        abnormal_count = sum(1 for event in window if bool(event['is_abnormal']))
        abnormal_ratio = abnormal_count / float(len(window))
        has_critical_incident = any(
            event['event_type'] == 'incident' and float(event['severity_score']) >= 1.0
            for event in window
        )
        tail_abnormal = bool(window[-1]['is_abnormal'])
        is_normal_sequence = (
            not has_critical_incident
            and abnormal_ratio < 0.35
            and not (tail_abnormal and abnormal_ratio >= 0.2)
        )
        normal_mask.append(is_normal_sequence)
        sequence_ids.append([str(event['event_id']) for event in window])

    if not sequences:
        raise ValueError('Not enough events to create sequential windows')

    return np.stack(sequences), np.asarray(normal_mask, dtype=np.bool_), sequence_ids


def save_outputs(
    output_dir: Path,
    sequences: np.ndarray,
    normal_mask: np.ndarray,
    sequence_ids: list[list[str]],
    sequence_length: int,
) -> None:
    output_dir.mkdir(parents=True, exist_ok=True)
    np.save(output_dir / 'X_sequences.npy', sequences)
    np.save(output_dir / 'normal_mask.npy', normal_mask)
    np.save(output_dir / 'anomaly_mask.npy', ~normal_mask)

    metadata = {
        'sequence_length': sequence_length,
        'feature_columns': FEATURE_COLUMNS,
        'num_sequences': int(sequences.shape[0]),
        'num_features': int(sequences.shape[2]),
        'normal_sequences': int(np.sum(normal_mask)),
        'anomalous_sequences': int(np.sum(~normal_mask)),
        'event_sources': ['incidents', 'outcomes', 'audit', 'memory-incidents'],
        'sequence_event_ids_path': 'sequence_event_ids.json',
    }

    with (output_dir / 'sequence_metadata.json').open('w', encoding='utf-8') as handle:
        json.dump(metadata, handle, indent=2)

    with (output_dir / 'sequence_event_ids.json').open('w', encoding='utf-8') as handle:
        json.dump(sequence_ids, handle, indent=2)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description='Build sequential anomaly dataset from system events')
    parser.add_argument('--data-dir', default='data', help='Directory with incidents.json, outcomes.json and audit.json')
    parser.add_argument('--output-dir', default='data/processed', help='Directory to write X_sequences.npy and metadata')
    parser.add_argument('--sequence-length', type=int, default=10, help='Sliding window length')
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    events = build_timeline(Path(args.data_dir))
    sequences, normal_mask, sequence_ids = build_windows(events, max(2, args.sequence_length))
    save_outputs(Path(args.output_dir), sequences, normal_mask, sequence_ids, max(2, args.sequence_length))
    print(
        json.dumps(
            {
                'num_events': len(events),
                'num_sequences': int(sequences.shape[0]),
                'normal_sequences': int(np.sum(normal_mask)),
                'anomalous_sequences': int(np.sum(~normal_mask)),
                'output': str(Path(args.output_dir) / 'X_sequences.npy'),
            },
            indent=2,
        )
    )


if __name__ == '__main__':
    main()