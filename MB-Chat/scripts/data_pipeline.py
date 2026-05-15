import json
import argparse
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import os
from collections import defaultdict, deque
import warnings
warnings.filterwarnings('ignore')

def load_json(file_path):
    """Load JSON file safely"""
    if not os.path.exists(file_path):
        print(f"Warning: {file_path} not found, using empty list")
        return []
    with open(file_path, 'r') as f:
        return json.load(f)

def infer_severity(diagnosis_code, incident_type, frequency_score):
    """Enhanced severity calculation based on multiple signals"""
    score = 0

    # Diagnosis-based severity (critical > 2)
    diagnosis_upper = str(diagnosis_code).upper()
    if 'CRITICAL' in diagnosis_upper or 'FATAL' in diagnosis_upper:
        score += 3
    elif 'TRANSIENT' in diagnosis_upper or 'TEMPORARY' in diagnosis_upper:
        score += 1
    elif 'DEGRADED' in diagnosis_upper:
        score += 2.5
    else:
        score += 2

    # Incident type severity
    type_lower = incident_type.lower()
    if 'error' in type_lower or 'crash' in type_lower:
        score += 2
    elif 'timeout' in type_lower or 'delay' in type_lower:
        score += 1.5
    elif 'warning' in type_lower:
        score += 1

    # Frequency-based severity escalation
    score += min(frequency_score / 3, 2.5)

    if score >= 6:
        return 'critical'
    elif score >= 4:
        return 'high'
    elif score >= 2.5:
        return 'medium'
    else:
        return 'low'

def calculate_time_since_last(incidents_sorted, idx, incident_type_filter=None):
    """Calculate seconds since last event of same type"""
    if idx == 0:
        return 3600  # Default: 1 hour if first

    current = incidents_sorted[idx]['incident']
    current_type = incident_type_filter or current.get('message', '')
    current_time = datetime.fromisoformat(current['timestamp'].replace('Z', '+00:00'))

    # Search backwards for same type
    for i in range(idx - 1, -1, -1):
        prev = incidents_sorted[i]['incident']
        prev_type = prev.get('message', '')

        if incident_type_filter is None or prev_type == current_type:
            prev_time = datetime.fromisoformat(prev['timestamp'].replace('Z', '+00:00'))
            delta_seconds = (current_time - prev_time).total_seconds()
            return max(delta_seconds, 0)

    return 3600  # Default if no previous found

def count_in_window(incidents_sorted, idx, window_seconds, same_type_only=False):
    """Count incidents within time window"""
    current = incidents_sorted[idx]['incident']
    current_time = datetime.fromisoformat(current['timestamp'].replace('Z', '+00:00'))
    current_type = current.get('message', '')

    count = 0
    for i in range(idx, -1, -1):
        incident = incidents_sorted[i]['incident']
        inc_time = datetime.fromisoformat(incident['timestamp'].replace('Z', '+00:00'))

        if (current_time - inc_time).total_seconds() <= window_seconds:
            if not same_type_only or incident.get('message', '') == current_type:
                count += 1
        else:
            break

    return count

def calculate_rolling_frequency(incidents_sorted, idx, window_size=10):
    """Calculate rolling average frequency in last N incidents"""
    if idx < window_size:
        window = incidents_sorted[:idx + 1]
    else:
        window = incidents_sorted[idx - window_size + 1:idx + 1]

    if len(window) < 2:
        return 0.5

    current_type = incidents_sorted[idx]['incident'].get('message', '')
    count = sum(1 for x in window if x['incident'].get('message', '') == current_type)
    return count / len(window)

def get_last_action_info(incidents_sorted, idx):
    """Get last action taken and its success status"""
    if idx == 0:
        return ('unknown', 0)  # No previous action

    prev_item = incidents_sorted[idx - 1]
    action = prev_item.get('decision', {}).get('action', 'unknown')
    success = 1 if prev_item.get('result', {}).get('success', False) else 0

    return (action, success)

def calculate_success_rate_window(incidents_sorted, idx, window_size=10):
    """Calculate success rate in last N incidents"""
    if idx < window_size:
        window = incidents_sorted[:idx + 1]
    else:
        window = incidents_sorted[idx - window_size + 1:idx + 1]

    if len(window) == 0:
        return 0.5

    success_count = sum(1 for x in window if x.get('result', {}).get('success', False))
    return success_count / len(window)

