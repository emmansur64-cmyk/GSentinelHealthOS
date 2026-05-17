"""Modelos SQLAlchemy para la API."""

from datetime import datetime
from uuid import uuid4
from sqlalchemy import Column, String, DateTime, ForeignKey, Boolean, Text, Integer, JSON, Index, UniqueConstraint, CheckConstraint, event
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import declarative_base, relationship
from shared.security.encrypted_types import EncryptedText
from shared.security.secrets import hash_phone, normalize_phone

Base = declarative_base()


class PatientConsent(Base):
    """Registro de consentimiento informado del paciente.

    Requisito RGPD art. 6 / HIPAA §164.508. Una fila por (paciente, tipo_consentimiento).
    El retiro del consentimiento (GDPR right-to-withdraw) se registra en withdrawn_at;
    nunca se borra el registro histórico para mantener la trazabilidad.
    """

    __tablename__ = "patient_consents"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    patient_id = Column(UUID(as_uuid=True), ForeignKey("patients.id", ondelete="RESTRICT"), nullable=False, index=True)
    clinic_id = Column(UUID(as_uuid=True), ForeignKey("clinics.id"), nullable=True, index=True)
    client_id = Column(UUID(as_uuid=True), ForeignKey("clients.id"), nullable=True, index=True)

    # Tipo: data_processing | clinical_history | whatsapp_communications | ai_processing
    consent_type = Column(String(64), nullable=False)
    # Versión del texto de política en vigor al momento del consentimiento
    policy_version = Column(String(32), nullable=False, default="1.0")
    # Canal por el que se otorgó: web | whatsapp | presencial | api
    channel = Column(String(32), nullable=False, default="web")

    given_at = Column(DateTime, nullable=False, default=lambda: datetime.utcnow())
    # NULL = consentimiento activo; NOT NULL = revocado
    withdrawn_at = Column(DateTime, nullable=True)
    withdrawn_reason = Column(String(255), nullable=True)

    created_at = Column(DateTime, nullable=False, default=lambda: datetime.utcnow())

    __table_args__ = (
        UniqueConstraint("patient_id", "consent_type", "policy_version", name="uq_patient_consent_type_version"),
        Index("ix_patient_consents_patient_id", "patient_id"),
        Index("ix_patient_consents_clinic_id", "clinic_id"),
        Index("ix_patient_consents_given_at", "given_at"),
        CheckConstraint(
            "consent_type IN ('data_processing','clinical_history','whatsapp_communications','ai_processing')",
            name="ck_patient_consents_type_valid",
        ),
    )


class PatientAccessLog(Base):
    """Audit trail de acceso a datos PHI de pacientes.

    Registro inmutable: cada lectura, escritura o borrado de datos PHI queda
    trazado con quién accedió, desde qué contexto y con qué intención.
    Cumple HIPAA §164.312(b) y RGPD art. 30 (Registro de actividades de tratamiento).
    """

    __tablename__ = "patient_access_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    timestamp = Column(DateTime, nullable=False, default=lambda: datetime.utcnow(), index=True)

    # Recurso accedido
    patient_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    clinic_id = Column(UUID(as_uuid=True), nullable=True, index=True)
    client_id = Column(UUID(as_uuid=True), nullable=True)

    # Actor — NUNCA guardar datos de sesión completos
    accessor_id = Column(String(255), nullable=False)   # user_id o "system/gateway"
    accessor_role = Column(String(64), nullable=True)   # doctor | admin | gateway | api

    # Operación: read | list | create | update | delete | export | search
    access_type = Column(String(32), nullable=False)
    # Contexto de la operación (ruta, endpoint, servicio origen)
    resource_path = Column(String(255), nullable=True)
    # ID de trazabilidad del request (correlación con logs de observabilidad)
    request_id = Column(String(128), nullable=True)
    # Estado final del acceso
    success = Column(Boolean, nullable=False, default=True)
    # Motivo si falló
    failure_reason = Column(String(255), nullable=True)

    __table_args__ = (
        Index("ix_patient_access_logs_timestamp", "timestamp"),
        Index("ix_patient_access_logs_patient_id", "patient_id"),
        Index("ix_patient_access_logs_accessor_id", "accessor_id"),
        CheckConstraint(
            "access_type IN ('read','list','create','update','delete','export','search')",
            name="ck_patient_access_logs_type_valid",
        ),
    )


