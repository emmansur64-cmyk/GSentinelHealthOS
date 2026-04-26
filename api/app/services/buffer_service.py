"""
Backend service para buffers automáticos entre turnos.

Extiende TimeSlotService con lógica de bloqueo de slots adyacentes.
"""
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Tuple
import logging

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, update, func
from sqlalchemy.sql import text

from api.app.models.time_slot_simple import TimeSlot, Appointment

logger = logging.getLogger(__name__)


class BufferService:
    """Gestionar buffers automáticos entre turnos."""

    @staticmethod
    async def get_doctor_buffer_minutes(
        db: AsyncSession,
        doctor_id: int
    ) -> int:
        """Obtener buffer configurado para un doctor."""
        try:
            result = await db.execute(
                text("""
                    SELECT buffer_minutes
                    FROM doctor_schedule_config
                    WHERE doctor_id = :doctor_id
                    LIMIT 1
                """),
                {"doctor_id": doctor_id}
            )
            row = result.fetchone()
            return row[0] if row else 0
        except Exception as e:
            logger.error(f"Error getting doctor buffer: {e}")
            return 0

    @staticmethod
    async def book_slot_with_buffer(
        db: AsyncSession,
        slot_id: int,
        patient_id: int,
        doctor_id: int,
        buffer_minutes: int = 0
    ) -> Tuple[bool, Optional[int], int, str]:
        """
        Reservar slot con bloqueo automático de buffer.
        
        Returns:
            (success: bool, appointment_id: int or None, slots_blocked: int, error: str)
        """
        try:
            if buffer_minutes <= 0:
                # Sin buffer: booking simple
                result = await db.execute(
                    update(TimeSlot)
                    .where(
                        and_(
                            TimeSlot.id == slot_id,
                            TimeSlot.status == "available"
                        )
                    )
                    .values(status="booked")
                )
                
                if not result.rowcount or result.rowcount == 0:  # type: ignore
                    return (False, None, 0, "Slot not available")
                
                appointment = Appointment(slot_id=slot_id, patient_id=patient_id)
                db.add(appointment)
                await db.commit()
                
                return (True, appointment.id, 0, "")
            
            # Con buffer: obtener info del slot y bloquear adyacentes
            result = await db.execute(
                select(TimeSlot).where(TimeSlot.id == slot_id)
            )
            slot = result.scalar_one_or_none()
            
            if not slot or slot.status != "available":
                return (False, None, 0, "Slot not available")
            
            # Bloquear slot principal
            slot.status = "booked"
            
            # Calcular rango de buffer
            buffer_before = slot.start_time - timedelta(minutes=buffer_minutes)
            buffer_after = slot.end_time + timedelta(minutes=buffer_minutes)
            slot_date = slot.start_time.date()
            
            # Bloquear slots ANTERIORES
            before_result = await db.execute(
                update(TimeSlot)
                .where(
                    and_(
                        TimeSlot.doctor_id == doctor_id,
                        TimeSlot.start_time >= buffer_before,
                        TimeSlot.start_time < slot.start_time,
                        TimeSlot.status == "available",
                        func.date(TimeSlot.start_time) == slot_date
                    )
                )
                .values(status="blocked")
            )
            
            before_count = before_result.rowcount
            logger.info(f"Blocked {before_count} slots before appointment")
            
            # Bloquear slots POSTERIORES
            after_result = await db.execute(
                update(TimeSlot)
                .where(
                    and_(
                        TimeSlot.doctor_id == doctor_id,
                        TimeSlot.start_time >= slot.end_time,
                        TimeSlot.start_time < buffer_after,
                        TimeSlot.status == "available",
                        func.date(TimeSlot.start_time) == slot_date
                    )
                )
                .values(status="blocked")
            )
            
            after_count = after_result.rowcount
            logger.info(f"Blocked {after_count} slots after appointment")
            
            # Crear appointment
            appointment = Appointment(slot_id=slot_id, patient_id=patient_id)
            db.add(appointment)
            await db.commit()
            
            total_blocked = before_count + after_count
            return (True, appointment.id, total_blocked, "")
            
        except Exception as e:
            await db.rollback()
            logger.error(f"Error booking slot with buffer: {e}")
            return (False, None, 0, str(e))

    @staticmethod
    async def cancel_appointment_with_buffer_release(
        db: AsyncSession,
        appointment_id: int,
        buffer_minutes: int = 0
    ) -> Tuple[bool, Optional[int], int, str]:
        """
        Cancelar cita y liberar slots bloqueados por buffer.
        
        Returns:
            (success: bool, slot_id: int or None, slots_unblocked: int, error: str)
        """
        try:
            # Obtener appointment y slot
            result = await db.execute(
                select(Appointment).where(Appointment.id == appointment_id)
            )
            appointment = result.scalar_one_or_none()
            
            if not appointment:
                return (False, None, 0, "Appointment not found")
            
            result = await db.execute(
                select(TimeSlot).where(TimeSlot.id == appointment.slot_id)
            )
            slot = result.scalar_one_or_none()
            
            if not slot:
                return (False, None, 0, "Slot not found")
            
            slot_id = slot.id
            doctor_id = slot.doctor_id
            
            # Marcar appointment como cancelado
            appointment.status = "cancelled"
            
            # Liberar slot principal
            slot.status = "available"
            unblocked_count = 0
            
            if buffer_minutes > 0:
                slot_date = slot.start_time.date()
                buffer_before = slot.start_time - timedelta(minutes=buffer_minutes)
                buffer_after = slot.end_time + timedelta(minutes=buffer_minutes)
                
                # Liberar slots ANTERIORES (que no bloqueen otras citas)
                before_result = await db.execute(
                    update(TimeSlot)
                    .where(
                        and_(
                            TimeSlot.doctor_id == doctor_id,
                            TimeSlot.start_time >= buffer_before,
                            TimeSlot.start_time < slot.start_time,
                            TimeSlot.status == "blocked",
                            func.date(TimeSlot.start_time) == slot_date,
                            # Verificar que no hay OTRA cita que use este buffer
                            ~TimeSlot.id.in_(
                                select(TimeSlot.id).where(
                                    and_(
                                        TimeSlot.doctor_id == doctor_id,
                                        TimeSlot.status == "booked",
                                        func.date(TimeSlot.start_time) == slot_date,
                                        TimeSlot.start_time - timedelta(minutes=buffer_minutes) < slot.end_time,
                                        TimeSlot.start_time > slot.start_time
                                    )
                                )
                            )
                        )
                    )
                    .values(status="available")
                )
                
                before_count = before_result.rowcount
                logger.info(f"Unblocked {before_count} slots before")
                
                # Liberar slots POSTERIORES
                after_result = await db.execute(
                    update(TimeSlot)
                    .where(
                        and_(
                            TimeSlot.doctor_id == doctor_id,
                            TimeSlot.start_time >= slot.end_time,
                            TimeSlot.start_time < buffer_after,
                            TimeSlot.status == "blocked",
                            func.date(TimeSlot.start_time) == slot_date,
                            ~TimeSlot.id.in_(
                                select(TimeSlot.id).where(
                                    and_(
                                        TimeSlot.doctor_id == doctor_id,
                                        TimeSlot.status == "booked",
                                        func.date(TimeSlot.start_time) == slot_date,
                                        TimeSlot.end_time + timedelta(minutes=buffer_minutes) > slot.start_time,
                                        TimeSlot.end_time < slot.end_time
                                    )
                                )
                            )
                        )
                    )
                    .values(status="available")
                )
                
                after_count = after_result.rowcount
                logger.info(f"Unblocked {after_count} slots after")
                unblocked_count = before_count + after_count
            
            await db.commit()
            return (True, slot_id, unblocked_count, "")
            
        except Exception as e:
            await db.rollback()
            logger.error(f"Error cancelling with buffer release: {e}")
            return (False, None, 0, str(e))

    @staticmethod
    async def get_available_slots_excluding_buffers(
        db: AsyncSession,
        doctor_id: int,
        slot_date: datetime.date,
        exclude_blocked: bool = True
    ) -> List[TimeSlot]:
        """
        Listar slots disponibles excluyendo bloqueados por buffers.
        
        Si exclude_blocked=True (default):
          - Solo retorna status='available'
          - Oculta slots que son buffers (bloqueados)
        
        Si exclude_blocked=False:
          - Retorna ambos available y blocked
          - Útil para debugging/admin
        """
        try:
            if exclude_blocked:
                # Solo disponibles (sin buffers)
                query = select(TimeSlot).where(
                    and_(
                        TimeSlot.doctor_id == doctor_id,
                        TimeSlot.status == "available",
                        func.date(TimeSlot.start_time) == slot_date
                    )
                ).order_by(TimeSlot.start_time)
            else:
                # Disponibles + bloqueados (para admin view)
                query = select(TimeSlot).where(
                    and_(
                        TimeSlot.doctor_id == doctor_id,
                        TimeSlot.status.in_(["available", "blocked"]),
                        func.date(TimeSlot.start_time) == slot_date
                    )
                ).order_by(TimeSlot.start_time)
            
            result = await db.execute(query)
            return result.scalars().all()
            
        except Exception as e:
            logger.error(f"Error getting available slots: {e}")
            return []

    @staticmethod
    async def analyze_buffer_impact(
        db: AsyncSession,
        doctor_id: int,
        slot_date: datetime.date
    ) -> Dict[str, any]:
        """
        Analizar impacto de buffers en disponibilidad.
        
        Retorna:
            {
                'total_slots': int,
                'available': int,
                'booked': int,
                'blocked_by_buffer': int,
                'buffer_impact_percent': float,
                'available_for_booking': int  # Sin contar buffers
            }
        """
        try:
            result = await db.execute(
                text("""
                    SELECT 
                        COUNT(*) as total_slots,
                        COUNT(CASE WHEN status = 'available' THEN 1 END) as available_slots,
                        COUNT(CASE WHEN status = 'booked' THEN 1 END) as booked_slots,
                        COUNT(CASE WHEN status = 'blocked' THEN 1 END) as blocked_buffer_slots
                    FROM time_slots
                    WHERE doctor_id = :doctor_id
                      AND DATE(start_time) = :slot_date
                """),
                {"doctor_id": doctor_id, "slot_date": slot_date}
            )
            
            row = result.fetchone()
            
            if not row or row[0] == 0:
                return {
                    "total_slots": 0,
                    "available": 0,
                    "booked": 0,
                    "blocked_by_buffer": 0,
                    "buffer_impact_percent": 0.0,
                    "available_for_booking": 0
                }
            
            total = row[0]
            available = row[1] or 0
            booked = row[2] or 0
            blocked = row[3] or 0
            
            impact_percent = (blocked / total * 100) if total > 0 else 0
            
            return {
                "total_slots": total,
                "available": available,
                "booked": booked,
                "blocked_by_buffer": blocked,
                "buffer_impact_percent": round(impact_percent, 2),
                "available_for_booking": available  # Para cliente (solo available)
            }
            
        except Exception as e:
            logger.error(f"Error analyzing buffer impact: {e}")
            return {
                "total_slots": 0,
                "available": 0,
                "booked": 0,
                "blocked_by_buffer": 0,
                "buffer_impact_percent": 0.0,
                "available_for_booking": 0
            }

    @staticmethod
    async def validate_buffer_integrity(
        db: AsyncSession,
        doctor_id: int,
        slot_date: datetime.date
    ) -> Dict[str, any]:
        """
        Validar integridad de buffers (sin conflictos).
        
        Retorna:
            {
                'is_valid': bool,
                'orphan_blocked_slots': int,  # blocked sin cita asociada
                'conflicting_buffers': int,   # buffers superpuestos
                'issues': List[str]
            }
        """
        try:
            issues = []
            
            # 1. Detectar slots bloqueados sin cita asociada (huérfanos)
            result = await db.execute(
                text("""
                    SELECT COUNT(*)
                    FROM time_slots ts
                    WHERE ts.status = 'blocked'
                      AND ts.doctor_id = :doctor_id
                      AND DATE(ts.start_time) = :slot_date
                      AND NOT EXISTS (
                          SELECT 1 FROM time_slots ts2
                          WHERE ts2.doctor_id = ts.doctor_id
                            AND ts2.status = 'booked'
                            AND ts2.start_time <= ts.start_time
                            AND ts2.end_time >= ts.end_time
                      )
                """),
                {"doctor_id": doctor_id, "slot_date": slot_date}
            )
            
            orphan_count = result.scalar() or 0
            if orphan_count > 0:
                issues.append(f"Found {orphan_count} orphan blocked slots (without associated booking)")
            
            # 2. Detectar buffers que se solapan (conflictos de múltiples buffers)
            result = await db.execute(
                text("""
                    SELECT COUNT(*)
                    FROM time_slots ts1
                    WHERE ts1.status = 'blocked'
                      AND ts1.doctor_id = :doctor_id
                      AND DATE(ts1.start_time) = :slot_date
                      AND (
                          SELECT COUNT(*)
                          FROM time_slots ts2
                          WHERE ts2.doctor_id = ts1.doctor_id
                            AND ts2.status = 'booked'
                            AND DATE(ts2.start_time) = :slot_date
                            AND NOT (ts1.end_time <= ts2.start_time OR ts1.start_time >= ts2.end_time)
                      ) > 1
                """),
                {"doctor_id": doctor_id, "slot_date": slot_date}
            )
            
            conflict_count = result.scalar() or 0
            if conflict_count > 0:
                issues.append(f"Found {conflict_count} overlapping buffer zones")
            
            is_valid = orphan_count == 0 and conflict_count == 0
            
            return {
                "is_valid": is_valid,
                "orphan_blocked_slots": orphan_count,
                "conflicting_buffers": conflict_count,
                "issues": issues
            }
            
        except Exception as e:
            logger.error(f"Error validating buffer integrity: {e}")
            return {
                "is_valid": False,
                "orphan_blocked_slots": 0,
                "conflicting_buffers": 0,
                "issues": [str(e)]
            }

