"""
Migration Validation Script: DateTime → Slots

Pasos:
1. Validar estado actual (appointments basados en datetime)
2. Verificar integridad post-migración
3. Comparar datos antes/después
4. Generar reporte
"""
import asyncio
from datetime import datetime
from typing import Dict, List, Tuple
import logging

from sqlalchemy import text, select, func, and_
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class MigrationValidator:
    """Validar migración de datetime a slots sin pérdida de datos."""

    def __init__(self, db_url: str):
        self.db_url = db_url
        self.engine = None
        self.AsyncSessionLocal = None

    async def init(self):
        """Inicializar conexión."""
        self.engine = create_async_engine(self.db_url, echo=False)
        self.AsyncSessionLocal = async_sessionmaker(
            bind=self.engine, class_=AsyncSession, expire_on_commit=False
        )

    async def close(self):
        """Cerrar conexión."""
        if self.engine:
            await self.engine.dispose()

    async def get_session(self) -> AsyncSession:
        """Obtener sesión."""
        return self.AsyncSessionLocal()

    # ========================================================================
    # FASE 1: ESTADO PRE-MIGRACIÓN
    # ========================================================================

    async def check_pre_migration_state(self) -> Dict:
        """Estado actual del sistema (antes de migración)."""
        async with await self.get_session() as db:
            try:
                # Contar appointments
                result = await db.execute(
                    text("SELECT COUNT(*) FROM appointments")
                )
                total_appointments = result.scalar()

                # Rango de fechas
                result = await db.execute(
                    text("""
                        SELECT 
                            MIN(datetime) as earliest,
                            MAX(datetime) as latest
                        FROM appointments
                    """)
                )
                row = result.fetchone()
                earliest, latest = row

                # Contar por doctor
                result = await db.execute(
                    text("""
                        SELECT doctor_id, COUNT(*) as count
                        FROM appointments
                        GROUP BY doctor_id
                        ORDER BY count DESC
                    """)
                )
                doctors_summary = {row[0]: row[1] for row in result.fetchall()}

                return {
                    "status": "✅ OK",
                    "total_appointments": total_appointments,
                    "earliest_appointment": earliest,
                    "latest_appointment": latest,
                    "doctors_count": len(doctors_summary),
                    "appointments_by_doctor": doctors_summary,
                }
            except Exception as e:
                return {
                    "status": "❌ ERROR",
                    "error": str(e),
                }

    # ========================================================================
    # FASE 2: VALIDACIÓN POST-MIGRACIÓN
    # ========================================================================

    async def check_post_migration_state(self) -> Dict:
        """Estado del sistema después de migración."""
        async with await self.get_session() as db:
            try:
                # Contar time_slots
                result = await db.execute(
                    text("SELECT COUNT(*) FROM time_slots")
                )
                total_slots = result.scalar()

                # Contar appointments_new
                result = await db.execute(
                    text("SELECT COUNT(*) FROM appointments_new")
                )
                total_new_appointments = result.scalar()

                # Slots por estado
                result = await db.execute(
                    text("""
                        SELECT status, COUNT(*) as count
                        FROM time_slots
                        GROUP BY status
                    """)
                )
                slots_by_status = {row[0]: row[1] for row in result.fetchall()}

                # Validar que cada appointment_new tiene slot_id válido
                result = await db.execute(
                    text("""
                        SELECT COUNT(*)
                        FROM appointments_new a
                        LEFT JOIN time_slots ts ON a.slot_id = ts.id
                        WHERE ts.id IS NULL
                    """)
                )
                orphan_appointments = result.scalar()

                return {
                    "status": "✅ OK" if orphan_appointments == 0 else "❌ ERROR",
                    "total_slots": total_slots,
                    "total_appointments_new": total_new_appointments,
                    "slots_by_status": slots_by_status,
                    "orphan_appointments": orphan_appointments,
                }
            except Exception as e:
                return {
                    "status": "❌ ERROR",
                    "error": str(e),
                }

    # ========================================================================
    # FASE 3: COMPARAR INTEGRIDAD
    # ========================================================================

    async def compare_before_after(self) -> Dict:
        """Comparar integridad antes/después."""
        async with await self.get_session() as db:
            try:
                # Contar registros
                result = await db.execute(
                    text("SELECT COUNT(*) FROM appointments")
                )
                original_count = result.scalar()

                result = await db.execute(
                    text("SELECT COUNT(*) FROM appointments_new")
                )
                migrated_count = result.scalar()

                # Verificar pérdida de datos
                data_loss = original_count - migrated_count
                loss_percentage = (
                    (data_loss / original_count * 100) if original_count > 0 else 0
                )

                # Verificar duplicados
                result = await db.execute(
                    text("""
                        SELECT COUNT(*)
                        FROM (
                            SELECT slot_id, COUNT(*) as cnt
                            FROM appointments_new
                            GROUP BY slot_id
                            HAVING COUNT(*) > 1
                        ) duplicates
                    """)
                )
                duplicate_slots = result.scalar()

                return {
                    "original_appointments": original_count,
                    "migrated_appointments": migrated_count,
                    "data_loss_count": data_loss,
                    "data_loss_percentage": round(loss_percentage, 2),
                    "duplicate_slots": duplicate_slots,
                    "validation_status": (
                        "✅ PASS" if data_loss == 0 and duplicate_slots == 0 
                        else "❌ FAIL"
                    ),
                }
            except Exception as e:
                return {
                    "status": "❌ ERROR",
                    "error": str(e),
                }

    # ========================================================================
    # FASE 4: MUESTREO DE MIGRACIÓN
    # ========================================================================

    async def sample_migration(self, limit: int = 10) -> List[Dict]:
        """Mostrar ejemplos de datos migrados."""
        async with await self.get_session() as db:
            try:
                result = await db.execute(
                    text(f"""
                        SELECT 
                            a_old.id,
                            a_old.doctor_id,
                            a_old.datetime,
                            a_new.slot_id,
                            ts.start_time,
                            ts.end_time,
                            ts.status,
                            CASE 
                                WHEN a_old.datetime = ts.start_time THEN '✅ OK'
                                ELSE '❌ MISMATCH'
                            END as validation
                        FROM appointments a_old
                        LEFT JOIN appointments_new a_new ON a_old.id = a_new.id
                        LEFT JOIN time_slots ts ON a_new.slot_id = ts.id
                        LIMIT {limit}
                    """)
                )
                samples = []
                for row in result.fetchall():
                    samples.append({
                        "appointment_id": row[0],
                        "doctor_id": row[1],
                        "original_datetime": row[2],
                        "slot_id": row[3],
                        "slot_start": row[4],
                        "slot_end": row[5],
                        "slot_status": row[6],
                        "match": row[7],
                    })
                return samples
            except Exception as e:
                logger.error(f"Error sampling: {e}")
                return []

    # ========================================================================
    # FASE 5: VERIFICACIÓN POR DOCTOR
    # ========================================================================

    async def check_per_doctor_stats(self) -> List[Dict]:
        """Estadísticas de migración por doctor."""
        async with await self.get_session() as db:
            try:
                result = await db.execute(
                    text("""
                        SELECT 
                            d.id,
                            d.name,
                            COUNT(DISTINCT a.id) as original_appointments,
                            COUNT(DISTINCT a_new.id) as migrated_appointments,
                            SUM(CASE WHEN ts.status = 'booked' THEN 1 ELSE 0 END) as booked_slots,
                            SUM(CASE WHEN ts.status = 'available' THEN 1 ELSE 0 END) as available_slots,
                            COUNT(DISTINCT ts.id) as total_slots
                        FROM doctors d
                        LEFT JOIN appointments a ON d.id = a.doctor_id
                        LEFT JOIN appointments_new a_new ON a.id = a_new.id
                        LEFT JOIN time_slots ts ON d.id = ts.doctor_id
                        GROUP BY d.id, d.name
                        ORDER BY original_appointments DESC
                    """)
                )
                stats = []
                for row in result.fetchall():
                    stats.append({
                        "doctor_id": row[0],
                        "doctor_name": row[1],
                        "original_appointments": row[2] or 0,
                        "migrated_appointments": row[3] or 0,
                        "booked_slots": row[4] or 0,
                        "available_slots": row[5] or 0,
                        "total_slots": row[6] or 0,
                    })
                return stats
            except Exception as e:
                logger.error(f"Error getting doctor stats: {e}")
                return []

    # ========================================================================
    # FASE 6: REPORTE COMPLETO
    # ========================================================================

    async def generate_full_report(self) -> Dict:
        """Generar reporte completo de migración."""
        logger.info("🔍 Validando migración...")

        pre_migration = await self.check_pre_migration_state()
        logger.info(f"Pre-migración: {pre_migration}")

        post_migration = await self.check_post_migration_state()
        logger.info(f"Post-migración: {post_migration}")

        comparison = await self.compare_before_after()
        logger.info(f"Comparación: {comparison}")

        samples = await self.sample_migration(limit=5)
        logger.info(f"Muestreo: {len(samples)} registros")

        doctor_stats = await self.check_per_doctor_stats()
        logger.info(f"Estadísticas: {len(doctor_stats)} doctores")

        # Status general
        overall_status = (
            "✅ LISTO PARA CUTOVER"
            if (
                comparison.get("data_loss_count", 1) == 0
                and comparison.get("duplicate_slots", 1) == 0
                and post_migration.get("orphan_appointments", 1) == 0
            )
            else "❌ REVISAR ERRORES"
        )

        return {
            "timestamp": datetime.now().isoformat(),
            "overall_status": overall_status,
            "pre_migration": pre_migration,
            "post_migration": post_migration,
            "comparison": comparison,
            "sample_data": samples,
            "doctor_statistics": doctor_stats,
        }


