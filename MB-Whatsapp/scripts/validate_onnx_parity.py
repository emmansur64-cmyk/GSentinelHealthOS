import json
import time
import numpy as np
import pandas as pd
import joblib
import onnxruntime as rt


def main():
    X_test = pd.read_csv('data/processed/X_test.csv')

    sklearn_model = joblib.load('models/decision_model.pkl')
    onnx_session = rt.InferenceSession('models/decision_model.onnx')
    input_name = onnx_session.get_inputs()[0].name

    # sklearn predictions
    sk_start = time.perf_counter()
    sk_pred = sklearn_model.predict(X_test)
    sk_ms = (time.perf_counter() - sk_start) * 1000

    # ONNX predictions
    onnx_input = X_test.astype(np.float32).to_numpy()
    ox_start = time.perf_counter()
    outputs = onnx_session.run(None, {input_name: onnx_input})
    ox_ms = (time.perf_counter() - ox_start) * 1000

    # Try to extract labels from ONNX outputs.
    # skl2onnx typically emits label tensor as first output.
    onnx_label = outputs[0]
    onnx_pred = np.array(onnx_label).reshape(-1)

    parity = float((onnx_pred == sk_pred).mean())
    latency_per_sample_ms = ox_ms / max(1, len(X_test))

    report = {
        'num_samples': int(len(X_test)),
        'parity_rate': parity,
        'sklearn_total_ms': sk_ms,
        'onnx_total_ms': ox_ms,
        'onnx_latency_per_sample_ms': latency_per_sample_ms,
        'target_latency_ms': 5.0,
        'target_met': latency_per_sample_ms < 5.0,
    }

    with open('models/onnx_parity_report.json', 'w') as f:
        json.dump(report, f, indent=2)

    print('ONNX parity validation complete')
    print(json.dumps(report, indent=2))


if __name__ == '__main__':
    main()
