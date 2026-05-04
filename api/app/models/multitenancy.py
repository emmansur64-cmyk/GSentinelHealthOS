"""Modelos de soporte multicliente (tenant + credenciales WhatsApp)."""

from __future__ import annotations

from datetime import datetime
from uuid import uuid4

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from .models import Base


class Client(Base):
    """Tenant principal del sistema."""

    __tablename__ = "clients"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    name = Column(String(120), nullable=False)
    slug = Column(String(120), nullable=False, unique=True, index=True)
    status = Column(String(20), nullable=False, default="active", index=True)
    created_at = Column(DateTime, nullable=False, default=lambda: datetime.utcnow())
    updated_at = Column(DateTime, nullable=False, default=lambda: datetime.utcnow(), onupdate=lambda: datetime.utcnow())

    clinics = relationship("Clinic", back_populates="client")
    users = relationship("User", back_populates="client")
    whatsapp_accounts = relationship("ClientWhatsAppAccount", back_populates="client", cascade="all, delete-orphan")


class ClientWhatsAppAccount(Base):
    """Credenciales WhatsApp por cliente (multi-account)."""

    __tablename__ = "client_whatsapp_accounts"
    __table_args__ = (
        UniqueConstraint("phone_number_id", name="uq_client_whatsapp_phone_number_id"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    client_id = Column(UUID(as_uuid=True), ForeignKey("clients.id", ondelete="CASCADE"), nullable=False, index=True)
    clinic_id = Column(UUID(as_uuid=True), ForeignKey("clinics.id", ondelete="CASCADE"), nullable=True, index=True)

    provider = Column(String(32), nullable=False, default="meta")
    phone_number = Column(String(32), nullable=True)
    phone_number_id = Column(String(80), nullable=False, index=True)
    business_account_id = Column(String(80), nullable=True)
    meta_business_id = Column(String(80), nullable=True)
    waba_id = Column(String(80), nullable=True)
    display_phone_number = Column(String(32), nullable=True)

    access_token_encrypted = Column(Text, nullable=True)
    app_secret_encrypted = Column(Text, nullable=True)
    verify_token = Column(String(255), nullable=True)

    webhook_enabled = Column(Boolean, nullable=False, default=True)
    status = Column(String(20), nullable=False, default="active", index=True)
    created_at = Column(DateTime, nullable=False, default=lambda: datetime.utcnow())
    updated_at = Column(DateTime, nullable=False, default=lambda: datetime.utcnow(), onupdate=lambda: datetime.utcnow())

    client = relationship("Client", back_populates="whatsapp_accounts")
