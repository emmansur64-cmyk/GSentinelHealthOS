# ML Validation Integration Guide

## For Backend Engineers

### 1. Daily Retraining Integration

The `LearningService` automatically triggers retraining at midnight:

```typescript
// src/learning/learning.service.ts

@Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
async retrainModel() {
  const { execAsync } = promisify(exec);
  
  try {
    // Data pipeline
    await execAsync('python scripts/data_pipeline.py');
    
    // Training with validation
    await execAsync('python scripts/train_model.py');
    
    // Validation report
    const validationResult = await execAsync(
      'python scripts/validate_model.py'
    );
    
    // Monitoring check
    await execAsync('python scripts/model_monitor.py');
    
    // Load new metrics
    const metrics = await this.loadMetrics();
    
    // Only deploy if validation passes
    if (metrics.readiness_score >= 60) {
      this.logger.log('✓ Model passed validation - deploying');
      await this.modelService.loadLatestModel();
    } else {
      this.logger.warn('⚠ Model validation failed - keeping previous version');
      this.alertingService.notify({
        severity: 'WARNING',
        message: 'Daily retraining failed validation',
        metrics: metrics
      });
    }
  } catch (error) {
    this.alertingService.notify({
      severity: 'CRITICAL',
      message: 'Model retraining failed',
      error: error.message
    });
  }
}
```

### 2. Health Check Endpoint

Add monitoring endpoint to expose validation metrics:

```typescript
// src/learning/learning.controller.ts

@Controller('api/admin/ml')
export class LearningController {
  constructor(private learningService: LearningService) {}

  @Get('health')
  async getModelHealth() {
    return {
      status: 'ok',
      metrics: this.learningService.getLatestMetrics(),
      monitoring: await this.learningService.getHealthCheck(),
      lastRetrain: this.learningService.getLastRetrainTime(),
    };
  }

  @Get('metrics')
  async getModelMetrics() {
    const metrics = this.learningService.getLatestMetrics();
    return {
      accuracy: metrics.test_accuracy,
      precision: metrics.test_precision,
      recall: metrics.test_recall,
      f1: metrics.test_f1,
      overfitting: metrics.overfitting_score,
      cv_mean: metrics.cv_mean,
      samples: {
        train: metrics.num_train_samples,
        test: metrics.num_test_samples,
      },
    };
  }

  @Get('validation')
  async getValidationReport() {
    // Returns last validation report from validate_model.py
    return this.learningService.getValidationReport();
  }
}
```

### 3. Alerts and Notifications

Configure alerting based on validation thresholds:

```typescript
// src/learning/validation-alerts.service.ts

export class ValidationAlertsService {
  async checkAndAlert(metrics: ModelMetrics) {
    const alerts = [];

    // Accuracy degradation
    if (metrics.accuracy_degradation > 0.10) {
      alerts.push({
        severity: 'CRITICAL',
        message: 'Accuracy degraded >10% - consider retraining',
        metric: 'accuracy_degradation',
        value: metrics.accuracy_degradation,
      });
    }

    // Overfitting detected
    if (metrics.overfitting_score > 0.30) {
      alerts.push({
        severity: 'WARNING',
        message: 'Severe overfitting detected - model may not generalize',
        metric: 'overfitting',
        value: metrics.overfitting_score,
      });
    }

    // Low confidence
    if (metrics.test_accuracy < 0.70) {
      alerts.push({
        severity: 'WARNING',
        message: 'Test accuracy low - limited production confidence',
        metric: 'test_accuracy',
        value: metrics.test_accuracy,
      });
    }

    // Model staleness
    const age = this.getModelAge();
    if (age > 30) {
      alerts.push({
        severity: 'INFO',
        message: 'Model >30 days old - schedule retraining',
        metric: 'model_age',
        value: age,
      });
    }

    // Send alerts
    for (const alert of alerts) {
      await this.notificationService.send(alert);
    }

    return alerts;
  }
}
```

## For DevOps/SRE

### 1. CI/CD Pipeline Integration

Add ML validation to pipeline before production promotion:

```yaml
# .github/workflows/ml-validation.yml

name: ML Model Validation

on:
  schedule:
    - cron: '0 1 * * *'  # Daily after training

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      
      - name: Setup Python
        uses: actions/setup-python@v2
        with:
          python-version: '3.14'
      
      - name: Install dependencies
        run: pip install -r requirements.txt
      
      - name: Run validation pipeline
        run: python scripts/run_ml_validation.py
      
      - name: Check validation report
        run: |
          READINESS=$(python -c \
            "import json; \
            m = json.load(open('models/model_metrics.json')); \
            print(int(m.get('readiness_score', 0)))")
          
          if [ $READINESS -lt 60 ]; then
            echo "✗ Model validation failed (score: $READINESS/100)"
            exit 1
          fi
          
          echo "✓ Model validation passed (score: $READINESS/100)"
      
      - name: Deploy model to staging
        if: success()
        run: |
          aws s3 cp models/decision_model.onnx \
            s3://metabrain-models/staging/decision_model.onnx
          
          aws lambda update-function-code \
            --function-name metabrain-staging-ml-predictor \
            --s3-bucket metabrain-models \
            --s3-key staging/decision_model.onnx
      
      - name: Notify on failure
        if: failure()
        uses: 8398a7/action-slack@v3
        with:
          status: ${{ job.status }}
          text: 'ML validation failed during daily retrain'
          webhook_url: ${{ secrets.SLACK_WEBHOOK }}
```

### 2. Monitoring Dashboard

Create Grafana dashboard for ML metrics:

```json
{
  "dashboard": {
    "title": "MetaBrain ML Model Monitoring",
    "panels": [
      {
        "title": "Model Accuracy Over Time",
        "targets": [
          {
            "expr": "metabrain_model_accuracy{metric=\"test\"}"
          }
        ],
        "thresholds": [
          {"value": 0.70, "color": "yellow"},
          {"value": 0.85, "color": "green"}
        ]
      },
      {
        "title": "Overfitting Score",
        "targets": [
          {
            "expr": "metabrain_model_overfitting_score"
          }
        ],
        "thresholds": [
          {"value": 0.15, "color": "yellow"},
          {"value": 0.30, "color": "red"}
        ]
      },
      {
        "title": "Model Age (days)",
        "targets": [
          {
            "expr": "metabrain_model_age_days"
          }
        ],
        "thresholds": [
          {"value": 7, "color": "green"},
          {"value": 30, "color": "red"}
        ]
      },
      {
        "title": "Production Readiness Score",
        "targets": [
          {
            "expr": "metabrain_model_readiness_score"
          }
        ],
        "thresholds": [
          {"value": 60, "color": "yellow"},
          {"value": 80, "color": "green"}
        ]
      }
    ]
  }
}
```

### 3. Prometheus Metrics Export

Export validation metrics to Prometheus:

```python
# scripts/export_metrics.py

from prometheus_client import CollectorRegistry, Gauge, write_to_textfile
import json

def export_validation_metrics():
    registry = CollectorRegistry()
    
    # Load metrics
    with open('models/model_metrics.json') as f:
        metrics = json.load(f)
    
    # Create gauges
    accuracy = Gauge(
        'metabrain_model_accuracy',
        'Model test accuracy',
        ['set'],  # train or test
        registry=registry
    )
    
    overfitting = Gauge(
        'metabrain_model_overfitting_score',
        'Train vs test accuracy difference',
        registry=registry
    )
    
    precision = Gauge(
        'metabrain_model_precision',
        'Model test precision',
        registry=registry
    )
    
    cv_mean = Gauge(
        'metabrain_model_cv_mean',
        'Cross-validation mean accuracy',
        registry=registry
    )
    
    # Set values
    accuracy.labels(set='train').set(metrics['train_accuracy'])
    accuracy.labels(set='test').set(metrics['test_accuracy'])
    overfitting.set(metrics['overfitting_score'])
    precision.set(metrics['test_precision'])
    cv_mean.set(metrics['cv_mean'])
    
    # Write to file
    write_to_textfile('metrics/ml_validation.prom', registry)

if __name__ == '__main__':
    export_validation_metrics()
```

## For Data Scientists

### 1. Feature Importance Analysis

After each training, analyze which features matter most:

