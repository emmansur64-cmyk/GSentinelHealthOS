"""
MetaBrain ML Model Registry
Tracks model versions, metrics history, and deployment status
"""

import json
import os
import shutil
from datetime import datetime
from pathlib import Path
from typing import Optional, Dict, List
import joblib

class ModelRegistry:
    """Central registry for recording and managing model versions"""

    def __init__(self, registry_path: str = 'models/registry.json'):
        self.registry_path = registry_path
        self.registry_dir = os.path.dirname(registry_path)
        os.makedirs(self.registry_dir, exist_ok=True)
        self.registry = self._load_registry()

    def _load_registry(self) -> Dict:
        """Load registry from JSON file"""
        if not os.path.exists(self.registry_path):
            return {
                'versions': [],
                'current_production': None,
                'staging': None,
                'history': []
            }

        try:
            with open(self.registry_path, 'r') as f:
                return json.load(f)
        except Exception as e:
            print(f"Error loading registry: {e}")
            return {
                'versions': [],
                'current_production': None,
                'staging': None,
                'history': []
            }

    def _save_registry(self):
        """Save registry to JSON file"""
        with open(self.registry_path, 'w') as f:
            json.dump(self.registry, f, indent=2)

    def _get_next_version(self) -> str:
        """Generate next version number"""
        if not self.registry['versions']:
            return 'v1'

        last_version = self.registry['versions'][-1]['version']
        version_num = int(last_version[1:]) + 1
        return f'v{version_num}'

    def register_model(self, metrics: Dict, notes: str = '', model_dir: str = 'models') -> str:
        """
        Register a new model version

        Args:
            metrics: Model metrics dict
            notes: Registration notes
            model_dir: Directory containing model files

        Returns:
            Version ID (e.g., 'v2')
        """
        next_version = self._get_next_version()
        version_dir = os.path.join(self.registry_dir, next_version)

        # Create version directory
        os.makedirs(version_dir, exist_ok=True)

        # Copy model files
        for file in ['decision_model.pkl', 'decision_model.onnx', 'confusion_matrix.json', 'onnx_metadata.json', 'feature_names.txt']:
            src = os.path.join(model_dir, file)
            dst = os.path.join(version_dir, file)
            if os.path.exists(src):
                shutil.copy2(src, dst)

        # Record metrics
        metrics['timestamp'] = datetime.now().isoformat()
        with open(os.path.join(version_dir, 'metrics.json'), 'w') as f:
            json.dump(metrics, f, indent=2)

        # Register version
        version_record = {
            'version': next_version,
            'timestamp': metrics['timestamp'],
            'train_accuracy': metrics.get('train_accuracy', 0),
            'test_accuracy': metrics.get('test_accuracy', 0),
            'train_f1': metrics.get('train_f1', 0),
            'test_f1': metrics.get('test_f1', 0),
            'overfitting_score': metrics.get('overfitting_score', 0),
            'cv_mean': metrics.get('cv_mean', 0),
            'cv_std': metrics.get('cv_std', 0),
            'num_train_samples': metrics.get('num_train_samples', 0),
            'num_test_samples': metrics.get('num_test_samples', 0),
            'num_features': metrics.get('num_features', 0),
            'feature_schema_version': metrics.get('feature_schema_version'),
            'pipeline_version': metrics.get('pipeline_version'),
            'feature_names_hash': metrics.get('feature_names_hash'),
            'encoder_hash': metrics.get('encoder_hash'),
            'action_encoder_hash': metrics.get('action_encoder_hash'),
            'status': 'STAGING',
            'notes': notes
        }

        self.registry['versions'].append(version_record)
        self.registry['staging'] = next_version

        # Record history
        self.registry['history'].append({
            'event': 'registered',
            'version': next_version,
            'timestamp': metrics['timestamp'],
            'notes': notes
        })

        self._save_registry()

        print(f"\n[OK] Model {next_version} registered")
        print(f"  Location: {version_dir}")
        print(f"  Test Accuracy: {metrics.get('test_accuracy', 0):.4f}")
        print(f"  Overfitting: {metrics.get('overfitting_score', 0):.4f}")
        if metrics.get('feature_schema_version'):
            print(f"  Feature Schema: {metrics.get('feature_schema_version')}")

        return next_version

    def promote_to_production(self, version: str, force: bool = False) -> bool:
        """
        Promote staging version to production

        Args:
            version: Version ID to promote
            force: Force promotion without checks

        Returns:
            True if successful
        """
        # Find version
        version_record = None
        for v in self.registry['versions']:
            if v['version'] == version:
                version_record = v
                break

        if not version_record:
            print(f"[OK] Version {version} not found")
            return False

        # Check validation
        if not force and version_record['status'] != 'STAGING':
            print(f"[OK] Version {version} is not in STAGING status")
            return False

        # Demote previous production
        if self.registry['current_production']:
            for v in self.registry['versions']:
                if v['version'] == self.registry['current_production']:
                    v['status'] = 'SUPERSEDED'

        # Promote new version
        version_record['status'] = 'PRODUCTION'
        self.registry['current_production'] = version

        # Record history
        self.registry['history'].append({
            'event': 'promoted_to_production',
            'version': version,
            'timestamp': datetime.now().isoformat(),
            'previous_production': self.registry['current_production']
        })

        self._save_registry()

        print(f"[OK] Version {version} promoted to PRODUCTION")
        print(f"  Test Accuracy: {version_record['test_accuracy']:.4f}")
        print(f"  Overfitting: {version_record['overfitting_score']:.4f}")

        return True

    def reject_version(self, version: str, reason: str = '') -> bool:
        """Mark version as rejected"""
        for v in self.registry['versions']:
            if v['version'] == version:
                v['status'] = 'REJECTED'

                self.registry['history'].append({
                    'event': 'rejected',
                    'version': version,
                    'timestamp': datetime.now().isoformat(),
                    'reason': reason
                })

                self._save_registry()
                print(f"[OK] Version {version} marked as REJECTED: {reason}")
                return True

        return False

    def get_production_version(self) -> Optional[Dict]:
        """Get current production version info"""
        if not self.registry['current_production']:
            return None

        for v in self.registry['versions']:
            if v['version'] == self.registry['current_production']:
                return v

        return None

    def get_staging_version(self) -> Optional[Dict]:
        """Get current staging version info"""
        if not self.registry['staging']:
            return None

        for v in self.registry['versions']:
            if v['version'] == self.registry['staging']:
                return v

        return None

    def get_version(self, version: str) -> Optional[Dict]:
        """Get specific version info"""
        for v in self.registry['versions']:
            if v['version'] == version:
                return v
        return None

    def load_model(self, version: str, format: str = 'pkl'):
        """
        Load model from version directory

        Args:
            version: Version ID
            format: 'pkl' or 'onnx'

        Returns:
            Loaded model or None
        """
        version_dir = os.path.join(self.registry_dir, version)

        if format == 'pkl':
            model_file = os.path.join(version_dir, 'decision_model.pkl')
            if os.path.exists(model_file):
                return joblib.load(model_file)
        elif format == 'onnx':
            model_file = os.path.join(version_dir, 'decision_model.onnx')
            if os.path.exists(model_file):
                return model_file

        return None

    def print_history(self):
        """Print version history"""
        print(f"\n{'='*80}")
        print("MODEL REGISTRY HISTORY")
        print(f"{'='*80}\n")

        print(f"{'Version':<10} {'Status':<15} {'Test Acc':<12} {'FeatSchema':<18} {'Timestamp':<25}")
        print(f"{'-'*80}")

        for v in self.registry['versions']:
            status = v['status']
            symbol = '●' if v['version'] == self.registry['current_production'] else '◯'

            feature_schema = str(v.get('feature_schema_version') or 'n/a')[:17]
            print(f"{symbol} {v['version']:<8} {status:<15} {v['test_accuracy']:<12.4f} {feature_schema:<18} {v['timestamp'][:19]}")

        print(f"\n{'─'*80}")
        print(f"Current Production: {self.registry['current_production'] or 'None'}")
        print(f"Current Staging:    {self.registry['staging'] or 'None'}")
        print(f"Total Versions:     {len(self.registry['versions'])}")
        print(f"\n{'='*80}\n")

    def print_summary(self):
        """Print registry summary"""
        print(f"\n{'='*80}")
        print("MODEL REGISTRY SUMMARY")
        print(f"{'='*80}\n")

        prod = self.get_production_version()
        staging = self.get_staging_version()

        if prod:
            print("PRODUCTION:")
            print(f"  Version: {prod['version']}")
            print(f"  Test Accuracy: {prod['test_accuracy']:.4f}")
            print(f"  Overfitting: {prod['overfitting_score']:.4f}")
            print(f"  Deployed: {prod['timestamp'][:10]}")
            print()

        if staging:
            print("STAGING:")
            print(f"  Version: {staging['version']}")
            print(f"  Test Accuracy: {staging['test_accuracy']:.4f}")
            print(f"  Overfitting: {staging['overfitting_score']:.4f}")
            print(f"  Created: {staging['timestamp'][:10]}")
            print()

        print(f"Total Versions: {len(self.registry['versions'])}")
        print(f"{'='*80}\n")


def main():
    """Example usage"""
    registry = ModelRegistry()

    # Example: Register a new model
    example_metrics = {
        'train_accuracy': 0.95,
        'test_accuracy': 0.92,
        'train_f1': 0.93,
        'test_f1': 0.90,
        'overfitting_score': 0.03,
        'cv_mean': 0.91,
        'cv_std': 0.02,
        'num_train_samples': 500,
        'num_test_samples': 100,
        'num_features': 18
    }

    # Register (would be called by train_model.py)
    version = registry.register_model(
        example_metrics,
        notes="Training with 500 samples"
    )

    # Print summary
    registry.print_summary()
    registry.print_history()


if __name__ == '__main__':
    main()