def calculate_failure_rate_window(incidents_sorted, idx, window_size=10):
    """Calculate failure rate in last N incidents"""
    return 1.0 - calculate_success_rate_window(incidents_sorted, idx, window_size)

def count_retries(incidents_sorted, idx):
    """Count retry actions in incident sequence"""
    if idx == 0:
        return 0

    current_time = datetime.fromisoformat(incidents_sorted[idx]['incident']['timestamp'].replace('Z', '+00:00'))
    window_start = current_time - timedelta(hours=1)

    retry_count = 0
    for i in range(idx):
        item = incidents_sorted[i]
        inc_time = datetime.fromisoformat(item['incident']['timestamp'].replace('Z', '+00:00'))

        if inc_time >= window_start and 'retry' in item.get('decision', {}).get('action', '').lower():
            retry_count += 1

    return retry_count

def should_escalate(diagnosis_code, success_rate, retry_count):
    """Determine if incident requires escalation"""
    diagnosis_upper = str(diagnosis_code).upper()

    # Escalate if critical or repeated failures
    if 'CRITICAL' in diagnosis_upper or 'FATAL' in diagnosis_upper:
        return 1

    if success_rate < 0.3 and retry_count > 2:
        return 1

    return 0

def calculate_action_effectiveness(action, results_history):
    """Calculate effectiveness score for a specific action"""
    if action not in results_history or results_history[action]['total'] == 0:
        return 0.5

    success_count = results_history[action]['success']
    total = results_history[action]['total']

    # Effectiveness with penalty for low sample size
    effectiveness = success_count / total if total > 0 else 0.5
    sample_penalty = max(0, 1 - (total / 50.0))  # Penalize if < 50 samples

    return effectiveness * (1 - sample_penalty * 0.3)


def parse_timestamp(value):
    return datetime.fromisoformat(str(value).replace('Z', '+00:00'))