```python
# scripts/analyze_importance.py

import matplotlib.pyplot as plt
import numpy as np
from sklearn.ensemble import RandomForestClassifier
import joblib

# Load model
model = joblib.load('models/decision_model.pkl')

# Get feature importance
importance = model.feature_importances_
with open('data/processed/feature_names.txt') as f:
    features = [line.strip() for line in f]

# Sort and plot
indices = np.argsort(importance)[::-1]
top_k = 10

plt.figure(figsize=(12, 6))
plt.title(f'Top {top_k} Feature Importance')
plt.bar(range(top_k), importance[indices[:top_k]])
plt.xticks(range(top_k), 
           [features[i] for i in indices[:top_k]], 
           rotation=45, ha='right')
plt.ylabel('Importance')
plt.tight_layout()
plt.savefig('reports/feature_importance.png')

print("Feature Importance Ranking:")
for i in range(min(top_k, len(features))):
    feat_idx = indices[i]
    print(f"  {i+1}. {features[feat_idx]}: {importance[feat_idx]:.4f}")
```

### 2. Hyperparameter Tuning

Improve model performance with systematic tuning:

```python
# scripts/hyperparameter_tuning.py

from sklearn.model_selection import GridSearchCV
from sklearn.ensemble import RandomForestClassifier
import joblib

# Load training data
X_train = pd.read_csv('data/processed/X_train.csv')
y_train = pd.read_csv('data/processed/y_train.csv').values.ravel()

# Define parameter grid
param_grid = {
    'n_estimators': [50, 100, 200],
    'max_depth': [5, 10, 15, None],
    'min_samples_split': [2, 5, 10],
    'min_samples_leaf': [1, 2, 4],
}

# Grid search
rf = RandomForestClassifier(random_state=42, n_jobs=-1)
grid_search = GridSearchCV(
    rf, param_grid, 
    cv=3,
    scoring='f1_weighted',
    n_jobs=-1,
    verbose=1
)

grid_search.fit(X_train, y_train)

print(f"Best parameters: {grid_search.best_params_}")
print(f"Best CV score: {grid_search.best_score_:.4f}")

# Save best model
joblib.dump(
    grid_search.best_estimator_, 
    'models/decision_model_tuned.pkl'
)
```

## Validation Checklist

Before deploying a model to production, verify:

- [ ] **Data Quality**
  - [ ] ≥50 samples total
  - [ ] ≥10 samples per class
  - [ ] No missing features
  - [ ] Feature distributions reasonable

- [ ] **Training**
  - [ ] No errors during training
  - [ ] Model weights not NaN/Inf
  - [ ] ONNX export successful
  - [ ] Model loads without errors

- [ ] **Validation**
  - [ ] No overfitting (difference < 0.30)
  - [ ] Test accuracy ≥ 0.70
  - [ ] Precision/recall balanced
  - [ ] CV stable (std < 20% of mean)

- [ ] **Monitoring**
  - [ ] Health check endpoint working
  - [ ] Metrics exported to Prometheus
  - [ ] Alerts configured
  - [ ] Dashboard displays correctly

- [ ] **Documentation**
  - [ ] Feature dictionary updated
  - [ ] Model performance documented
  - [ ] Known limitations listed
  - [ ] Deployment notes recorded

## Emergency Procedures

### Model Rollback
If model degrades in production:

```bash
# 1. Identify issue
aws s3 cp s3://metabrain-models/current/metrics.json ./

# 2. Check previous version
aws s3 cp s3://metabrain-models/archive/decision_model_v1.onnx ./

# 3. Deploy previous version
aws lambda update-function-code \
  --function-name metabrain-ml-predictor \
  --s3-bucket metabrain-models \
  --s3-key archive/decision_model_v1.onnx

# 4. Verify
curl https://api.metabrain.net/api/admin/ml/health
```

### Manual Retraining
If automatic retraining fails:

```bash
cd /path/to/metabrain

# 1. Collect recent data
python scripts/data_pipeline.py --data-dir data/

# 2. Train with validation
python scripts/train_model.py

# 3. Validate completely
python scripts/validate_model.py

# 4. Check monitoring
python scripts/model_monitor.py

# 5. Deploy if passes
if [ $? -eq 0 ]; then
  aws s3 cp models/decision_model.onnx \
    s3://metabrain-models/current/decision_model.onnx
fi
```

---

**Last Updated**: 2026-04-12
**Version**: 1.0
**Status**: Production Ready
