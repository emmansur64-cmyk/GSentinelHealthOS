"""
Model Comparison Service
Automatically compare versions and recommend deployment decisions
"""

import json
import os
from pathlib import Path
from datetime import datetime
from typing import Dict, Tuple

class ModelComparison:
    """Compare model versions and make deployment recommendations"""

    def __init__(self, registry_path: str = 'models/registry.json'):
        self.registry_path = registry_path
        self.registry_dir = os.path.dirname(registry_path)
        self.registry = self._load_registry()

    def _load_registry(self) -> Dict:
        """Load registry"""
        if os.path.exists(self.registry_path):
            with open(self.registry_path, 'r') as f:
                return json.load(f)
        return {'versions': [], 'current_production': None}

    def compare_versions(self, v1: str, v2: str) -> Dict:
        """
        Compare two model versions

        Args:
            v1, v2: Version IDs to compare

        Returns:
            Comparison report
        """
        ver1 = self._get_version(v1)
        ver2 = self._get_version(v2)

        if not ver1 or not ver2:
            return {'error': 'Version not found'}

        comparison = {
            'version1': v1,
            'version2': v2,
            'timestamp': datetime.now().isoformat(),
            'metrics': {}
        }

        # Compare each metric
        metrics_to_compare = [
            'test_accuracy',
            'test_f1',
            'train_accuracy',
            'overfitting_score',
            'cv_mean',
            'num_train_samples'
        ]

        for metric in metrics_to_compare:
            val1 = ver1.get(metric, 0)
            val2 = ver2.get(metric, 0)

            # Calculate improvement
            if metric == 'overfitting_score':
                # Lower is better (negative improvement means more overfitting)
                improvement = ((val1 - val2) / max(abs(val1), 0.0001)) * 100
                direction = 'lower is better'
            else:
                # Higher is better
                improvement = ((val2 - val1) / max(abs(val1), 0.0001)) * 100
                direction = 'higher is better'

            comparison['metrics'][metric] = {
                'v1': val1,
                'v2': val2,
                'improvement_pct': improvement,
                'direction': direction,
                'better': v2 if improvement > 0 else v1
            }

        return comparison

    def compare_with_production(self, version: str) -> Dict:
        """Compare candidate version with current production"""
        prod = self.registry['current_production']

        if not prod:
            return {
                'status': 'NO_PRODUCTION',
                'message': 'No production version deployed yet',
                'recommendation': 'DEPLOY_CANDIDATE'
            }

        return self.compare_versions(prod, version)

    def recommend_deployment(self, candidate_version: str) -> Dict:
        """
        Recommend whether to deploy a candidate version

        Args:
            candidate_version: Version to evaluate for production

        Returns:
            Deployment recommendation
        """
        candidate = self._get_version(candidate_version)
        prod = self._get_version(self.registry['current_production']) if self.registry['current_production'] else None

        if not candidate:
            return {
                'version': candidate_version,
                'recommendation': 'REJECT',
                'reason': 'Version not found',
                'confidence': 0
            }

        # No production version yet
        if not prod:
            return {
                'version': candidate_version,
                'recommendation': 'DEPLOY',
                'reason': 'First version, no production baseline to compare',
                'confidence': 0.8,
                'notes': [
                    f'Test accuracy: {candidate["test_accuracy"]:.4f}',
                    f'Overfitting: {candidate["overfitting_score"]:.4f}'
                ]
            }

        recommendation = {
            'version': candidate_version,
            'timestamp': datetime.now().isoformat(),
            'confidence': 0,
            'checks': {}
        }

        # 1. Accuracy improvement threshold
        acc_improvement = candidate['test_accuracy'] - prod['test_accuracy']
        if acc_improvement >= 0.02:  # ≥2% improvement required
            recommendation['checks']['accuracy'] = {
                'pass': True,
                'prod': prod['test_accuracy'],
                'candidate': candidate['test_accuracy'],
                'improvement': acc_improvement
            }
            recommendation['confidence'] += 0.3
        elif acc_improvement > -0.05:  # Tolerate up to 5% degradation
            recommendation['checks']['accuracy'] = {
                'pass': True,
                'prod': prod['test_accuracy'],
                'candidate': candidate['test_accuracy'],
                'improvement': acc_improvement,
                'note': 'Small degradation, but within tolerance'
            }
            recommendation['confidence'] += 0.15
        else:
            recommendation['checks']['accuracy'] = {
                'pass': False,
                'prod': prod['test_accuracy'],
                'candidate': candidate['test_accuracy'],
                'improvement': acc_improvement,
                'reason': 'Accuracy degraded >5%'
            }

        # 2. Overfitting check
        overfit_improvement = prod['overfitting_score'] - candidate['overfitting_score']
        if overfit_improvement >= 0:  # Candidate has less overfitting
            recommendation['checks']['overfitting'] = {
                'pass': True,
                'prod': prod['overfitting_score'],
                'candidate': candidate['overfitting_score'],
                'improvement': overfit_improvement
            }
            recommendation['confidence'] += 0.25
        elif overfit_improvement > -0.10:  # Tolerate up to 0.10 more overfitting
            recommendation['checks']['overfitting'] = {
                'pass': True,
                'prod': prod['overfitting_score'],
                'candidate': candidate['overfitting_score'],
                'improvement': overfit_improvement,
                'note': 'Slightly more overfitting, but acceptable'
            }
            recommendation['confidence'] += 0.10
        else:
            recommendation['checks']['overfitting'] = {
                'pass': False,
                'prod': prod['overfitting_score'],
                'candidate': candidate['overfitting_score'],
                'improvement': overfit_improvement,
                'reason': 'Overfitting significantly increased'
            }

        # 3. Stability check
        if candidate['cv_std'] < prod['cv_std']:
            recommendation['checks']['stability'] = {
                'pass': True,
                'prod': prod['cv_std'],
                'candidate': candidate['cv_std'],
                'message': 'Better cross-validation stability'
            }
            recommendation['confidence'] += 0.15
        elif candidate['cv_std'] <= prod['cv_std'] * 1.2:  # Tolerate 20% worse
            recommendation['checks']['stability'] = {
                'pass': True,
                'prod': prod['cv_std'],
                'candidate': candidate['cv_std'],
                'message': 'Similar stability'
            }
            recommendation['confidence'] += 0.05
        else:
            recommendation['checks']['stability'] = {
                'pass': False,
                'prod': prod['cv_std'],
                'candidate': candidate['cv_std'],
                'reason': 'CV stability significantly worse'
            }

        # 4. Data quality
        if candidate['num_train_samples'] >= prod['num_train_samples']:
            recommendation['checks']['data'] = {
                'pass': True,
                'prod': prod['num_train_samples'],
                'candidate': candidate['num_train_samples'],
                'message': 'More or equal training samples'
            }
            recommendation['confidence'] += 0.15
        else:
            recommendation['checks']['data'] = {
                'pass': False,
                'prod': prod['num_train_samples'],
                'candidate': candidate['num_train_samples'],
                'reason': 'Fewer training samples'
            }

        # Make final recommendation
        passed_checks = sum(1 for c in recommendation['checks'].values() if c.get('pass', False))
        total_checks = len(recommendation['checks'])

        if passed_checks == total_checks and recommendation['confidence'] >= 0.7:
            recommendation['recommendation'] = 'DEPLOY'
            recommendation['severity'] = 'APPROVED'
        elif passed_checks >= total_checks * 0.75 and recommendation['confidence'] >= 0.5:
            recommendation['recommendation'] = 'DEPLOY_WITH_CAUTION'
            recommendation['severity'] = 'CONDITIONAL'
        elif passed_checks >= total_checks * 0.5:
            recommendation['recommendation'] = 'REVIEW'
            recommendation['severity'] = 'MANUAL_REVIEW_REQUIRED'
        else:
            recommendation['recommendation'] = 'REJECT'
            recommendation['severity'] = 'BLOCKED'

        return recommendation

    def _get_version(self, version: str) -> Dict:
        """Get version from registry"""
        for v in self.registry['versions']:
            if v['version'] == version:
                return v
        return None

    def print_comparison(self, comparison: Dict):
        """Format and print comparison report"""
        if 'error' in comparison:
            print(f"✗ Error: {comparison['error']}")
            return

        v1 = comparison['version1']
        v2 = comparison['version2']

        print(f"\n{'='*90}")
        print(f"MODEL COMPARISON: {v1} vs {v2}")
        print(f"{'='*90}\n")

        print(f"{'Metric':<25} {v1:<15} {v2:<15} {'Improvement':<20}")
        print(f"{'-'*90}")

        for metric, data in comparison['metrics'].items():
            v1_val = data['v1']
            v2_val = data['v2']
            improvement = data['improvement_pct']
            better = '✓' if data['better'] == v2 else '✗'

            print(f"{metric:<25} {v1_val:<15.4f} {v2_val:<15.4f} {better} {improvement:+.1f}%")

        print(f"\n{'='*90}\n")

    def print_recommendation(self, rec: Dict):
        """Format and print deployment recommendation"""
        print(f"\n{'='*90}")
        print(f"DEPLOYMENT RECOMMENDATION: {rec['version']}")
        print(f"{'='*90}\n")

        print(f"Recommendation: {rec['recommendation']}")
        print(f"Severity: {rec.get('severity', 'N/A')}")
        print(f"Confidence: {rec.get('confidence', 0):.1%}\n")

        if 'checks' in rec:
            print(f"{'Check':<20} {'Status':<10} {'Details':<60}")
            print(f"{'-'*90}")

            for check_name, check_data in rec['checks'].items():
                status = '✓ PASS' if check_data.get('pass', False) else '✗ FAIL'

                if 'reason' in check_data:
                    details = check_data['reason']
                elif 'note' in check_data:
                    details = check_data['note']
                elif 'message' in check_data:
                    details = check_data['message']
                elif 'improvement' in check_data:
                    imp = check_data['improvement']
                    details = f"{check_data.get('prod', 0):.4f} → {check_data.get('candidate', 0):.4f} ({imp:+.4f})"
                else:
                    details = str(check_data)

                print(f"{check_name:<20} {status:<10} {details:<60}")

        if 'reason' in rec and rec.get('recommendation') == 'REJECT':
            print(f"\n⚠ Reason: {rec['reason']}")

        print(f"\n{'='*90}\n")


def main():
    """Example usage"""
    comparator = ModelComparison()

    # Get versions
    registry = json.load(open('models/registry.json')) if os.path.exists('models/registry.json') else {'versions': []}

    versions = [v['version'] for v in registry.get('versions', [])]

    if len(versions) < 2:
        print("✗ Need at least 2 versions to compare")
        return

    # Compare last two versions
    latest = versions[-1]
    previous = versions[-2]

    print(f"\nComparing {previous} vs {latest}...")

    # Run comparison
    comparison = comparator.compare_versions(previous, latest)
    comparator.print_comparison(comparison)

    # Get recommendation
    recommendation = comparator.recommend_deployment(latest)
    comparator.print_recommendation(recommendation)

    # Save recommendation
    os.makedirs('models/reports', exist_ok=True)
    with open(f'models/reports/recommendation_{latest}.json', 'w') as f:
        json.dump(recommendation, f, indent=2)

    print(f"✓ Recommendation saved to models/reports/recommendation_{latest}.json")


if __name__ == '__main__':
    main()
