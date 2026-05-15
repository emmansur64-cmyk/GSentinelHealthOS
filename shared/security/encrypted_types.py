"""Tipos SQLAlchemy para cifrado transparente de campos sensibles."""

from __future__ import annotations

from sqlalchemy import Text
from sqlalchemy.types import TypeDecorator

from shared.security.secrets import SecretEncryptionError, decrypt_secret, encrypt_secret


class EncryptedText(TypeDecorator):
    """Cifra al persistir y descifra al leer.

    Si encuentra datos legacy en claro, los devuelve sin romper lectura.
    """

    impl = Text
    cache_ok = True

    @staticmethod
    def _looks_encrypted(value: str) -> bool:
        # Tokens Fernet suelen comenzar con gAAAAA
        return value.startswith("gAAAA")

    def process_bind_param(self, value: str | None, dialect):
        if value is None:
            return None

        raw = value.strip()
        if not raw:
            return None

        if self._looks_encrypted(raw):
            try:
                decrypt_secret(raw)
                return raw
            except SecretEncryptionError:
                pass

        return encrypt_secret(raw)

    def process_result_value(self, value: str | None, dialect):
        if value is None:
            return None

        raw = value.strip()
        if not raw:
            return None

        try:
            return decrypt_secret(raw)
        except SecretEncryptionError:
            # Compatibilidad con filas legacy no cifradas.
            return raw
