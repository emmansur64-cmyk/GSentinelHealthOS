#!/usr/bin/env python3
"""
Model Registry Demonstration
Simulates complete model evolution lifecycle with multiple versions
"""

import json
import os
import sys
from pathlib import Path

# Add scripts to path
sys.path.insert(0, str(Path(__file__).parent))
from model_registry import ModelRegistry
from model_compare import ModelComparison
from model_rollback import ModelRollback

def main():
    """Run demonstration of model registry features"""
    
    print(f"\n{'='*90}")
    print("MetaBrain Model Registry Demonstration")
    print("Simulating: Evolution → Comparison → Deployment → Monitoring → Rollback")
    print(f"{'='*90}\n")
    
    # Initialize services
    registry = ModelRegistry('models/registry.json')
    comparator = ModelComparison('models/registry.json')
    rollback_mgr = ModelRollback('models/registry.json')
    
    # Scenario: Three training runs with improving then degrading performance
    scenarios = [
        {
            'version': 'v1',
            'notes': 'Initial training - 400 samples',
            'metrics': {
                'train_accuracy': 0.90,
                'test_accuracy': 0.88,
                'train_f1': 0.89,
                'test_f1': 0.87,
                'overfitting_score': 0.02,
                'cv_mean': 0.87,
                'cv_std': 0.04,
                'num_train_samples': 400,
                'num_test_samples': 100,
                'num_features': 18,
            }
        },
        {
            'version': 'v2',
            'notes': 'Better features - 500 samples, improved accuracy',
            'metrics': {
                'train_accuracy': 0.95,
                'test_accuracy': 0.92,
                'train_f1': 0.94,
                'test_f1': 0.91,
                'overfitting_score': 0.03,
                'cv_mean': 0.91,
                'cv_std': 0.03,
                'num_train_samples': 500,
                'num_test_samples': 100,
                'num_features': 18,
            }
        },
        {
            'version': 'v3',
            'notes': 'Experimental features - unstable performance',
            'metrics': {
                'train_accuracy': 0.87,
                'test_accuracy': 0.85,
                'train_f1': 0.86,
                'test_f1': 0.84,
                'overfitting_score': 0.02,
                'cv_mean': 0.83,
                'cv_std': 0.08,  # High variance
                'num_train_samples': 500,
                'num_test_samples': 100,
                'num_features': 18,
            }
        }
    ]
    
    print(f"{'─'*90}")
    print("SIMULATING 3 TRAINING RUNS")
    print(f"{'─'*90}\n")
    
    for i, scenario in enumerate(scenarios, 1):
        print(f"\n>>> PHASE {i}: Training {scenario['version']}")
        print(f"    Notes: {scenario['notes']}")
        
        # Register model (would come from train_model.py in production)
        version = scenario['version']
        
        # For simulation: manually add to registry (skip file copying)
        version_record = {
            'version': version,
            'timestamp': '2026-04-12T23:00:00Z',
            'train_accuracy': scenario['metrics']['train_accuracy'],
            'test_accuracy': scenario['metrics']['test_accuracy'],
            'train_f1': scenario['metrics']['train_f1'],
            'test_f1': scenario['metrics']['test_f1'],
            'overfitting_score': scenario['metrics']['overfitting_score'],
            'cv_mean': scenario['metrics']['cv_mean'],
            'cv_std': scenario['metrics']['cv_std'],
            'num_train_samples': scenario['metrics']['num_train_samples'],
            'num_test_samples': scenario['metrics']['num_test_samples'],
            'num_features': scenario['metrics']['num_features'],
            'status': 'STAGING',
            'notes': scenario['notes']
        }
        
        registry.registry['versions'].append(version_record)
        registry.registry['staging'] = version
        registry.registry['history'].append({
            'event': 'registered',
            'version': version,
            'timestamp': '2026-04-12T23:00:00Z',
            'notes': scenario['notes']
        })
        registry._save_registry()
        
        print(f"    ✓ Registered as {version}")
        print(f"      Test Accuracy: {scenario['metrics']['test_accuracy']:.4f}")
        print(f"      Overfitting: {scenario['metrics']['overfitting_score']:.4f}")
        print(f"      CV Std: {scenario['metrics']['cv_std']:.4f}")
        
        # Get recommendation
        if i == 1:
            print(f"\n    📊 RECOMMENDATION: First version - AUTO DEPLOY")
            registry.promote_to_production(version)
        else:
            print(f"\n    📊 COMPARING {version} vs PRODUCTION")
            recommendation = comparator.recommend_deployment(version)
            
            print(f"       Recommendation: {recommendation['recommendation']}")
            print(f"       Confidence: {recommendation['confidence']:.0%}")
            
            if recommendation['recommendation'] == 'DEPLOY':
                registry.promote_to_production(version)
                print(f"       → ✓ DEPLOYED TO PRODUCTION")
            elif recommendation['recommendation'] == 'DEPLOY_WITH_CAUTION':
                print(f"       → ⚠ Needs manual review - NOT AUTO DEPLOYED")
            else:
                registry.reject_version(version, "Failed recommendation")
                print(f"       → ✗ REJECTED")
    
    # Print final state
    print(f"\n\n{'─'*90}")
    print("FINAL STATE AFTER 3 TRAINING CYCLES")
    print(f"{'─'*90}\n")
    
    registry.print_summary()
    registry.print_history()
    
    # Demonstrate comparisons
    print(f"\n{'─'*90}")
    print("DETAILED COMPARISON: v2 vs v1")
    print(f"{'─'*90}\n")
    
    comparison = comparator.compare_versions('v1', 'v2')
    comparator.print_comparison(comparison)
    
    # Demonstrate rollback scenario
    print(f"\n{'─'*90}")
    print("SIMULATING PRODUCTION ISSUE → AUTOMATIC ROLLBACK")
    print(f"{'─'*90}\n")
    
    print("Alert: v2 accuracy degraded to 0.85 in production (was 0.92)")
    print("Trigger: Automatic rollback due to >10% accuracy loss\n")
    
    # Find previous stable version
    candidates = rollback_mgr.get_rollback_candidates()
    if candidates:
        target = candidates[0]['version']
        print(f"Candidate for rollback: {target}")
        print(f"  Test Accuracy: {candidates[0]['test_accuracy']:.4f}")
        
        # Simulate rollback
        rollback_mgr.registry = registry.registry  # Sync state
        rollback_mgr.registry['current_production'] = 'v2'  # Set v2 as current
        rollback_mgr._save_registry()
        
        rollback_mgr.rollback_to_version(
            target,
            reason='Production accuracy degradation >10%'
        )
    
    # Final summary
    print(f"\n{'─'*90}")
    print("DEPLOYMENT HISTORY")
    print(f"{'─'*90}\n")
    
    rollback_mgr.print_deployment_history()
    
    print(f"\n{'═'*90}")
    print("✓ DEMONSTRATION COMPLETE")
    print(f"{'═'*90}\n")
    
    print("Key Takeaways:")
    print("  1. v1 registered and auto-promoted to PRODUCTION (first version)")
    print("  2. v2 registered, compared with v1, auto-promoted (better accuracy)")
    print("  3. v3 registered, rejected due to high CV variance and low accuracy")
    print("  4. v2 degraded in production → automatic rollback to v1")
    print("  5. All events tracked in history for compliance/audit")
    print()

if __name__ == '__main__':
    main()