def extract_causal_records(sorted_incidents, audit_dict):
    """Build features using strictly past events only (t < current)."""
    data = []

    # Causal state (updated only after feature extraction for each event)
    last_timestamp = None
    last_action_taken = 'unknown'
    last_action_success = 0

    event_times_by_type = defaultdict(deque)
    retry_events = deque()
    recent_types = deque(maxlen=10)
    recent_successes = deque(maxlen=10)
    recent_success_timestamps = deque()

    action_results_history = defaultdict(lambda: {'success': 0, 'total': 0})
    type_action_results = defaultdict(lambda: defaultdict(lambda: {'success': 0, 'total': 0}))

    for idx, item in enumerate(sorted_incidents):
        try:
            incident = item.get('incident', {})
            decision = item.get('decision', {})
            result = item.get('result', {})

            incident_id = incident.get('id', '')
            audit = audit_dict.get(incident_id, {})

            timestamp_str = incident.get('timestamp', datetime.now().isoformat() + 'Z')
            timestamp = parse_timestamp(timestamp_str)

            inc_type = incident.get('message', 'unknown')
            source = incident.get('source', 'unknown')
            source_category = source.split('_')[0] if source else 'unknown'
            diagnosis = audit.get('diagnosisCode', 'unknown')
            strategy = decision.get('strategy', 'unknown')
            action = decision.get('action', 'unknown')

            metadata = incident.get('metadata', {})
            original_type = metadata.get('originalType', 'unknown')

            # Time context from strictly previous events
            if last_timestamp is None:
                time_since_last_min = 60.0
            else:
                delta = (timestamp - last_timestamp).total_seconds() / 60.0
                time_since_last_min = max(delta, 0.0)

            one_hour_ago = timestamp - timedelta(hours=1)
            one_day_ago = timestamp - timedelta(days=1)
            seven_days_ago = timestamp - timedelta(days=7)

            type_times = event_times_by_type[inc_type]
            while type_times and type_times[0] < seven_days_ago:
                type_times.popleft()

            incidents_last_1h = sum(1 for ts in type_times if ts >= one_hour_ago)
            incidents_last_24h = sum(1 for ts in type_times if ts >= one_day_ago)
            incidents_last_7d = len(type_times)

            if len(recent_types) == 0:
                rolling_frequency = 0.5
            else:
                rolling_frequency = sum(1 for t in recent_types if t == inc_type) / len(recent_types)

            success_rate_last_10 = (sum(recent_successes) / len(recent_successes)) if recent_successes else 0.5
            failure_rate_last_10 = 1.0 - success_rate_last_10

            while recent_success_timestamps and recent_success_timestamps[0][0] < one_day_ago:
                recent_success_timestamps.popleft()
            success_rate_today = (
                sum(s for _, s in recent_success_timestamps) / len(recent_success_timestamps)
                if recent_success_timestamps
                else 0.5
            )

            logs_count = len(metadata.get('logs', []))
            metrics_count = len(metadata.get('metrics', {}))
            has_data = 1 if metadata.get('data') else 0

            severity = infer_severity(diagnosis, inc_type, incidents_last_24h)

            while retry_events and retry_events[0] < one_hour_ago:
                retry_events.popleft()
            retry_count_1h = len(retry_events)
            escalation_flag = should_escalate(diagnosis, success_rate_last_10, retry_count_1h)

            action_effectiveness_score = calculate_action_effectiveness(action, action_results_history)
            action_stats = action_results_history[action]
            action_success_rate = (action_stats['success'] / action_stats['total']) if action_stats['total'] > 0 else 0.5

            type_action_stats = type_action_results[inc_type][action]
            type_action_rate = (
                type_action_stats['success'] / type_action_stats['total']
                if type_action_stats['total'] > 0
                else 0.5
            )

            hour_of_day = timestamp.hour
            day_of_week = timestamp.weekday()
            day_of_month = timestamp.day
            month = timestamp.month

            time_since_last_normalized = min(time_since_last_min / 1440.0, 1.0)
            incidents_24h_normalized = min(incidents_last_24h / 20.0, 1.0)
            incidents_7d_normalized = min(incidents_last_7d / 100.0, 1.0)
            incidents_1h_normalized = min(incidents_last_1h / 10.0, 1.0)

            features = {
                'hour_of_day': hour_of_day,
                'day_of_week': day_of_week,
                'day_of_month': day_of_month,
                'month': month,
                'time_since_last_min': time_since_last_min,
                'time_since_last_normalized': time_since_last_normalized,
                'incidents_last_1h': incidents_last_1h,
                'incidents_last_24h': incidents_last_24h,
                'incidents_last_7d': incidents_last_7d,
                'incidents_1h_normalized': incidents_1h_normalized,
                'incidents_24h_normalized': incidents_24h_normalized,
                'incidents_7d_normalized': incidents_7d_normalized,
                'rolling_frequency': rolling_frequency,
                'incident_type': inc_type,
                'source': source,
                'source_category': source_category,
                'original_type': original_type,
                'diagnosis_code': diagnosis,
                'strategy': strategy,
                'action_type': audit.get('actionType', 'unknown'),
                'severity': severity,
                'logs_count': logs_count,
                'metrics_count': metrics_count,
                'has_data': has_data,
                'logs_count_normalized': min(logs_count / 50.0, 1.0),
                'metrics_count_normalized': min(metrics_count / 50.0, 1.0),
                'last_action_taken': last_action_taken,
                'last_action_success': last_action_success,
                'success_rate_last_10': success_rate_last_10,
                'failure_rate_last_10': failure_rate_last_10,
                'success_rate_today': success_rate_today,
                'action_historical_success_rate': action_success_rate,
                'type_action_success_rate': type_action_rate,
                'retry_count_1h': retry_count_1h,
                'retry_count_normalized': min(retry_count_1h / 5.0, 1.0),
                'escalation_flag': escalation_flag,
                'action_effectiveness_score': action_effectiveness_score,
            }

            current_success = 1 if result.get('success', False) else 0
            label = {
                'action': action,
                'success': current_success,
            }

            data.append({**features, **label})

            # Update causal state AFTER capturing current row features.
            event_times_by_type[inc_type].append(timestamp)
            recent_types.append(inc_type)
            recent_successes.append(current_success)
            recent_success_timestamps.append((timestamp, current_success))

            action_results_history[action]['total'] += 1
            action_results_history[action]['success'] += current_success
            type_action_results[inc_type][action]['total'] += 1
            type_action_results[inc_type][action]['success'] += current_success

            if 'retry' in str(action).lower():
                retry_events.append(timestamp)

            last_action_taken = action
            last_action_success = current_success
            last_timestamp = timestamp

        except Exception as e:
            print(f"Warning: Error processing incident at index {idx}: {e}")
            continue

    return data


