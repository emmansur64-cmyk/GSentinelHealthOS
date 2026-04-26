#!/usr/bin/env python3
"""
MetaBrain ML Validation Pipeline
Complete workflow: Data → Train → Validate → Monitor
"""

import subprocess
import sys
import os
import json
from pathlib import Path
from datetime import datetime

class MLValidationPipeline:
    """Orchestrate complete ML validation workflow"""
    
    def __init__(self):
        self.project_root = Path(__file__).parent.parent
        self.results = {}
        self.start_time = datetime.now()
    
    def run_step(self, title: str, command: list) -> bool:
        """Run a pipeline step and track results"""
        print(f"\n{'='*80}")
        print(f"STEP: {title}")
        print(f"{'='*80}\n")
        
        try:
            result = subprocess.run(
                command,
                cwd=str(self.project_root),
                capture_output=False,
                text=True,
                timeout=120
            )
            
            success = result.returncode == 0
            self.results[title] = {
                'status': 'PASS' if success else 'FAIL',
                'returncode': result.returncode
            }
            
            return success
        
        except subprocess.TimeoutExpired:
            print(f"\n✗ TIMEOUT: {title}")
            self.results[title] = {'status': 'TIMEOUT'}
            return False
        
        except Exception as e:
            print(f"\n✗ ERROR in {title}: {e}")
            self.results[title] = {'status': 'ERROR', 'error': str(e)}
            return False
    
    def load_metrics(self) -> dict:
        """Load model metrics from JSON"""
        metrics_file = self.project_root / 'models' / 'model_metrics.json'
        if metrics_file.exists():
            with open(metrics_file) as f:
                return json.load(f)
        return {}
    
    def load_confusion_matrix(self) -> dict:
        """Load confusion matrix from JSON"""
        cm_file = self.project_root / 'models' / 'confusion_matrix.json'
        if cm_file.exists():
            with open(cm_file) as f:
                return json.load(f)
        return {}
    
    def print_execution_summary(self):
        """Print complete execution summary"""
        duration = (datetime.now() - self.start_time).total_seconds()
        
        print(f"\n{'='*80}")
        print(f"EXECUTION SUMMARY")
        print(f"{'='*80}\n")
        
        # Results table
        print(f"{'Step':<40} {'Status':<15}")
        print(f"{'-'*55}")
        for step, result in self.results.items():
            status = result['status']
            symbol = '✓' if status == 'PASS' else '✗' if status == 'FAIL' else '⚠'
            print(f"{symbol} {step:<38} {status:<15}")
        
        # Load metrics if available
        metrics = self.load_metrics()
        if metrics:
            print(f"\n{'─'*80}")
            print("MODEL METRICS")
            print(f"{'─'*80}")
            print(f"  Features:           {metrics.get('num_features', 'N/A')}")
            print(f"  Train Samples:      {metrics.get('num_train_samples', 'N/A')}")
            print(f"  Test Samples:       {metrics.get('num_test_samples', 'N/A')}")
            print(f"  Test Accuracy:      {metrics.get('test_accuracy', 'N/A'):.4f}")
            print(f"  Train Accuracy:     {metrics.get('train_accuracy', 'N/A'):.4f}")
            print(f"  Test Precision:     {metrics.get('test_precision', 'N/A'):.4f}")
            print(f"  Test Recall:        {metrics.get('test_recall', 'N/A'):.4f}")
            print(f"  Test F1-Score:      {metrics.get('test_f1', 'N/A'):.4f}")
            print(f"  Overfitting Score:  {metrics.get('overfitting_score', 'N/A'):.4f}")
            print(f"  CV Mean:            {metrics.get('cv_mean', 'N/A'):.4f}")
            print(f"  CV Std:             {metrics.get('cv_std', 'N/A'):.4f}")
        
        cm = self.load_confusion_matrix()
        if cm:
            print(f"\n{'─'*80}")
            print("CONFUSION MATRIX")
            print(f"{'─'*80}")
            print(f"  Matrix:             {cm.get('confusion_matrix', 'N/A')}")
            print(f"  True Positives:     {cm.get('true_positives', 'N/A')}")
            print(f"  False Positives:    {cm.get('false_positives', 'N/A')}")
        
        # Overall status
        failed = sum(1 for r in self.results.values() if r['status'] != 'PASS')
        total = len(self.results)
        
        print(f"\n{'─'*80}")
        if failed == 0:
            print(f"✓ ALL STEPS PASSED ({total}/{total})")
            status = "SUCCESS"
        else:
            print(f"✗ {failed}/{total} STEPS FAILED")
            status = "FAILURE"
        
        print(f"  Duration: {duration:.1f} seconds")
        print(f"  Timestamp: {datetime.now().isoformat()}")
        print(f"\n{'='*80}\n")
        
        return status


def main():
    """Run complete validation pipeline"""
    
    print(f"""
╔{'═'*78}╗
║ MetaBrain ML Validation Pipeline                                          ║
║ Complete workflow: Data → Train → Validate → Monitor                      ║
╚{'═'*78}╝
    """)
    
    pipeline = MLValidationPipeline()
    
    # Step 1: Split production vs synthetic dataset
    python_exe = str(pipeline.project_root / '.venv' / 'Scripts' / 'python.exe')

    if not pipeline.run_step(
        "1. Dataset Split (production vs synthetic)",
        [python_exe, "scripts/extract_real_dataset.py"]
    ):
        print("✗ Dataset split failed - cannot continue")
        return 1

    # Step 2: Data Pipeline
    python_exe = str(pipeline.project_root / '.venv' / 'Scripts' / 'python.exe')
    
    if not pipeline.run_step(
        "2. Data Pipeline (Feature Engineering)",
        [
            python_exe,
            "scripts/data_pipeline.py",
            "--input-dir",
            "data/production_dataset",
            "--output-dir",
            "data/processed",
            "--dataset-type",
            "production",
        ]
    ):
        print("⚠ Data pipeline failed - but may be expected with minimal data")
    
    # Step 3: Model Training
    if not pipeline.run_step(
        "3. Model Training (with Validation)",
        [python_exe, "scripts/train_model.py"]
    ):
        print("✗ Training failed - cannot continue")
        return 1
    
    # Step 4: Model Validation
    if not pipeline.run_step(
        "4. Model Validation (Overfitting Detection)",
        [python_exe, "scripts/validate_model.py"]
    ):
        print("✗ Validation failed")
        return 1
    
    # Step 5: Model Monitoring
    if not pipeline.run_step(
        "5. Model Monitoring (Degradation Detection)",
        [python_exe, "scripts/model_monitor.py"]
    ):
        print("✗ Monitoring setup failed")
        return 1
    
    # Print summary
    status = pipeline.print_execution_summary()
    
    return 0 if status == "SUCCESS" else 1


if __name__ == '__main__':
    sys.exit(main())