class Patient(Base):
    """Modelo de paciente."""
    
    __tablename__ = "patients"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    client_id = Column(UUID(as_uuid=True), ForeignKey("clients.id"), nullable=True, index=True)
    clinic_id = Column(UUID(as_uuid=True), ForeignKey("clinics.id"), nullable=True, index=True)
    name = Column(String(100), nullable=False)
    full_name = Column(String(255), nullable=True)
    dni = Column(EncryptedText(), nullable=True, index=True)
    phone = Column(EncryptedText(), nullable=False)
    phone_hash = Column(String(64), nullable=False, unique=True, index=True)
    email = Column(String(255), nullable=True, unique=True, index=True)
    age = Column(Integer, nullable=True)
    
    # Auditoría
    created_at = Column(DateTime, nullable=False, default=lambda: datetime.utcnow())
    updated_at = Column(DateTime, nullable=False, default=lambda: datetime.utcnow(), onupdate=lambda: datetime.utcnow())
    # Soft-delete: NULL = activo; NOT NULL = borrado (derecho al olvido RGPD art.17)
    deleted_at = Column(DateTime, nullable=True, index=True)

    # Relaciones
    appointments = relationship("Appointment", back_populates="patient", cascade="all, delete-orphan")


class Doctor(Base):
    """Modelo de doctor."""
    
    __tablename__ = "doctors"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    client_id = Column(UUID(as_uuid=True), ForeignKey("clients.id"), nullable=True, index=True)
    clinic_id = Column(UUID(as_uuid=True), ForeignKey("clinics.id"), nullable=True, index=True)
    name = Column(String(100), nullable=False)
    specialization = Column(String(100), nullable=False)
    status = Column(String(20), nullable=False, default="active", index=True)
    email = Column(String(255), nullable=False, unique=True, index=True)
    phone = Column(String(20), nullable=True)  # Teléfono del doctor
    buffer_before_minutes = Column(Integer, nullable=False, default=0)
    buffer_after_minutes = Column(Integer, nullable=False, default=0)
    
    # Control de disponibilidad
    is_active = Column(Boolean, default=True, nullable=False)
    
    # Auditoría
    created_at = Column(DateTime, nullable=False, default=lambda: datetime.utcnow())
    updated_at = Column(DateTime, nullable=False, default=lambda: datetime.utcnow(), onupdate=lambda: datetime.utcnow())
    
    # Relaciones
    appointments = relationship("Appointment", back_populates="doctor", cascade="all, delete-orphan")

    @property
    def specialty(self) -> str:
        """Alias de compatibilidad para código que usa `specialty`."""
        return self.specialization

    @specialty.setter
    def specialty(self, value: str) -> None:
        self.specialization = value


