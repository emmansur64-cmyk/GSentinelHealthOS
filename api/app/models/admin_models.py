"""Modelos SQLAlchemy para el Panel Super-Admin: audit logs y feature flags."""

from __future__ import annotations

from datetime import datetime
from uuid import uuid4

from sqlalchemy import Boolean, Column, DateTime, Index, String, Text
from sqlalchemy.dialects.postgresql import UUID

from .models import Base


class AdminAuditLog(Base):
    """Registro inmutable de acciones administrativas realizadas desde el Panel."""

    __tablename__ = "admin_audit_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    timestamp = Column(DateTime, nullable=False, default=lambda: datetime.utcnow())

    # Actor (quién ejecutó la acción — nunca guardar tokens ni passwords)
    actor_id = Column(String(255), nullable=False)
    actor_email = Column(String(255), nullable=False)
    actor_role = Column(String(64), nullable=False)

    # Acción
    action = Column(String(64), nullable=False)
    resource_type = Column(String(64), nullable=True)
    resource_id = Column(String(255), nullable=True)
    status = Column(String(20), nullable=False, server_default="success")

    # Contexto sanitizado (sin PHI, sin tokens, tamaño acotado)
    metadata_json = Column(Text, nullable=True)
    request_id = Column(String(128), nullable=True)
    ip_hash = Column(String(64), nullable=True)  # SHA-256 opcional de la IP del actor

    __table_args__ = (
        Index("ix_admin_audit_logs_timestamp", "timestamp"),
        Index("ix_admin_audit_logs_actor_id", "actor_id"),
        Index("ix_admin_audit_logs_action", "action"),
    )


class FeatureFlag(Base):
    """Flag de funcionalidad gestionado desde el Panel Super-Admin."""

    __tablename__ = "feature_flags"

    # Clave natural — el nombre del flag es su PK
    key = Column(String(128), primary_key=True)
    label = Column(String(128), nullable=False)
    description = Column(Text, nullable=True)
    enabled = Column(Boolean, nullable=False, server_default="true")
    scope = Column(String(32), nullable=False, server_default="global")
    module = Column(String(64), nullable=True)
    updated_by = Column(String(255), nullable=True)
    updated_at = Column(
        DateTime,
        nullable=False,
        default=lambda: datetime.utcnow(),
        onupdate=lambda: datetime.utcnow(),
    )
