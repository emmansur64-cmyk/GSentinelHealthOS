"""Cifrado simétrico de secretos para credenciales por cliente."""

from __future__ import annotations

import base64
import hashlib
import os

from cryptography.fernet import Fernet, InvalidToken


class SecretEncryptionError(RuntimeError):
    """Error de cifrado/descifrado de secretos."""


class MissingSecretEncryptionKeyError(SecretEncryptionError):
    """Se intentó operar sin SECRET_ENCRYPTION_KEY configurada."""


def is_secret_encryption_key_configured() -> bool:
    key = os.getenv("SECRET_ENCRYPTION_KEY", "").strip()
    return bool(key)


def _build_fernet_key(raw_key: str) -> bytes:
    """Normaliza SECRET_ENCRYPTION_KEY a formato URL-safe base64 de 32 bytes."""
    normalized = raw_key.strip()
    if not normalized:
        raise MissingSecretEncryptionKeyError("SECRET_ENCRYPTION_KEY no configurada")

    # Si ya es una clave Fernet válida, usarla tal cual.
    try:
        candidate = normalized.encode("utf-8")
        Fernet(candidate)
        return candidate
    except Exception:
        pass

    digest = hashlib.sha256(normalized.encode("utf-8")).digest()
    return base64.urlsafe_b64encode(digest)


def _fernet() -> Fernet:
    key = os.getenv("SECRET_ENCRYPTION_KEY", "")
    try:
        return Fernet(_build_fernet_key(key))
    except MissingSecretEncryptionKeyError:
        raise
    except Exception as exc:
        raise SecretEncryptionError(f"No se pudo inicializar cifrado de secretos: {exc}") from exc


def encrypt_secret(value: str) -> str:
    """Cifra un secreto para persistencia."""
    if value is None:
        raise SecretEncryptionError("No se puede cifrar un secreto nulo")

    secret = value.strip()
    if not secret:
        raise SecretEncryptionError("No se puede cifrar un secreto vacío")

    try:
        return _fernet().encrypt(secret.encode("utf-8")).decode("utf-8")
    except MissingSecretEncryptionKeyError:
        raise
    except Exception as exc:
        raise SecretEncryptionError(f"Error cifrando secreto: {exc}") from exc


def decrypt_secret(value: str) -> str:
    """Descifra un secreto persistido."""
    if value is None:
        raise SecretEncryptionError("No se puede descifrar un secreto nulo")

    encrypted = value.strip()
    if not encrypted:
        raise SecretEncryptionError("No se puede descifrar un secreto vacío")

    try:
        decrypted = _fernet().decrypt(encrypted.encode("utf-8"))
    except MissingSecretEncryptionKeyError:
        raise
    except InvalidToken as exc:
        raise SecretEncryptionError("Token cifrado inválido o clave incorrecta") from exc
    except Exception as exc:
        raise SecretEncryptionError(f"Error descifrando secreto: {exc}") from exc

    return decrypted.decode("utf-8")
