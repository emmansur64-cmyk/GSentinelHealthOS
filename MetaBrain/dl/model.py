from __future__ import annotations

from dataclasses import dataclass

import torch
import torch.nn as nn


class SequenceAutoencoder(nn.Module):
    def __init__(
        self,
        sequence_length: int,
        input_dim: int,
        latent_dim: int,
        hidden_dim: int,
        dropout: float,
    ) -> None:
        super().__init__()
        flattened_dim = sequence_length * input_dim
        self.sequence_length = sequence_length
        self.input_dim = input_dim
        self.encoder = nn.Sequential(
            nn.Linear(flattened_dim, hidden_dim),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(hidden_dim, latent_dim),
            nn.ReLU(),
        )
        self.decoder = nn.Sequential(
            nn.Linear(latent_dim, hidden_dim),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(hidden_dim, flattened_dim),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        batch_size = x.shape[0]
        flattened = x.reshape(batch_size, self.sequence_length * self.input_dim)
        latent = self.encoder(flattened)
        reconstruction = self.decoder(latent)
        return reconstruction.reshape(batch_size, self.sequence_length, self.input_dim)


@dataclass
class SequenceAutoencoderConfig:
    sequence_length: int
    input_dim: int
    latent_dim: int = 32
    hidden_dim: int = 128
    dropout: float = 0.1


class AutoencoderOnnxWrapper(nn.Module):
    def __init__(self, model: SequenceAutoencoder) -> None:
        super().__init__()
        self.model = model

    def forward(self, x: torch.Tensor) -> tuple[torch.Tensor, torch.Tensor]:
        reconstruction = self.model(x)
        squared_error = torch.square(reconstruction - x)
        flattened_error = squared_error.reshape(x.shape[0], -1)
        reconstruction_error = torch.mean(flattened_error, dim=1, keepdim=True)
        return reconstruction, reconstruction_error