class Appointment(Base):
    """Modelo de cita médica con control de conflictos."""
    
    __tablename__ = "appointments"
    __table_args__ = (
        UniqueConstraint("doctor_id", "date_time", name="uq_appointments_doctor_date_time"),
        CheckConstraint(
            "google_sync_status IN ('pending', 'synced', 'failed')",
            name="ck_appointments_google_sync_status_valid",
        ),
    )
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    client_id = Column(UUID(as_uuid=True), ForeignKey("clients.id"), nullable=True, index=True)
    clinic_id = Column(UUID(as_uuid=True), ForeignKey("clinics.id"), nullable=True, index=True)
    
    # Relaciones
    doctor_id = Column(UUID(as_uuid=True), ForeignKey("doctors.id"), nullable=False, index=True)
    patient_id = Column(UUID(as_uuid=True), ForeignKey("patients.id"), nullable=False, index=True)
    
    # Datos de cita
    date_time = Column(DateTime, nullable=False, index=True)  # Hora exacta
    reason = Column(EncryptedText(), nullable=True)
    specialty = Column(String(120), nullable=True, index=True)
    source = Column(String(50), nullable=True, index=True)
    whatsapp_conversation_id = Column(String(120), nullable=True, index=True)
    patient_full_name = Column(String(255), nullable=True)
    patient_dni = Column(EncryptedText(), nullable=True)
    patient_phone = Column(EncryptedText(), nullable=True)
    patient_email = Column(String(255), nullable=True)
    patient_age = Column(Integer, nullable=True)
    
    # Estado
    status = Column(String(20), nullable=False, default="scheduled")  # scheduled, completed, cancelled
    
    # Notas
    notes = Column(EncryptedText(), nullable=True)

    # Integracion Google Calendar
    google_event_id = Column(String(255), nullable=True, unique=True, index=True)
    google_sync_status = Column(String(20), nullable=False, default="pending", index=True)
    
    # Control de conflictos (para detectar solapamientos)
    duration_minutes = Column(String(10), default="30", nullable=False)  # 30, 60 min, etc.
    
    # Auditoría
    created_at = Column(DateTime, nullable=False, default=lambda: datetime.utcnow())
    updated_at = Column(DateTime, nullable=False, default=lambda: datetime.utcnow(), onupdate=lambda: datetime.utcnow())
    created_by = Column(String(50), nullable=True)  # "gateway", "dashboard", "api"
    # Soft-delete: NULL = activa; NOT NULL = cancelada/borrada por derecho al olvido
    deleted_at = Column(DateTime, nullable=True, index=True)

    # Relaciones
    doctor = relationship("Doctor", back_populates="appointments")
    patient = relationship("Patient", back_populates="appointments")

    @property
    def appointment_datetime(self):
        """Alias de compatibilidad con nomenclatura slot-based."""
        return self.date_time

    @appointment_datetime.setter
    def appointment_datetime(self, value) -> None:
        self.date_time = value


class IdempotencyRecord(Base):
    """Resultado persistido de requests con Idempotency-Key."""

    __tablename__ = "idempotency_records"
    __table_args__ = (
        UniqueConstraint("idempotency_key", "http_method", "request_path", name="uq_idempotency_key_method_path"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    idempotency_key = Column(String(255), nullable=False, index=True)
    http_method = Column(String(16), nullable=False)
    request_path = Column(String(255), nullable=False)
    status_code = Column(Integer, nullable=True)
    content_type = Column(String(120), nullable=True)
    response_body = Column(Text, nullable=True)
    is_completed = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime, nullable=False, default=lambda: datetime.utcnow())
    updated_at = Column(DateTime, nullable=False, default=lambda: datetime.utcnow(), onupdate=lambda: datetime.utcnow())


class NotificationOutbox(Base):
    """Outbox transaccional para notificaciones externas (n8n/WhatsApp)."""

    __tablename__ = "notification_outbox"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    client_id = Column(UUID(as_uuid=True), ForeignKey("clients.id"), nullable=True, index=True)
    clinic_id = Column(UUID(as_uuid=True), ForeignKey("clinics.id"), nullable=True, index=True)
    event_type = Column(String(100), nullable=False, index=True)
    aggregate_type = Column(String(50), nullable=False, default="appointment")
    aggregate_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    payload = Column(JSON, nullable=False)
    status = Column(String(20), nullable=False, default="pending", index=True)
    attempts = Column(Integer, nullable=False, default=0)
    next_attempt_at = Column(DateTime, nullable=False, default=lambda: datetime.utcnow(), index=True)
    last_error = Column(Text, nullable=True)
    sent_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, nullable=False, default=lambda: datetime.utcnow())
    updated_at = Column(DateTime, nullable=False, default=lambda: datetime.utcnow(), onupdate=lambda: datetime.utcnow())


