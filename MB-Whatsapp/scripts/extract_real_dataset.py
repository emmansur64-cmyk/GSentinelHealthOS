import argparse
import json
from pathlib import Path
from typing import Any, Dict, List, Set, Tuple


def load_json(path: Path) -> List[Dict[str, Any]]:
    if not path.exists():
        return []
    with path.open('r', encoding='utf-8') as f:
        payload = json.load(f)
    return payload if isinstance(payload, list) else []


def write_json(path: Path, payload: List[Dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open('w', encoding='utf-8') as f:
        json.dump(payload, f, indent=2)


def is_synthetic_incident(record: Dict[str, Any]) -> bool:
    incident = record.get('incident', {}) if isinstance(record, dict) else {}
    result = record.get('result', {}) if isinstance(record, dict) else {}

    incident_id = str(incident.get('id', ''))
    details = str(result.get('details', ''))

    if incident_id.startswith('incident-synth-'):
        return True
    if 'SYNTHETIC_GENERATOR' in details:
        return True
    return False


def split_incidents(incidents: List[Dict[str, Any]]) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]], Set[str], Set[str]]:
    production: List[Dict[str, Any]] = []
    synthetic: List[Dict[str, Any]] = []
    production_ids: Set[str] = set()
    synthetic_ids: Set[str] = set()

    for row in incidents:
        incident = row.get('incident', {}) if isinstance(row, dict) else {}
        incident_id = str(incident.get('id', ''))

        if is_synthetic_incident(row):
            synthetic.append(row)
            if incident_id:
                synthetic_ids.add(incident_id)
        else:
            production.append(row)
            if incident_id:
                production_ids.add(incident_id)

    return production, synthetic, production_ids, synthetic_ids


def split_by_incident_id(
    records: List[Dict[str, Any]],
    production_ids: Set[str],
    synthetic_ids: Set[str],
) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    production: List[Dict[str, Any]] = []
    synthetic: List[Dict[str, Any]] = []

    for row in records:
        incident_id = str(row.get('incidentId', '')) if isinstance(row, dict) else ''

        if incident_id and incident_id in synthetic_ids:
            synthetic.append(row)
            continue
        if incident_id and incident_id in production_ids:
            production.append(row)
            continue

        if incident_id.startswith('incident-synth-'):
            synthetic.append(row)
        else:
            production.append(row)

    return production, synthetic


def build_summary(
    incidents_prod: List[Dict[str, Any]],
    incidents_syn: List[Dict[str, Any]],
    outcomes_prod: List[Dict[str, Any]],
    outcomes_syn: List[Dict[str, Any]],
    audits_prod: List[Dict[str, Any]],
    audits_syn: List[Dict[str, Any]],
) -> Dict[str, Any]:
    return {
        'production': {
            'incidents': len(incidents_prod),
            'outcomes': len(outcomes_prod),
            'audits': len(audits_prod),
        },
        'synthetic': {
            'incidents': len(incidents_syn),
            'outcomes': len(outcomes_syn),
            'audits': len(audits_syn),
        },
    }


def main() -> None:
    parser = argparse.ArgumentParser(
        description='Split data into production and synthetic datasets using incident provenance heuristics.'
    )
    parser.add_argument('--source-dir', default='data', help='Directory containing incidents.json/outcomes.json/audit.json')
    parser.add_argument('--production-dir', default='data/production_dataset', help='Output directory for production dataset')
    parser.add_argument('--synthetic-dir', default='data/synthetic_dataset', help='Output directory for synthetic dataset')
    args = parser.parse_args()

    source_dir = Path(args.source_dir)
    production_dir = Path(args.production_dir)
    synthetic_dir = Path(args.synthetic_dir)

    incidents = load_json(source_dir / 'incidents.json')
    outcomes = load_json(source_dir / 'outcomes.json')
    audits = load_json(source_dir / 'audit.json')

    incidents_prod, incidents_syn, production_ids, synthetic_ids = split_incidents(incidents)
    outcomes_prod, outcomes_syn = split_by_incident_id(outcomes, production_ids, synthetic_ids)
    audits_prod, audits_syn = split_by_incident_id(audits, production_ids, synthetic_ids)

    write_json(production_dir / 'incidents.json', incidents_prod)
    write_json(production_dir / 'outcomes.json', outcomes_prod)
    write_json(production_dir / 'audit.json', audits_prod)

    write_json(synthetic_dir / 'incidents.json', incidents_syn)
    write_json(synthetic_dir / 'outcomes.json', outcomes_syn)
    write_json(synthetic_dir / 'audit.json', audits_syn)

    summary = build_summary(incidents_prod, incidents_syn, outcomes_prod, outcomes_syn, audits_prod, audits_syn)
    with (source_dir / 'dataset_split_summary.json').open('w', encoding='utf-8') as f:
        json.dump(summary, f, indent=2)

    print('Dataset split completed')
    print(f"  Production incidents: {summary['production']['incidents']}")
    print(f"  Synthetic incidents: {summary['synthetic']['incidents']}")
    print(f"  Summary: {(source_dir / 'dataset_split_summary.json').resolve()}")


if __name__ == '__main__':
    main()