# ============================================================================
# MAIN: Ejecutar validaciones
# ============================================================================

async def main():
    """Ejecutar todas las validaciones."""
    
    # 👉 CAMBIAR A TU DATABASE URL
    db_url = "postgresql+asyncpg://user:password@localhost/gsentinel"
    
    validator = MigrationValidator(db_url)
    
    try:
        await validator.init()
        
        # Generar reporte
        report = await validator.generate_full_report()
        
        # Mostrar resultados
        print("\n" + "=" * 80)
        print("📊 REPORTE DE MIGRACIÓN: DateTime → Slots")
        print("=" * 80)
        
        print(f"\n⏰ Timestamp: {report['timestamp']}")
        print(f"\n🎯 Estado General: {report['overall_status']}")
        
        print("\n📈 PRE-MIGRACIÓN:")
        print(f"   Total appointments: {report['pre_migration'].get('total_appointments', 'N/A')}")
        print(f"   Período: {report['pre_migration'].get('earliest_appointment')} → {report['pre_migration'].get('latest_appointment')}")
        
        print("\n📊 POST-MIGRACIÓN:")
        print(f"   Total slots: {report['post_migration'].get('total_slots', 'N/A')}")
        print(f"   Total appointments_new: {report['post_migration'].get('total_appointments_new', 'N/A')}")
        print(f"   Orphan appointments: {report['post_migration'].get('orphan_appointments', 0)}")
        
        print("\n🔍 VALIDACIÓN:")
        print(f"   Data loss: {report['comparison'].get('data_loss_count', 0)} registros ({report['comparison'].get('data_loss_percentage', 0)}%)")
        print(f"   Duplicate slots: {report['comparison'].get('duplicate_slots', 0)}")
        print(f"   Status: {report['comparison'].get('validation_status', 'N/A')}")
        
        print("\n📋 MUESTREO (5 registros):")
        for sample in report['sample_data'][:5]:
            print(f"   Apt #{sample['appointment_id']} → Slot #{sample['slot_id']} [{sample['match']}]")
        
        print("\n👨‍⚕️ ESTADÍSTICAS POR DOCTOR:")
        for doctor in report['doctor_statistics'][:5]:
            print(f"   Dr. {doctor['doctor_name']}: {doctor['original_appointments']} apts → {doctor['total_slots']} slots")
        
        print("\n" + "=" * 80)
        
    finally:
        await validator.close()


if __name__ == "__main__":
    asyncio.run(main())