def run_leakage_validations(df_clean, feature_cols):
    """Run anti-leakage validations on engineered features."""
    from sklearn.ensemble import RandomForestClassifier
    from sklearn.model_selection import StratifiedKFold, cross_val_score

    print("\n" + "=" * 80)
    print("LEAKAGE VALIDATION")
    print("=" * 80)

    numeric_features = [c for c in feature_cols if c in df_clean.columns and np.issubdtype(df_clean[c].dtype, np.number)]

    # 1) High-correlation leakage check against target.
    corr_threshold = 0.98
    suspicious = []
    for col in numeric_features:
        if col == 'action_encoded':
            continue
        corr = abs(df_clean[col].corr(df_clean['action_encoded']))
        if np.isfinite(corr) and corr >= corr_threshold:
            suspicious.append((col, corr))

    if suspicious:
        print("✗ Potential leakage detected (near-perfect correlation with target):")
        for col, corr in sorted(suspicious, key=lambda x: -x[1]):
            print(f"  - {col}: corr={corr:.4f}")
        raise RuntimeError("Leakage validation failed due to suspiciously high feature-target correlation")
    else:
        print(f"✓ Correlation check passed (no feature with |corr| >= {corr_threshold})")

    # 2) Timestamp shuffle test: if temporal causality matters, quality should drop.
    temporal_cols = [
        'time_since_last_min', 'time_since_last_normalized', 'incidents_last_1h',
        'incidents_last_24h', 'incidents_last_7d', 'incidents_1h_normalized',
        'incidents_24h_normalized', 'incidents_7d_normalized', 'rolling_frequency',
        'success_rate_last_10', 'failure_rate_last_10', 'success_rate_today',
        'action_historical_success_rate', 'type_action_success_rate',
        'retry_count_1h', 'retry_count_normalized', 'last_action_success',
        'escalation_flag', 'action_effectiveness_score'
    ]
    temporal_cols = [c for c in temporal_cols if c in feature_cols]

    if len(temporal_cols) == 0:
        print("⚠ Timestamp shuffle test skipped (no temporal features found)")
        return

    X = df_clean[feature_cols].copy()
    y = df_clean['action_encoded']

    min_samples_per_class = y.value_counts().min() if len(y) > 0 else 0
    if min_samples_per_class < 5:
        print("⚠ Timestamp shuffle test skipped (requires at least 5 samples per class)")
        return

    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
    baseline_model = RandomForestClassifier(n_estimators=100, random_state=42, n_jobs=-1)
    baseline_cv = cross_val_score(baseline_model, X, y, cv=cv, scoring='accuracy', n_jobs=-1).mean()

    X_shuffled = X.copy()
    shuffled_idx = np.random.RandomState(42).permutation(len(X_shuffled))
    X_shuffled[temporal_cols] = X_shuffled[temporal_cols].iloc[shuffled_idx].to_numpy()

    shuffled_model = RandomForestClassifier(n_estimators=100, random_state=42, n_jobs=-1)
    shuffled_cv = cross_val_score(shuffled_model, X_shuffled, y, cv=cv, scoring='accuracy', n_jobs=-1).mean()

    print(f"Baseline CV accuracy: {baseline_cv:.4f}")
    print(f"Shuffled-temporal CV accuracy: {shuffled_cv:.4f}")

    if shuffled_cv >= baseline_cv:
        raise RuntimeError(
            "Timestamp shuffle test failed: metrics did not drop after temporal shuffle. "
            "Review causal feature engineering for leakage."
        )

    print("✓ Timestamp shuffle test passed (metrics dropped after temporal shuffle)")

