"""Modelo de identidad para autenticacion OAuth2 y RBAC."""

from __future__ import annotations

import enum
from uuid import uuid4

from sqlalchemy import Boolean, CheckConstraint, Column, DateTime, Enum, ForeignKey, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from datetime import datetime

from .models import Base


class UserRole(str, enum.Enum):
    """Roles de acceso para usuarios con login."""

    ADMIN = "admin"
    DOCTOR = "doctor"
    RECEPTIONIST = "receptionist"


class ClinicMemberRole(str, enum.Enum):
    """Roles multi-tenant para operar dentro de una clinica."""

    SUPER_ADMIN = "SUPER_ADMIN"
    CLINIC_ADMIN = "CLINIC_ADMIN"
    SECRETARY = "SECRETARY"
    DOCTOR = "DOCTOR"


class Clinic(Base):
    """Clinica/tenant operativo."""

    __tablename__ = "clinics"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    client_id = Column(UUID(as_uuid=True), ForeignKey("clients.id"), nullable=True, index=True)
    name = Column(String(120), nullable=False)
    legal_name = Column(String(180), nullable=True)
    timezone = Column(String(64), nullable=False, default="UTC")
    status = Column(String(20), nullable=False, default="active")
    active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, nullable=False, default=lambda: datetime.utcnow())
    updated_at = Column(DateTime, nullable=False, default=lambda: datetime.utcnow(), onupdate=lambda: datetime.utcnow())

    client = relationship("Client", back_populates="clinics")
    members = relationship("ClinicMember", back_populates="clinic", cascade="all, delete-orphan")


class ClinicMember(Base):
    """Membresia de usuario en una clinica."""

    __tablename__ = "clinic_members"
    __table_args__ = (
        UniqueConstraint("clinic_id", "user_id", name="uq_clinic_members_clinic_user"),
        CheckConstraint(
            "role IN ('SUPER_ADMIN', 'CLINIC_ADMIN', 'SECRETARY', 'DOCTOR')",
            name="ck_clinic_members_role_valid",
        ),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    clinic_id = Column(UUID(as_uuid=True), ForeignKey("clinics.id"), nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    role = Column(
        Enum(
            ClinicMemberRole,
            values_callable=lambda enum_cls: [member.value for member in enum_cls],
            native_enum=False,
        ),
        nullable=False,
    )
    approved = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime, nullable=False, default=lambda: datetime.utcnow())
    updated_at = Column(DateTime, nullable=False, default=lambda: datetime.utcnow(), onupdate=lambda: datetime.utcnow())

    clinic = relationship("Clinic", back_populates="members")
    user = relationship("User", back_populates="clinic_members")


class User(Base):
    """Credencial de acceso para personal interno (no pacientes shadow)."""

    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    client_id = Column(UUID(as_uuid=True), ForeignKey("clients.id"), nullable=True, index=True)
    clinic_id = Column(UUID(as_uuid=True), ForeignKey("clinics.id"), nullable=True, index=True)
    username = Column(String(50), unique=True, index=True, nullable=False)
    email = Column(String(255), nullable=True, index=True)
    name = Column(String(120), nullable=True)
    auth_provider = Column(String(50), nullable=False, default="password")
    hashed_password = Column(String(255), nullable=False)
    status = Column(String(20), nullable=False, default="active")
    role = Column(
        Enum(
            UserRole,
            values_callable=lambda enum_cls: [member.value for member in enum_cls],
            native_enum=False,
        ),
        nullable=False,
        default=UserRole.DOCTOR,
    )
    is_active = Column(Boolean, default=True, nullable=False)
    active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, nullable=False, default=lambda: datetime.utcnow())
    updated_at = Column(DateTime, nullable=False, default=lambda: datetime.utcnow(), onupdate=lambda: datetime.utcnow())

    # Vinculo opcional de identidad -> entidad de dominio
    doctor_id = Column(UUID(as_uuid=True), ForeignKey("doctors.id"), nullable=True, index=True)
    client = relationship("Client", back_populates="users")
    clinic = relationship("Clinic")
    doctor = relationship("Doctor")
    clinic_members = relationship("ClinicMember", back_populates="user", cascade="all, delete-orphan")
