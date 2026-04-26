"""
Brain Service - Servicio de IA asíncrono
Importa modelos y schemas desde shared/
Se integra con la API mediante cliente HTTP
"""

from typing import Optional
from datetime import datetime
from shared.models import Appointment, AppointmentStatus
from shared.schemas import AppointmentCreate, AppointmentResponse
from shared.utils import setup_logger

logger = setup_logger(__name__)


class BrainService:
    """
    Servicio de Brain que procesa lógica de IA
    - Análisis de intención del usuario
    - Decisión de agendamiento
    - Recomendaciones de citas
    """
    
    def __init__(self, api_client=None):
        """
        Args:
            api_client: Cliente HTTP para comunicarse con la API interna
        """
        self.api_client = api_client
    
    def analyze_appointment_request(self, user_message: str) -> dict:
        """
        Analiza un mensaje de usuario y extrae intención de cita
        
        Args:
            user_message: Mensaje en lenguaje natural del usuario
            
        Returns:
            Dict con intención extraída
        """
        logger.info(f"Analizando mensaje: {user_message[:50]}...")
        
        # Aquí iría la lógica de NLP real
        # Por ahora, dummy implementation
        return {
            "intent": "schedule_appointment",
            "confidence": 0.95,
            "entities": {
                "type_of_visit": "general_consultation",
                "preferred_date": "tomorrow",
                "doctor_specialty": "general"
            }
        }
    
    def recommend_appointments(self, patient_id: int) -> list:
        """
        Genera recomendaciones de citas para un paciente
        
        Args:
            patient_id: ID del paciente
            
        Returns:
            Lista de citas recomendadas
        """
        logger.info(f"Generando recomendaciones para paciente {patient_id}")
        
        # Aquí iría lógica de ML real
        # Por ahora, dummy implementation
        return [
            {
                "doctor_specialty": "Cardiología",
                "reason": "Follow-up cardiovascular",
                "urgency": "medium",
                "score": 0.87
            }
        ]
    
    def validate_appointment(self, appointment_data: AppointmentCreate) -> tuple[bool, Optional[str]]:
        """
        Valida si una cita puede ser agendada
        
        Args:
            appointment_data: Datos de la cita
            
        Returns:
            Tupla (válida, motivo_error)
        """
        logger.info(f"Validando cita para paciente {appointment_data.patient_id}")
        
        # Validaciones de lógica de negocio
        if appointment_data.appointment_date < datetime.utcnow():
            return False, "La fecha debe ser en el futuro"
        
        if not appointment_data.reason:
            return False, "Se requiere especificar el motivo de la cita"
        
        return True, None
    
    async def process_queue_message(self, message: dict):
        """
        Procesa un mensaje de la cola (Celery/Redis)
        
        Args:
            message: Mensaje de la cola
        """
        logger.info(f"Procesando mensaje tipo: {message.get('type')}")
        
        message_type = message.get("type")
        
        if message_type == "schedule_appointment":
            return await self._handle_schedule_appointment(message)
        elif message_type == "analyze_user_intent":
            return await self._handle_analyze_intent(message)
        else:
            logger.warning(f"Tipo de mensaje desconocido: {message_type}")
    
    async def _handle_schedule_appointment(self, message: dict):
        """Maneja agendamiento de cita desde cola"""
        patient_id = message.get("patient_id")
        doctor_id = message.get("doctor_id")
        date_str = message.get("appointment_date")
        
        logger.info(f"Agendando cita: paciente={patient_id}, doctor={doctor_id}")
        
        # Crear cita mediante API
        appointment_data = AppointmentCreate(
            patient_id=patient_id,
            doctor_id=doctor_id,
            appointment_date=datetime.fromisoformat(date_str),
            reason=message.get("reason", "")
        )
        
        # Aquí se llamaría a la API: POST /api/v1/appointments
        # result = await self.api_client.post("/appointments", appointment_data)
        
        return {
            "success": True,
            "appointment_id": "generated_id",
            "message": "Cita agendada exitosamente"
        }
    
    async def _handle_analyze_intent(self, message: dict):
        """Maneja análisis de intención desde cola"""
        user_message = message.get("text")
        user_id = message.get("user_id")
        
        intent_data = self.analyze_appointment_request(user_message)
        
        logger.info(f"Intención detectada: {intent_data['intent']}")
        
        return {
            "user_id": user_id,
            "analysis": intent_data
        }