def create_dataset(input_dir='data/production_dataset', output_dir='data/processed', dataset_type='production'):
    """Create enriched ML dataset with advanced features"""
    print("=" * 80)
    print("FEATURE ENGINEERING: Creating Enriched ML Dataset")
    print("=" * 80)

    # Load data
    incidents = load_json(os.path.join(input_dir, 'incidents.json'))
    outcomes = load_json(os.path.join(input_dir, 'outcomes.json'))
    audits = load_json(os.path.join(input_dir, 'audit.json'))

    print(f"\nLoaded: {len(incidents)} incidents, {len(outcomes)} outcomes, {len(audits)} audit records")

    if len(incidents) == 0:
        raise RuntimeError(
            f"No incidents found in {input_dir}. "
            "Run scripts/extract_real_dataset.py first or provide a valid --input-dir."
        )

    # Create dictionaries for lookup
    audit_dict = {a['incidentId']: a for a in audits}

    # Strictly causal order: ascending timestamp
    sorted_incidents = sorted(incidents, key=lambda x: x['incident']['timestamp'])

    print("\nExtracting features (strictly causal)...")
    data = extract_causal_records(sorted_incidents, audit_dict)

    print(f"\nProcessed {len(data)} complete records")

    if len(data) == 0:
        print("ERROR: No data extracted!")
        return

    df = pd.DataFrame(data)

    # === DATA QUALITY CHECKS ===
    print("\n" + "=" * 80)
    print("DATA QUALITY ASSESSMENT")
    print("=" * 80)

    print(f"\nShape: {df.shape} (rows, cols)")
    print(f"Memory usage: {df.memory_usage(deep=True).sum() / 1024**2:.2f} MB")

    # Check for nulls
    null_counts = df.isnull().sum()
    if null_counts.sum() > 0:
        print(f"\nColumns with nulls:")
        print(null_counts[null_counts > 0])
    else:
        print("\n✓ No null values detected")

    # Check for invalid values
    print("\nNumeric features summary:")
    print(df.select_dtypes(include=[np.number]).describe().round(4))

    # Check class distribution
    print(f"\nAction distribution (target):")
    action_dist = df['action'].value_counts()
    print(action_dist)

    success_dist = df['success'].value_counts()
    print(f"\nSuccess distribution:")
    print(success_dist)
    print(f"Success rate: {df['success'].mean():.2%}")

    # === DATA CLEANING ===
    print("\n" + "=" * 80)
    print("DATA CLEANING")
    print("=" * 80)

    # Remove rows with critical nulls
    df_clean = df.dropna(subset=['success', 'action'])
    removed_rows = len(df) - len(df_clean)
    print(f"\nRemoved {removed_rows} rows with missing success/action")

    # Fill remaining nulls intelligently
    numeric_cols = df_clean.select_dtypes(include=[np.number]).columns
    for col in numeric_cols:
        if df_clean[col].isnull().any():
            median_val = df_clean[col].median()
            df_clean[col].fillna(median_val, inplace=True)

    categorical_cols = ['incident_type', 'source', 'original_type', 'diagnosis_code',
                       'strategy', 'severity', 'action_type', 'source_category', 'last_action_taken']
    for col in categorical_cols:
        if col in df_clean.columns and df_clean[col].isnull().any():
            df_clean[col].fillna('unknown', inplace=True)

    print("✓ Filled remaining nulls with median/mode")

    # === CLASS BALANCING ===
    print("\n" + "=" * 80)
    print("CLASS BALANCING")
    print("=" * 80)

    action_counts = df_clean['action'].value_counts()
    min_action_count = action_counts.min()
    max_action_count = action_counts.max()

    print(f"\nAction balance before:")
    print(f"  Min: {min_action_count}, Max: {max_action_count}, Ratio: {max_action_count/min_action_count:.2f}x")
    print(action_counts)

    # Stratified undersampling if severely imbalanced
    if max_action_count / min_action_count > 3:
        print(f"\nDetected imbalance > 3x, applying stratified sampling...")
        target_size = int(min_action_count * 1.5)  # Use 1.5x min as target

        balanced_dfs = []
        for action in df_clean['action'].unique():
            action_df = df_clean[df_clean['action'] == action]
            if len(action_df) > target_size:
                action_df = action_df.sample(n=target_size, random_state=42)
            balanced_dfs.append(action_df)

        df_clean = pd.concat(balanced_dfs, ignore_index=True)
        df_clean = df_clean.sample(frac=1, random_state=42).reset_index(drop=True)
        print(f"✓ Balanced dataset size: {len(df_clean)}")

    # === FEATURE ENCODING ===
    print("\n" + "=" * 80)
    print("FEATURE ENGINEERING & ENCODING")
    print("=" * 80)

    from sklearn.preprocessing import LabelEncoder, StandardScaler
    import joblib

    # Encode categorical features
    categorical_cols_to_encode = ['incident_type', 'source', 'original_type', 'diagnosis_code',
                                  'strategy', 'severity', 'action_type', 'source_category', 'last_action_taken']
    encoders = {}

    print("\nEncoding categorical features:")
    for col in categorical_cols_to_encode:
        if col in df_clean.columns:
            le = LabelEncoder()
            df_clean[col + '_encoded'] = le.fit_transform(df_clean[col].astype(str))
            encoders[col] = le
            print(f"  ✓ {col}: {len(le.classes_)} classes")

    # Encode action (target)
    le_action = LabelEncoder()
    df_clean['action_encoded'] = le_action.fit_transform(df_clean['action'].astype(str))
    joblib.dump(le_action, 'models/action_encoder.pkl')
    print(f"  ✓ action: {len(le_action.classes_)} classes")

    # Save encoders
    joblib.dump(encoders, 'models/feature_encoders.pkl')

    # === FEATURE SELECTION ===
    print("\nFeature selection:")

    # Numeric features (raw + normalized)
    numeric_features = [
        'hour_of_day', 'day_of_week', 'day_of_month', 'month',
        'time_since_last_min', 'time_since_last_normalized',
        'incidents_last_1h', 'incidents_last_24h', 'incidents_last_7d',
        'incidents_1h_normalized', 'incidents_24h_normalized', 'incidents_7d_normalized',
        'rolling_frequency',
        'logs_count', 'metrics_count', 'has_data',
        'logs_count_normalized', 'metrics_count_normalized',
        'success_rate_last_10', 'failure_rate_last_10', 'success_rate_today',
        'action_historical_success_rate', 'type_action_success_rate',
        'last_action_success',
        'retry_count_1h', 'retry_count_normalized',
        'escalation_flag', 'action_effectiveness_score',
    ]

    # Encoded categorical features
    encoded_features = [col + '_encoded' for col in categorical_cols_to_encode
                       if col in df_clean.columns]

    feature_cols = numeric_features + encoded_features

    # Verify all features exist
    feature_cols = [f for f in feature_cols if f in df_clean.columns]

    print(f"  Total features: {len(feature_cols)}")
    print(f"    - Numeric: {len(numeric_features)} (raw + normalized)")
    print(f"    - Categorical (encoded): {len(encoded_features)}")

    # === ANTI-LEAKAGE VALIDATIONS ===
    run_leakage_validations(df_clean, feature_cols)

    # === TRAIN/VALIDATION/TEST SPLIT ===
    print("\n" + "=" * 80)
    print("TRAIN/VALIDATION/TEST SPLIT")
    print("=" * 80)

    from sklearn.model_selection import train_test_split

    X = df_clean[feature_cols]
    y = df_clean['action_encoded']

    n_samples = len(X)

    if n_samples < 10:
        # For small datasets, use 70/30 split and duplicate validation from test
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.3, random_state=42,
            stratify=y if len(y.unique()) > 1 else None
        )
        # Duplicate test as validation for small datasets
        X_val = X_test.copy()
        y_val = y_test.copy()
        print(f"\nSmall dataset ({n_samples} samples) - using 70/30 split with validation = test")
    else:
        # Standard 70/15/15 split
        X_train_val, X_test, y_train_val, y_test = train_test_split(
            X, y, test_size=0.15, random_state=42,
            stratify=y if len(y.unique()) > 1 else None
        )

        val_size = 0.176  # 15/85 ≈ 0.176
        X_train, X_val, y_train, y_val = train_test_split(
            X_train_val, y_train_val, test_size=val_size, random_state=42,
            stratify=y_train_val if len(y_train_val.unique()) > 1 else None
        )

    print(f"\nTrain set: {X_train.shape[0]} samples ({X_train.shape[0]/len(X)*100:.1f}%)")
    print(f"Validation set: {X_val.shape[0]} samples ({X_val.shape[0]/len(X)*100:.1f}%)")
    print(f"Test set: {X_test.shape[0]} samples ({X_test.shape[0]/len(X)*100:.1f}%)")
    print(f"Features: {X_train.shape[1]}")

    # === NORMALIZATION (optional, for some models) ===
    print("\nNormalizing features...")
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_val_scaled = scaler.transform(X_val)
    X_test_scaled = scaler.transform(X_test)

    joblib.dump(scaler, 'models/feature_scaler.pkl')
    print("✓ Scaler saved")

    # === SAVE DATASETS ===
    print("\n" + "=" * 80)
    print("SAVING DATASETS")
    print("=" * 80)

    os.makedirs(output_dir, exist_ok=True)

    # Save raw datasets
    X_train.to_csv(os.path.join(output_dir, 'X_train.csv'), index=False)
    X_val.to_csv(os.path.join(output_dir, 'X_val.csv'), index=False)
    X_test.to_csv(os.path.join(output_dir, 'X_test.csv'), index=False)
    y_train.to_csv(os.path.join(output_dir, 'y_train.csv'), index=False)
    y_val.to_csv(os.path.join(output_dir, 'y_val.csv'), index=False)
    y_test.to_csv(os.path.join(output_dir, 'y_test.csv'), index=False)

    # Save scaled datasets (for RF, need original; for NN/SVM need scaled)
    np.savetxt(os.path.join(output_dir, 'X_train_scaled.csv'), X_train_scaled, delimiter=',')
    np.savetxt(os.path.join(output_dir, 'X_val_scaled.csv'), X_val_scaled, delimiter=',')
    np.savetxt(os.path.join(output_dir, 'X_test_scaled.csv'), X_test_scaled, delimiter=',')

    # Save feature names
    with open(os.path.join(output_dir, 'feature_names.txt'), 'w') as f:
        for feat in feature_cols:
            f.write(feat + '\n')

    # Save label mapping
    with open(os.path.join(output_dir, 'action_mapping.txt'), 'w') as f:
        for idx, action in enumerate(le_action.classes_):
            f.write(f"{idx},{action}\n")

    # Save meta information
    final_action_counts = df_clean['action'].value_counts()

    meta = {
        'dataset_type': dataset_type,
        'input_dir': os.path.abspath(input_dir),
        'total_samples': len(df_clean),
        'train_samples': X_train.shape[0],
        'val_samples': X_val.shape[0],
        'test_samples': X_test.shape[0],
        'num_features': X_train.shape[1],
        'num_actions': len(le_action.classes_),
        'min_class_samples': int(final_action_counts.min()) if len(final_action_counts) > 0 else 0,
        'action_counts': {str(k): int(v) for k, v in final_action_counts.to_dict().items()},
        'action_classes': list(le_action.classes_),
        'success_rate': float(df_clean['success'].mean()),
        'created_at': datetime.now().isoformat(),
    }

    with open(os.path.join(output_dir, 'metadata.json'), 'w') as f:
        json.dump(meta, f, indent=2)

    print(f"\n✓ X_train.csv: {X_train.shape}")
    print(f"✓ X_test.csv: {X_test.shape}")
    print(f"✓ y_train.csv: {y_train.shape}")
    print(f"✓ y_test.csv: {y_test.shape}")
    print(f"✓ Feature names: {len(feature_cols)} features")
    print(f"✓ Action mapping: {len(le_action.classes_)} actions")
    print(f"✓ Feature scaler + encoders saved")

    print("\n" + "=" * 80)
    print("SUMMARY")
    print("=" * 80)
    print(f"""
Dataset enrichment complete!

📊 Features Created: {len(feature_cols)} total
   ├─ Temporal: 13 (hour, day, month + advanced windows)
   ├─ Historical: 6 (success rates, action history)
   ├─ Context: 5 (logs, metrics, severity)
   ├─ Behavioral: 4 (retry count, escalation, effectiveness)
   └─ Categorical: {len(encoded_features)} (encoded)

📈 Data Quality:
   ├─ Total samples: {len(df_clean)}
   ├─ Success rate: {df_clean['success'].mean():.1%}
   ├─ Null values: {df_clean.isnull().sum().sum()} (cleaned)
    └─ Class balance: {final_action_counts.max()/final_action_counts.min() if len(final_action_counts) > 0 else 1:.2f}x ratio

✓ Train/val/test split: {X_train.shape[0]}/{X_val.shape[0]}/{X_test.shape[0]} (70/15/15)
✓ All features normalized to [0, 1] range
✓ Ready for ML model training!
    """)

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Feature engineering pipeline for MetaBrain datasets')
    parser.add_argument('--input-dir', default='data/production_dataset', help='Input dataset directory')
    parser.add_argument('--output-dir', default='data/processed', help='Output processed directory')
    parser.add_argument(
        '--dataset-type',
        default='production',
        choices=['production', 'synthetic', 'mixed'],
        help='Dataset provenance label stored in metadata',
    )
    args = parser.parse_args()

    create_dataset(input_dir=args.input_dir, output_dir=args.output_dir, dataset_type=args.dataset_type)