"""Ed25519 verification with public key material held outside knowledge releases."""

import base64
from pathlib import Path

from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey

SIGNATURE_DOMAIN = b"clinical-kernel-knowledge-manifest/v1:"


class Ed25519KnowledgeVerifier:
    """Loads a PEM public key from an external, operator-controlled path."""

    def __init__(self, public_key_path: str | Path) -> None:
        self._public_key_path = Path(public_key_path).resolve()

    def verify(self, *, manifest_hash: str, signature: str) -> bool:
        try:
            key = serialization.load_pem_public_key(self._public_key_path.read_bytes())
            if not isinstance(key, Ed25519PublicKey):
                return False
            key.verify(
                base64.b64decode(signature, validate=True),
                SIGNATURE_DOMAIN + manifest_hash.encode("ascii"),
            )
            return True
        except (OSError, ValueError, TypeError, InvalidSignature):
            return False