class GoogleOutbox(Base):
    """Outbox transaccional dedicado para acciones Google Calendar."""

    __tablename__ = "google_outbox"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    client_id = Column(UUID(as_uuid=True), ForeignKey("clients.id"), nullable=True, index=True)
    clinic_id = Column(UUID(as_uuid=True), ForeignKey("clinics.id"), nullable=True, index=True)
    appointment_id = Column(UUID(as_uuid=True), ForeignKey("appointments.id", ondelete="CASCADE"), nullable=False, index=True)
    action = Column(String(20), nullable=False, index=True)
    payload = Column(JSON, nullable=False)
    status = Column(String(20), nullable=False, default="pending", index=True)
    retries = Column(Integer, nullable=False, default=0)
    next_attempt_at = Column(DateTime, nullable=False, default=lambda: datetime.utcnow(), index=True)
    idempotency_key = Column(String(255), nullable=False, unique=True, index=True)
    last_error = Column(Text, nullable=True)
    processed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, nullable=False, default=lambda: datetime.utcnow())
    updated_at = Column(DateTime, nullable=False, default=lambda: datetime.utcnow(), onupdate=lambda: datetime.utcnow())

    __table_args__ = (
        CheckConstraint("action IN ('create', 'update', 'delete')", name="ck_google_outbox_action_valid"),
        CheckConstraint("status IN ('pending', 'processing', 'done', 'failed')", name="ck_google_outbox_status_valid"),
        Index("idx_google_outbox_status_next", "status", "next_attempt_at"),
    )


class GoogleCalendarChannel(Base):
    """Canal de watch para webhooks de Google Calendar."""

    __tablename__ = "google_calendar_channels"

    channel_id = Column(String(128), primary_key=True, nullable=False)
    resource_id = Column(String(255), nullable=False, index=True)
    calendar_id = Column(String(255), nullable=False, default="primary")
    webhook_token = Column(String(255), nullable=False)
    status = Column(String(20), nullable=False, default="active", index=True)
    expiration = Column(DateTime, nullable=True)
    last_sync_token = Column(Text, nullable=True)
    last_notification_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, nullable=False, default=lambda: datetime.utcnow())
    updated_at = Column(DateTime, nullable=False, default=lambda: datetime.utcnow(), onupdate=lambda: datetime.utcnow())


@event.listens_for(Patient, "before_insert")
def _patient_before_insert(_mapper, _connection, target) -> None:
    if target.phone:
        normalized = normalize_phone(target.phone)
        target.phone = normalized
        target.phone_hash = hash_phone(normalized)


@event.listens_for(Patient, "before_update")
def _patient_before_update(_mapper, _connection, target) -> None:
    if target.phone:
        normalized = normalize_phone(target.phone)
        target.phone = normalized
        target.phone_hash = hash_phone(normalized)


class BotLesson(Base):
    """Modelo de lección para el aprendizaje continuo del bot."""
    
    __tablename__ = "bot_knowledge_base"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    client_id = Column(UUID(as_uuid=True), ForeignKey("clients.id"), nullable=True, index=True)
    clinic_id = Column(UUID(as_uuid=True), ForeignKey("clinics.id"), nullable=True, index=True)
    
    # Patrón que el usuario dijo mal
    pattern = Column(String(200), nullable=False, index=True)
    
    # La acción correcta que debería tomar el bot
    correct_action = Column(String(500), nullable=False)
    
    # Categorización para ML
    category = Column(String(50), nullable=False)  # intent | entity | tone | flow
    
    # Quién enseñó al bot
    doctor_id = Column(UUID(as_uuid=True), ForeignKey("doctors.id"), nullable=False, index=True)
    doctor = relationship("Doctor")
    
    # Auditoría
    created_at = Column(DateTime, nullable=False, default=lambda: datetime.utcnow())
    updated_at = Column(DateTime, nullable=False, default=lambda: datetime.utcnow(), onupdate=lambda: datetime.utcnow())
    
    # Índice compuesto para queries de doctor + pattern (evitar duplicados)
    __table_args__ = (
        Index("idx_doctor_pattern", "doctor_id", "pattern", unique=True),
    )
