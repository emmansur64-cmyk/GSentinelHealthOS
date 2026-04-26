"""Extensión de PatientService para shadow profiles - Fase 3.3."""

from typing import Optional
from uuid import UUID
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.app.models import Patient


class ShadowProfileService:
    """Servicio de shadow profiles para pacientes nuevos desde Gateway."""
    
    def __init__(self, db_session: AsyncSession):
        """Inicializa el servicio con sesión de BD."""
        self.db = db_session
    
    async def get_or_create_by_phone(
        self,
        phone: str,
        name: Optional[str] = None,
        email: Optional[str] = None
    ) -> Patient:
        """
        Obtiene un paciente por teléfono.
        Si no existe, crea un "shadow profile" con datos mínimos.
        
        ⚠️ SHADOW PROFILE (Fase 3.3 - Solución a Laguna de "quién es quién"):
        
        Problema Original:
        El Gateway WhatsApp recibe esto:
          "patient_phone: +34912345678, message: Quiero agendar cita"
        
        Pero el POST /appointments requiere "patient_id" (UUID).
        ¿De dónde sacamos el patient_id de un paciente nuevo?
        
        Solución: Shadow Profile
        - Crear un Patient mínimo con solo teléfono
        - Nombre = "<pending>" (marcador)
        - Email = None (se completa después)
        - El médico/dashboard lo completa más tarde
        
        Flujo:
        1. Gateway: GET /patients/by-phone/+34912345678
           → No existe
           → Crea shadow profile
           → Devuelve {"id": "uuid-...", "phone": "+34...", "name": "<pending>"}
        2. Gateway: POST /appointments
           → patient_id = "uuid-...", doctor_id = "...", date_time = "..."
           → ✅ Cita creada
        3. Médico/Dashboard: PATCH /patients/uuid-.../profile
           → Completa name, email
           → Shadow profile se convierte en perfil completo
        
        Args:
            phone: Teléfono en formato E.164 (ej: +34912345678)
            name: Nombre opcional (si no, usa "<pending>")
            email: Email opcional
        
        Returns:
            Patient: Paciente existente o shadow profile recién creado
        
        Raises:
            HTTPException 500: Error al crear
        """
        
        # Buscar paciente existente
        stmt = select(Patient).where(Patient.phone == phone)
        result = await self.db.execute(stmt)
        existing_patient = result.scalars().first()
        
        if existing_patient:
            return existing_patient
        
        # Crear shadow profile
        shadow_patient = Patient(
            phone=phone,
            name=name or "<pending>",  # Marcador de perfil incompleto
            email=email,
        )
        
        try:
            self.db.add(shadow_patient)
            await self.db.flush()
            await self.db.commit()
            await self.db.refresh(shadow_patient)
            
            return shadow_patient
        
        except Exception as e:
            await self.db.rollback()
            raise HTTPException(
                status_code=500,
                detail=f"Error al crear shadow profile: {str(e)}"
            )
    
    async def get_by_phone(self, phone: str) -> Optional[Patient]:
        """
        Obtiene un paciente por teléfono.
        NO crea si no existe.
        """
        stmt = select(Patient).where(Patient.phone == phone)
        result = await self.db.execute(stmt)
        return result.scalars().first()
    
    async def is_shadow_profile(self, patient_id: UUID) -> bool:
        """Verifica si un paciente es un shadow profile (name == '<pending>')."""
        stmt = select(Patient).where(Patient.id == patient_id)
        result = await self.db.execute(stmt)
        patient = result.scalars().first()
        
        return patient and patient.name == "<pending>"
    
    async def complete_shadow_profile(
        self,
        patient_id: UUID,
        name: str,
        email: Optional[str] = None
    ) -> Patient:
        """
        Completa un shadow profile con información adicional.
        """
        stmt = select(Patient).where(Patient.id == patient_id)
        result = await self.db.execute(stmt)
        patient = result.scalars().first()
        
        if not patient:
            raise HTTPException(
                status_code=404,
                detail="Paciente no encontrado"
            )
        
        # Actualizar datos
        if name and name != "<pending>":
            patient.name = name
        
        if email:
            patient.email = email
        
        await self.db.commit()
        await self.db.refresh(patient)
        
        return patient
