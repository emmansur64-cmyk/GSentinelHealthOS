from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np
import torch
import torch.nn as nn
from sklearn.model_selection import train_test_split

from model import AutoencoderOnnxWrapper, SequenceAutoencoder, SequenceAutoencoderConfig


def load_dataset(data_dir: Path) -> tuple[np.ndarray, np.ndarray, dict]:
    sequences_path = data_dir / 'X_sequences.npy'
    normal_mask_path = data_dir / 'normal_mask.npy'
    metadata_path = data_dir / 'sequence_metadata.json'

    if not sequences_path.exists() or not normal_mask_path.exists() or not metadata_path.exists():
        raise FileNotFoundError(
            'Expected X_sequences.npy, normal_mask.npy and sequence_metadata.json. '
            'Run scripts/build_sequence_dataset.py first.'
        )

    sequences = np.load(sequences_path).astype(np.float32)
    normal_mask = np.load(normal_mask_path).astype(bool)
    with metadata_path.open('r', encoding='utf-8') as handle:
        metadata = json.load(handle)
    return sequences, normal_mask, metadata


def normalize_sequences(
    train_sequences: np.ndarray,
    all_sequences: np.ndarray,
) -> tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
    means = train_sequences.reshape(-1, train_sequences.shape[-1]).mean(axis=0)
    stds = train_sequences.reshape(-1, train_sequences.shape[-1]).std(axis=0)
    stds = np.where(stds < 1e-6, 1.0, stds)
    train_normalized = ((train_sequences - means) / stds).astype(np.float32)
    all_normalized = ((all_sequences - means) / stds).astype(np.float32)
    return train_normalized, all_normalized, means.astype(np.float32), stds.astype(np.float32)


def reconstruction_errors(model: SequenceAutoencoder, sequences: np.ndarray) -> np.ndarray:
    model.eval()
    with torch.no_grad():
        tensor = torch.from_numpy(sequences)
        reconstruction = model(tensor)
        errors = torch.mean((reconstruction - tensor) ** 2, dim=(1, 2))
    return errors.cpu().numpy()


def train_epoch(
    model: SequenceAutoencoder,
    optimizer: torch.optim.Optimizer,
    criterion: nn.Module,
    train_tensor: torch.Tensor,
    batch_size: int,
) -> float:
    model.train()
    permutation = torch.randperm(train_tensor.shape[0])
    total_loss = 0.0

    for start in range(0, train_tensor.shape[0], batch_size):
        indices = permutation[start : start + batch_size]
        batch = train_tensor[indices]
        optimizer.zero_grad()
        reconstruction = model(batch)
        loss = criterion(reconstruction, batch)
        loss.backward()
        optimizer.step()
        total_loss += float(loss.item()) * float(batch.shape[0])

    return total_loss / float(train_tensor.shape[0])


def evaluate_loss(model: SequenceAutoencoder, criterion: nn.Module, data_tensor: torch.Tensor) -> float:
    model.eval()
    with torch.no_grad():
        reconstruction = model(data_tensor)
        loss = criterion(reconstruction, data_tensor)
    return float(loss.item())


