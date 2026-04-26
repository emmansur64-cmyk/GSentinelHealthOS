"""Modelo de identidad para autenticacion OAuth2 y RBAC."""

from __future__ import annotations

import enum
from uuid import uuid4

from sqlalchemy import Boolean, Column, Enum, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from .models import Base


class UserRole(str, enum.Enum):
    """Roles de acceso para usuarios con login."""

    ADMIN = "admin"
    DOCTOR = "doctor"
    RECEPTIONIST = "receptionist"


class User(Base):
    """Credencial de acceso para personal interno (no pacientes shadow)."""

    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    username = Column(String(50), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
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

    # Vinculo opcional de identidad -> entidad de dominio
    doctor_id = Column(UUID(as_uuid=True), ForeignKey("doctors.id"), nullable=True, index=True)
    doctor = relationship("Doctor")
