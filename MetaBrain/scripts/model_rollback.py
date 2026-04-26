"""
Model Rollback Service
Safely rollback to previous model versions
"""

import json
import os
import shutil
from datetime import datetime
from pathlib import Path
from typing import Optional, List

class ModelRollback:
    """Manage model rollback and version switching"""
    
    def __init__(self, registry_path: str = 'models/registry.json', model_dir: str = 'models'):
        self.registry_path = registry_path
        self.model_dir = model_dir
        self.registry_dir = os.path.dirname(registry_path)
        self.registry = self._load_registry()
    
    def _load_registry(self) -> dict:
        """Load registry"""
        if os.path.exists(self.registry_path):
            with open(self.registry_path, 'r') as f:
                return json.load(f)
        return {'versions': [], 'current_production': None, 'history': []}
    
    def _save_registry(self):
        """Save registry"""
        with open(self.registry_path, 'w') as f:
            json.dump(self.registry, f, indent=2)
    
    def get_available_versions(self) -> List[dict]:
        """Get all available versions"""
        return self.registry.get('versions', [])
    
    def get_deployment_history(self, limit: int = 20) -> List[dict]:
        """Get deployment history"""
        history = self.registry.get('history', [])
        deployment_events = [
            h for h in history
            if h.get('event') in ['promoted_to_production', 'rollback']
        ]
        return deployment_events[-limit:]
    
    def rollback_to_version(self, version: str, reason: str = '') -> bool:
        """
        Rollback to a previous version
        
        Args:
            version: Version ID to rollback to
            reason: Reason for rollback
        
        Returns:
            True if successful
        """
        # Find version
        target_version = None
        for v in self.registry['versions']:
            if v['version'] == version:
                target_version = v
                break
        
        if not target_version:
            print(f"✗ Version {version} not found in registry")
            return False
        
        # Check if valid for rollback
        current_prod = self.registry.get('current_production')
        if version == current_prod:
            print(f"✗ {version} is already in production")
            return False
        
        # Get current production for backup reference
        prev_production = None
        for v in self.registry['versions']:
            if v['version'] == current_prod:
                prev_production = v
                break
        
        print(f"\n{'='*80}")
        print(f"MODEL ROLLBACK")
        print(f"{'='*80}\n")
        print(f"Rolling back from {current_prod} to {version}")
        print(f"Reason: {reason or 'Unspecified'}\n")
        
        # Copy model files from version directory to current
        version_dir = os.path.join(self.registry_dir, version)
        
        files_to_copy = [
            'decision_model.pkl',
            'decision_model.onnx',
            'confusion_matrix.json',
            'metrics.json'
        ]
        
        try:
            for file in files_to_copy:
                src = os.path.join(version_dir, file)
                dst = os.path.join(self.model_dir, file)
                
                if os.path.exists(src):
                    shutil.copy2(src, dst)
                    print(f"  ✓ Restored {file}")
        
        except Exception as e:
            print(f"✗ Error during rollback: {e}")
            return False
        
        # Update registry
        target_version['status'] = 'PRODUCTION'
        
        # Demote previous production to superseded
        if prev_production:
            prev_production['status'] = 'SUPERSEDED'
        
        self.registry['current_production'] = version
        
        # Record in history
        self.registry['history'].append({
            'event': 'rollback',
            'version': version,
            'timestamp': datetime.now().isoformat(),
            'from_version': current_prod,
            'reason': reason
        })
        
        self._save_registry()
        
        print(f"\n✓ Rollback successful")
        print(f"  Test Accuracy: {target_version.get('test_accuracy', 0):.4f}")
        print(f"  Overfitting: {target_version.get('overfitting_score', 0):.4f}")
        print(f"  Deployed: {target_version.get('timestamp', 'N/A')[:10]}")
        print(f"\n{'='*80}\n")
        
        return True
    
    def automatic_rollback(self, degradation_threshold: float = 0.10) -> bool:
        """
        Automatically rollback if current production degraded
        
        Args:
            degradation_threshold: Max allowed accuracy loss
        
        Returns:
            True if rollback was triggered
        """
        current = self._get_version(self.registry['current_production'])
        
        # Find previous stable version
        for v in reversed(self.registry['versions']):
            if v['version'] == self.registry['current_production']:
                continue
            
            if v['status'] in ['SUPERSEDED', 'PRODUCTION']:
                # Check if current degraded relative to previous
                degradation = current['test_accuracy'] - v['test_accuracy']
                
                if degradation > degradation_threshold:
                    print(f"\n⚠ AUTOMATIC ROLLBACK TRIGGERED")
                    print(f"  Accuracy degraded by {degradation:.2%}")
                    
                    return self.rollback_to_version(
                        v['version'],
                        reason=f'Automatic rollback due to {degradation:.2%} accuracy degradation'
                    )
        
        return False
    
    def get_rollback_candidates(self) -> List[dict]:
        """Get versions that are safe candidates for rollback"""
        candidates = []
        
        for v in self.registry['versions']:
            if v['status'] in ['SUPERSEDED', 'PRODUCTION']:
                if v['version'] != self.registry['current_production']:
                    candidates.append({
                        'version': v['version'],
                        'test_accuracy': v.get('test_accuracy', 0),
                        'timestamp': v.get('timestamp', ''),
                        'status': v['status'],
                        'notes': v.get('notes', '')
                    })
        
        return sorted(candidates, key=lambda x: x['timestamp'], reverse=True)
    
    def _get_version(self, version: str) -> Optional[dict]:
        """Get version from registry"""
        for v in self.registry['versions']:
            if v['version'] == version:
                return v
        return None
    
    def print_rollback_candidates(self):
        """Print available rollback candidates"""
        candidates = self.get_rollback_candidates()
        
        if not candidates:
            print("✗ No rollback candidates available")
            return
        
        print(f"\n{'='*80}")
        print("AVAILABLE ROLLBACK CANDIDATES")
        print(f"{'='*80}\n")
        
        print(f"{'Version':<10} {'Status':<15} {'Test Accuracy':<15} {'Created':<20} {'Notes':<30}")
        print(f"{'-'*90}")
        
        for candidate in candidates:
            print(f"{candidate['version']:<10} {candidate['status']:<15} "
                  f"{candidate['test_accuracy']:<15.4f} {candidate['timestamp'][:19]:<20} "
                  f"{candidate.get('notes', '')[:30]:<30}")
        
        print(f"\n{'='*80}\n")
    
    def print_deployment_history(self):
        """Print deployment history"""
        history = self.get_deployment_history()
        
        if not history:
            print("No deployment history found")
            return
        
        print(f"\n{'='*80}")
        print("DEPLOYMENT HISTORY")
        print(f"{'='*80}\n")
        
        print(f"{'Timestamp':<25} {'Event':<20} {'Version':<10} {'Details':<35}")
        print(f"{'-'*90}")
        
        for event in history:
            details = ''
            if event['event'] == 'rollback':
                details = f"from {event.get('from_version', 'N/A')}"
            elif event['event'] == 'promoted_to_production':
                details = f"previous: {event.get('previous_production', 'None')}"
            
            print(f"{event['timestamp'][:25]:<25} {event['event']:<20} "
                  f"{event['version']:<10} {details:<35}")
        
        print(f"\n{'='*80}\n")


def main():
    """Example usage"""
    import sys
    
    rollback_mgr = ModelRollback()
    
    # Print available versions
    rollback_mgr.print_rollback_candidates()
    
    # Print history
    rollback_mgr.print_deployment_history()
    
    # Example: Rollback to specific version
    if len(sys.argv) > 1:
        version = sys.argv[1]
        reason = sys.argv[2] if len(sys.argv) > 2 else "Manual rollback"
        
        success = rollback_mgr.rollback_to_version(version, reason)
        sys.exit(0 if success else 1)


if __name__ == '__main__':
    main()