def train(args: argparse.Namespace) -> None:
    np.random.seed(args.seed)
    torch.manual_seed(args.seed)

    data_dir = Path(args.data_dir)
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    sequences, normal_mask, dataset_metadata = load_dataset(data_dir)
    normal_sequences = sequences[normal_mask]
    anomalous_sequences = sequences[~normal_mask]

    if len(normal_sequences) < 10:
        raise ValueError('Need at least 10 normal sequences to train the autoencoder')

    train_sequences, val_sequences = train_test_split(
        normal_sequences,
        test_size=args.validation_split,
        random_state=args.seed,
        shuffle=True,
    )

    train_normalized, all_normalized, feature_means, feature_stds = normalize_sequences(
        train_sequences,
        sequences,
    )
    val_normalized = ((val_sequences - feature_means) / feature_stds).astype(np.float32)

    config = SequenceAutoencoderConfig(
        sequence_length=int(sequences.shape[1]),
        input_dim=int(sequences.shape[2]),
        latent_dim=args.latent_dim,
        hidden_dim=args.hidden_dim,
        dropout=args.dropout,
    )
    model = SequenceAutoencoder(
        sequence_length=config.sequence_length,
        input_dim=config.input_dim,
        latent_dim=config.latent_dim,
        hidden_dim=config.hidden_dim,
        dropout=config.dropout,
    )

    train_tensor = torch.from_numpy(train_normalized)
    val_tensor = torch.from_numpy(val_normalized)
    criterion = nn.MSELoss()
    optimizer = torch.optim.Adam(model.parameters(), lr=args.lr)

    best_val_loss = float('inf')
    best_state: dict[str, torch.Tensor] | None = None

    for epoch in range(args.epochs):
        train_loss = train_epoch(model, optimizer, criterion, train_tensor, args.batch_size)
        val_loss = evaluate_loss(model, criterion, val_tensor)

        if val_loss < best_val_loss:
            best_val_loss = val_loss
            best_state = {name: parameter.detach().cpu().clone() for name, parameter in model.state_dict().items()}

        if (epoch + 1) % 10 == 0 or epoch == 0:
            print(f'epoch={epoch + 1} train_loss={train_loss:.6f} val_loss={val_loss:.6f}')

    if best_state is not None:
        model.load_state_dict(best_state)

    train_errors = reconstruction_errors(model, train_normalized)
    val_errors = reconstruction_errors(model, val_normalized)
    threshold = float(np.quantile(train_errors, args.threshold_percentile / 100.0))

    all_errors = reconstruction_errors(model, all_normalized)
    normal_errors = all_errors[normal_mask]
    anomaly_errors = all_errors[~normal_mask] if np.any(~normal_mask) else np.asarray([], dtype=np.float32)
    false_positive_rate = float(np.mean(normal_errors > threshold)) if len(normal_errors) else 0.0
    true_positive_rate = float(np.mean(anomaly_errors > threshold)) if len(anomaly_errors) else 0.0

    torch.save(model.state_dict(), output_dir / 'anomaly_model.pt')

    wrapper = AutoencoderOnnxWrapper(model)
    dummy = torch.randn(1, config.sequence_length, config.input_dim, dtype=torch.float32)
    torch.onnx.export(
        wrapper,
        dummy,
        output_dir / 'anomaly_model.onnx',
        input_names=['sequence_input'],
        output_names=['reconstruction', 'reconstruction_error'],
        dynamic_axes={
            'sequence_input': {0: 'batch'},
            'reconstruction': {0: 'batch'},
            'reconstruction_error': {0: 'batch'},
        },
        opset_version=17,
    )

    metadata = {
        'model_type': 'sequence_autoencoder',
        'sequence_length': config.sequence_length,
        'feature_columns': dataset_metadata.get('feature_columns', []),
        'anomaly_threshold': threshold,
        'threshold_percentile': args.threshold_percentile,
        'feature_means': feature_means.tolist(),
        'feature_stds': feature_stds.tolist(),
        'latent_dim': config.latent_dim,
        'hidden_dim': config.hidden_dim,
        'dropout': config.dropout,
        'training_stats': {
            'num_sequences': int(sequences.shape[0]),
            'normal_sequences': int(np.sum(normal_mask)),
            'anomalous_sequences': int(np.sum(~normal_mask)),
            'train_normal_sequences': int(train_sequences.shape[0]),
            'val_normal_sequences': int(val_sequences.shape[0]),
            'val_loss': float(best_val_loss),
            'train_error_mean': float(np.mean(train_errors)),
            'train_error_p95': float(np.quantile(train_errors, 0.95)),
            'val_error_mean': float(np.mean(val_errors)),
            'normal_error_mean': float(np.mean(normal_errors)) if len(normal_errors) else 0.0,
            'anomaly_error_mean': float(np.mean(anomaly_errors)) if len(anomaly_errors) else 0.0,
            'false_positive_rate': false_positive_rate,
            'true_positive_rate': true_positive_rate,
        },
    }

    with (output_dir / 'anomaly_model_metadata.json').open('w', encoding='utf-8') as handle:
        json.dump(metadata, handle, indent=2)

    print('DL anomaly autoencoder training complete')
    print(json.dumps(metadata['training_stats'], indent=2))


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description='Train sequential anomaly autoencoder')
    parser.add_argument('--data-dir', default='data/processed', help='Directory with X_sequences.npy and normal_mask.npy')
    parser.add_argument('--output-dir', default='models', help='Directory for anomaly_model.onnx artifacts')
    parser.add_argument('--latent-dim', type=int, default=32)
    parser.add_argument('--hidden-dim', type=int, default=128)
    parser.add_argument('--dropout', type=float, default=0.1)
    parser.add_argument('--epochs', type=int, default=80)
    parser.add_argument('--lr', type=float, default=1e-3)
    parser.add_argument('--batch-size', type=int, default=32)
    parser.add_argument('--validation-split', type=float, default=0.2)
    parser.add_argument('--threshold-percentile', type=float, default=95.0)
    parser.add_argument('--seed', type=int, default=42)
    return parser.parse_args()


if __name__ == '__main__':
    train(parse_args())
