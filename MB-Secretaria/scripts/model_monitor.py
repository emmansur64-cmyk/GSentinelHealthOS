"""
Model Degradation Monitoring Service
Real-time detection of model performance degradation in production
"""

import json
import os
from datetime import datetime, timedelta
from dataclasses import dataclass
from typing import Optional, Dict, List
import numpy as np

@dataclass
class ModelDeployment:
    """Track deployed model version and metrics"""
    version: str
    deployment_time: datetime
    test_accuracy: float
    overfitting_score: float
    cv_mean: float
    num_test_samples: int

@dataclass
class PerformanceAlert:
    """Alert triggered by performance degradation"""
    severity: str  # INFO, WARNING, CRITICAL
    metric: str
    current_value: float
    threshold: float
    message: str
    timestamp: datetime

class ModelDegradationMonitor:
    """Monitor model performance and detect degradation patterns"""

    def __init__(self, baseline_metrics_file='models/model_metrics.json'):
        self.baseline_file = baseline_metrics_file
        self.alert_history: List[PerformanceAlert] = []
        self.baseline_metrics = self._load_baseline()

    def _load_baseline(self) -> Optional[Dict]:
        """Load baseline metrics from last training"""
        if not os.path.exists(self.baseline_file):
            return None

        try:
            with open(self.baseline_file, 'r') as f:
                return json.load(f)
        except Exception as e:
            print(f"Error loading baseline metrics: {e}")
            return None

    def check_accuracy_degradation(self, current_accuracy: float,
                                   degradation_threshold: float = 0.10) -> Optional[PerformanceAlert]:
        """
        Check if accuracy has degraded significantly
        degradation_threshold: acceptable drop (default 10%)
        """
        if not self.baseline_metrics:
            return None

        baseline_acc = self.baseline_metrics.get('test_accuracy', 0.5)
        drop = baseline_acc - current_accuracy
        drop_pct = (drop / baseline_acc) * 100 if baseline_acc > 0 else 0

        if drop > degradation_threshold:
            alert = PerformanceAlert(
                severity='CRITICAL',
                metric='accuracy',
                current_value=current_accuracy,
                threshold=baseline_acc - degradation_threshold,
                message=f'Accuracy degraded {drop_pct:.1f}% from {baseline_acc:.4f} to {current_accuracy:.4f}',
                timestamp=datetime.now()
            )
            self.alert_history.append(alert)
            return alert

        elif drop > degradation_threshold * 0.5:
            alert = PerformanceAlert(
                severity='WARNING',
                metric='accuracy',
                current_value=current_accuracy,
                threshold=baseline_acc - (degradation_threshold * 0.5),
                message=f'Accuracy trending down {drop_pct:.1f}% - monitor closely',
                timestamp=datetime.now()
            )
            self.alert_history.append(alert)
            return alert

        return None

    def check_overfitting_increase(self, current_overfit: float) -> Optional[PerformanceAlert]:
        """
        Check if overfitting has increased significantly
        Compare against baseline overfitting score
        """
        if not self.baseline_metrics:
            return None

        baseline_overfit = self.baseline_metrics.get('overfitting_score', 0)
        increase = current_overfit - baseline_overfit

        # Alert if overfitting increased by more than 0.15 (15 percentage points)
        if increase > 0.15:
            alert = PerformanceAlert(
                severity='WARNING',
                metric='overfitting',
                current_value=current_overfit,
                threshold=baseline_overfit + 0.15,
                message=f'Overfitting increased from {baseline_overfit:.4f} to {current_overfit:.4f}',
                timestamp=datetime.now()
            )
            self.alert_history.append(alert)
            return alert

        return None

    def check_data_distribution_shift(self, recent_predictions: List[int],
                                     expected_distribution: Dict[int, float]) -> Optional[PerformanceAlert]:
        """
        Detect if input data distribution has shifted
        expected_distribution: {class: frequency} from training set
        """
        if not recent_predictions or len(recent_predictions) < 10:
            return None  # Need minimum samples for statistical significance

        # Calculate actual distribution
        actual_dist = {}
        total = len(recent_predictions)
        for cls in expected_distribution.keys():
            count = sum(1 for p in recent_predictions if p == cls)
            actual_dist[cls] = count / total

        # Calculate Jensen-Shannon divergence (simplified KL divergence check)
        divergence = 0
        for cls, expected_freq in expected_distribution.items():
            actual_freq = actual_dist.get(cls, 0)
            if expected_freq > 0:
                divergence += abs(expected_freq - actual_freq) / expected_freq

        if divergence > 0.3:  # >30% distribution change
            alert = PerformanceAlert(
                severity='WARNING',
                metric='data_distribution',
                current_value=divergence,
                threshold=0.3,
                message=f'Data distribution shifted (divergence: {divergence:.3f}). Expected: {expected_distribution}, Actual: {actual_dist}',
                timestamp=datetime.now()
            )
            self.alert_history.append(alert)
            return alert

        return None

    def check_training_data_quality(self, num_samples: int,
                                   min_samples_per_class: int = 10) -> Optional[PerformanceAlert]:
        """Check if training data quality is sufficient"""
        if num_samples < 50:
            alert = PerformanceAlert(
                severity='INFO',
                metric='training_data',
                current_value=num_samples,
                threshold=50,
                message=f'Low training data volume: {num_samples} samples. Minimum 50 recommended.',
                timestamp=datetime.now()
            )
            self.alert_history.append(alert)
            return alert

        return None

    def check_model_staleness(self, last_training_time: datetime,
                             max_age_days: int = 30) -> Optional[PerformanceAlert]:
        """Check if model is too old and needs retraining"""
        age_days = (datetime.now() - last_training_time).days

        if age_days > max_age_days:
            alert = PerformanceAlert(
                severity='WARNING',
                metric='model_age',
                current_value=float(age_days),
                threshold=float(max_age_days),
                message=f'Model is {age_days} days old. Recommend retraining.',
                timestamp=datetime.now()
            )
            self.alert_history.append(alert)
            return alert

        return None

    def run_full_health_check(self, current_metrics: Dict) -> Dict:
        """Run all health checks and return consolidated report"""
        results = {
            'timestamp': datetime.now().isoformat(),
            'baseline_metrics': self.baseline_metrics,
            'current_metrics': current_metrics,
            'alerts': [],
            'status': 'HEALTHY'
        }

        # Run all checks
        accuracy_alert = self.check_accuracy_degradation(
            current_metrics.get('test_accuracy', 0)
        )
        if accuracy_alert:
            results['alerts'].append({
                'severity': accuracy_alert.severity,
                'metric': accuracy_alert.metric,
                'message': accuracy_alert.message
            })

        overfit_alert = self.check_overfitting_increase(
            current_metrics.get('overfitting_score', 0)
        )
        if overfit_alert:
            results['alerts'].append({
                'severity': overfit_alert.severity,
                'metric': overfit_alert.metric,
                'message': overfit_alert.message
            })

        data_alert = self.check_training_data_quality(
            current_metrics.get('num_train_samples', 0)
        )
        if data_alert:
            results['alerts'].append({
                'severity': data_alert.severity,
                'metric': data_alert.metric,
                'message': data_alert.message
            })

        # Determine overall status
        critical_alerts = [a for a in results['alerts'] if a['severity'] == 'CRITICAL']
        warning_alerts = [a for a in results['alerts'] if a['severity'] == 'WARNING']

        if critical_alerts:
            results['status'] = 'CRITICAL'
        elif warning_alerts:
            results['status'] = 'DEGRADED'
        else:
            results['status'] = 'HEALTHY'

        return results

    def format_report(self, health_report: Dict) -> str:
        """Format health check report for display"""
        report = []
        report.append(f"\n{'='*80}")
        report.append(f"MODEL HEALTH CHECK - {health_report['timestamp']}")
        report.append(f"{'='*80}\n")

        report.append(f"Status: {health_report['status']}\n")

        if health_report['alerts']:
            report.append(f"{'─'*80}")
            report.append(f"ALERTS ({len(health_report['alerts'])})")
            report.append(f"{'─'*80}")
            for alert in health_report['alerts']:
                report.append(f"\n[{alert['severity']}] {alert['metric'].upper()}")
                report.append(f"  {alert['message']}")

        report.append(f"\n{'='*80}\n")

        return '\n'.join(report)


def main():
    """Example usage"""
    monitor = ModelDegradationMonitor()

    # Simulate current metrics
    current_metrics = {
        'test_accuracy': 0.95,
        'overfitting_score': 0.05,
        'num_train_samples': 500,
        'num_test_samples': 100,
        'train_accuracy': 0.97,
    }

    # Run health check
    report = monitor.run_full_health_check(current_metrics)
    print(monitor.format_report(report))

    # Save report
    os.makedirs('models/monitoring', exist_ok=True)
    with open('models/monitoring/latest_health_check.json', 'w') as f:
        json.dump(report, f, indent=2)

    print(f"✓ Health check saved to models/monitoring/latest_health_check.json")


if __name__ == '__main__':
    main()
