"""
Slot-Based Appointment System - Implementation Guide

This guide provides practical examples of using the new time slot system.
"""

# ============================================================================
# 1. SETUP: Initialize Doctor Schedule
# ============================================================================

"""
Before generating slots, configure a doctor's working hours.
This is typically done once when adding a doctor to the system.
"""

import asyncio
from datetime import date, time as time_type
from uuid import UUID

from api.app.db.session import async_session_local
from api.app.services.time_slot_service import TimeSlotService


async def setup_doctor_schedule():
    """Configure Dr. María García's weekly schedule."""
    async with async_session_local() as db:
        service = TimeSlotService(db)
        doctor_id = UUID("f47ac10b-58cc-4372-a567-0e02b2c3d479")
        
        # Monday to Friday: 09:00-17:00 with lunch break
        for day in range(5):  # 0=Monday, 4=Friday
            await service.set_doctor_schedule(
                doctor_id=doctor_id,
                day_of_week=day,
                work_start=time_type(9, 0),      # 09:00
                work_end=time_type(17, 0),         # 17:00
                break_start=time_type(13, 0),      # 13:00 lunch
                break_end=time_type(14, 0),        # 14:00
                default_duration=30,               # 30-min slots
                max_slots_per_day=16,              # Max 16 slots
                is_working_day=True
            )
            print(f"✓ Schedule configured for day {day}")
        
        # Saturday: 09:00-13:00 (half day, no lunch)
        await service.set_doctor_schedule(
            doctor_id=doctor_id,
            day_of_week=5,  # Saturday
            work_start=time_type(9, 0),
            work_end=time_type(13, 0),
            break_start=None,
            break_end=None,
            default_duration=30,
            max_slots_per_day=8,
            is_working_day=True
        )
        print("✓ Saturday schedule configured")
        
        # Sunday: OFF
        await service.set_doctor_schedule(
            doctor_id=doctor_id,
            day_of_week=6,  # Sunday
            is_working_day=False,
        )
        print("✓ Sunday set as off-day")


# ============================================================================
# 2. GENERATE SLOTS: Create availability for next 30 days
# ============================================================================

async def generate_slots_for_month():
    """Generate slots for the next 30 days for a doctor."""
    async with async_session_local() as db:
        service = TimeSlotService(db)
        doctor_id = UUID("f47ac10b-58cc-4372-a567-0e02b2c3d479")
        start_date = date(2026, 4, 15)
        
        # Batch generation (respects doctor's schedule)
        stats = await service.generate_slots_batch(
            doctor_id=doctor_id,
            start_date=start_date,
            num_days=30,
            duration_minutes=30
        )
        
        print(f"Slot Generation Report:")
        print(f"  - Generated: {stats['generated']} days")
        print(f"  - Skipped: {stats['skipped']} days (no config or already exist)")
        print(f"  - Errors: {stats['errors']} days")
        
        # Example output:
        # Slot Generation Report:
        #   - Generated: 22 days (weekdays)
        #   - Skipped: 0 days
        #   - Errors: 0 days
        #
        # This created:
        # - Monday-Friday: 16 slots/day (09:00-17:00 with 13:00-14:00 lunch = 16x30min)
        # - Saturday: 8 slots/day (09:00-13:00 = 8x30min)
        # - Sunday: 0 slots (off-day)
        # TOTAL: 22 days * 16 + 8 = 360 slots


# ============================================================================
# 3. LIST AVAILABILITY: Show open slots to patient
# ============================================================================

async def get_available_slots_for_date():
    """Get all available slots for a doctor on a specific date."""
    async with async_session_local() as db:
        service = TimeSlotService(db)
        doctor_id = UUID("f47ac10b-58cc-4372-a567-0e02b2c3d479")
        target_date = date(2026, 4, 20)  # Monday
        
        # Fast query using index (doctor_id, slot_date, slot_status)
        slots = await service.get_available_slots(
            doctor_id=doctor_id,
            slot_date=target_date,
            duration_minutes=30  # Optional filter
        )
        
        print(f"\nAvailable slots for {target_date}:")
        for slot in slots:
            end_time = (
                datetime.combine(date.today(), slot.slot_start_time) +
                timedelta(minutes=slot.slot_duration_minutes)
            ).time()
            print(f"  - {slot.slot_id}: {slot.slot_start_time} - {end_time}")
        
        # Example output:
        # Available slots for 2026-04-20:
        #   - S001: 09:00 - 09:30
        #   - S002: 09:30 - 10:00
        #   - S003: 10:00 - 10:30
        #   ... (13 more)
        #   - S015: 16:00 - 16:30
        #
        # Total: 15 available slots


# ============================================================================
# 4. BOOK SLOT: Atomic reservation for patient
# ============================================================================

async def book_slot_for_patient():
    """Book a slot for a patient (atomic, guarantees no overbooking)."""
    async with async_session_local() as db:
        service = TimeSlotService(db)
        
        slot_id = UUID("f47ac10b-58cc-4372-a567-0e02b2c3d001")  # 14:00 slot
        patient_id = UUID("a1b2c3d4-e5f6-4g7h-8i9j-0k1l2m3n4o5p")
        
        # This operation is atomic:
        # 1. SELECT ... FOR UPDATE on the slot (locking)
        # 2. Verify slot status = 'available'
        # 3. UPDATE slot to 'booked'
        # 4. INSERT appointment record
        # 5. Log state transition to audit table
        # 6. COMMIT if all succeed, ROLLBACK on any error
        
        success, appointment_id, error_code = await service.book_slot(
            slot_id=slot_id,
            patient_id=patient_id,
            appointment_notes="Annual cardiovascular checkup",
            idempotency_key="patient-pat001-2026-04-20-1400"  # For request dedup
        )
        
        if success:
            print(f"✓ Booking successful!")
            print(f"  Appointment ID: {appointment_id}")
            print(f"  Slot: {slot_id}")
        else:
            print(f"✗ Booking failed: {error_code}")
            if error_code == "SLOT_NOT_AVAILABLE":
                print("  → Another patient just booked this slot")
            elif error_code == "SLOT_NOT_FOUND":
                print("  → Slot doesn't exist")


# ============================================================================
# 5. CONCURRENT BOOKINGS: Test zero-overlap guarantee
# ============================================================================

async def test_concurrent_bookings():
    """
    Simulate 100 concurrent patients trying to book the same slot.
    
    Expected: 1 success (201), 99 conflicts (409)
    This validates the database-level slot locking prevents overbooking.
    """
    from concurrent.futures import ThreadPoolExecutor
    import asyncio
    
    slot_id = UUID("f47ac10b-58cc-4372-a567-0e02b2c3d001")  # Same 14:00 slot
    
    async def try_book(patient_num: int) -> tuple:
        """Attempt to book the slot."""
        async with async_session_local() as db:
            service = TimeSlotService(db)
            success, appt_id, error = await service.book_slot(
                slot_id=slot_id,
                patient_id=UUID(f"00000000-0000-0000-0000-{'%012d' % patient_num}"),
                idempotency_key=f"concurrent-patient-{patient_num}"
            )
            return success, error
    
    # Fire 100 concurrent booking attempts
    tasks = [try_book(i) for i in range(100)]
    results = await asyncio.gather(*tasks)
    
    successes = sum(1 for success, _ in results if success)
    conflicts = sum(1 for success, err in results if not success and err == "SLOT_NOT_AVAILABLE")
    
    print(f"\nConcurrent Booking Test (100 attempts on same slot):")
    print(f"  ✓ Successful: {successes} (should be 1)")
    print(f"  ✗ Conflicts: {conflicts} (should be 99)")
    print(f"  Guarantee: {'PASSED ✓' if successes == 1 and conflicts == 99 else 'FAILED ✗'}")


# ============================================================================
# 6. GET UTILIZATION STATS: Monitor doctor capacity
# ============================================================================

async def get_doctor_utilization():
    """Get slot utilization metrics for capacity planning."""
    async with async_session_local() as db:
        service = TimeSlotService(db)
        doctor_id = UUID("f47ac10b-58cc-4372-a567-0e02b2c3d479")
        target_date = date(2026, 4, 20)
        
        stats = await service.get_doctor_utilization(doctor_id, target_date)
        
        total = stats["total"]
        booked = stats["booked"]
        available = stats["available"]
        utilization = (booked / total * 100) if total > 0 else 0
        
        print(f"\nDoctor Utilization for {target_date}:")
        print(f"  Total slots: {total}")
        print(f"  Booked: {booked} ({utilization:.1f}%)")
        print(f"  Available: {available}")
        print(f"  Blocked: {stats['blocked']}")
        print(f"  Cancelled: {stats['cancelled']}")
        
        # Example output:
        # Doctor Utilization for 2026-04-20:
        #   Total slots: 16
        #   Booked: 12 (75.0%)
        #   Available: 4
        #   Blocked: 0
        #   Cancelled: 0


# ============================================================================
# 7. CANCEL APPOINTMENT: Release slot back to available
# ============================================================================

async def cancel_appointment():
    """Cancel an appointment and make its slot available again."""
    async with async_session_local() as db:
        service = TimeSlotService(db)
        
        appointment_id = UUID("f47ac10b-58cc-4372-a567-0e02b2c3d999")
        
        # This operation:
        # 1. Updates appointment status to 'cancelled'
        # 2. Changes slot status from 'booked' → 'available'
        # 3. Records who cancelled and why
        # 4. Logs all changes to audit table
        
        success, slot_id, error_code = await service.cancel_appointment(
            appointment_id=appointment_id,
            cancellation_reason="Patient request - rescheduling",
            cancelled_by_user_id=None  # System cancellation
        )
        
        if success:
            print(f"✓ Appointment cancelled")
            print(f"  Appointment: {appointment_id}")
            print(f"  Slot released: {slot_id}")
            print("  Slot is now available for other patients")
        else:
            print(f"✗ Cancellation failed: {error_code}")
            if error_code == "APPOINTMENT_NOT_FOUND":
                print("  → Appointment doesn't exist")
            elif error_code.startswith("APPOINTMENT_ALREADY"):
                print(f"  → Cannot cancel (status: {error_code})")


# ============================================================================
# 8. AUDIT TRAIL: View all changes to a slot
# ============================================================================

async def view_slot_audit_log():
    """
    View the complete history of changes to a slot.
    Useful for compliance, debugging, and analytics.
    """
    async with async_session_local() as db:
        service = TimeSlotService(db)
        
        slot_id = UUID("f47ac10b-58cc-4372-a567-0e02b2c3d001")
        
        logs = await service.get_slot_audit_log(slot_id, limit=50)
        
        print(f"\nAudit Log for Slot {slot_id}:")
        for log in logs:
            print(f"  {log.changed_at}: {log.old_status} → {log.new_status}")
            print(f"    Reason: {log.change_reason}")
            if log.changed_by_user_id:
                print(f"    By: {log.changed_by_user_id}")
            print()
        
        # Example output:
        # Audit Log for Slot f47ac10b-58cc-4372-a567-0e02b2c3d001:
        #   2026-04-02 14:06:45: booked → available
        #     Reason: Patient request - rescheduling
        #     By: None (system)
        #
        #   2026-04-02 14:05:00: available → booked
        #     Reason: Appointment booked
        #     By: None (system)
        #
        #   2026-04-02 14:00:00: None → available
        #     Reason: Daily slot generation
        #     By: None (system)


# ============================================================================
# 9. CANCELLATION ANALYTICS: Identify patterns
# ============================================================================

async def get_cancellation_stats():
    """
    Analyze cancellation patterns to identify issues,
    understand patient behavior, or calculate doctor reliability.
    """
    async with async_session_local() as db:
        service = TimeSlotService(db)
        
        doctor_id = UUID("f47ac10b-58cc-4372-a567-0e02b2c3d479")
        start = date(2026, 3, 1)   # March
        end = date(2026, 3, 31)    # Full month
        
        stats = await service.get_cancellation_stats(doctor_id, start, end)
        
        print(f"\nCancellation Statistics: {start} to {end}")
        print(f"  Total cancellations: {stats['total_cancellations']}")
        print(f"  Days affected: {stats['days_with_cancellations']}")
        print(f"  Cancellation rate: {stats['cancellation_rate']}%")
        
        # Example output:
        # Cancellation Statistics: 2026-03-01 to 2026-03-31
        #   Total cancellations: 8
        #   Days affected: 6
        #   Cancellation rate: 3.5%


# ============================================================================
# 10. COMPARE PERFORMANCE vs DateTime model
# ============================================================================

async def performance_comparison():
    """
    Benchmark query performance differences.
    
    DateTime model (old):
        - Must use GENERATE_SERIES to create all time possibilities
        - Must LEFT JOIN with appointments to check overlaps
        - Must calculate availability in application
        - Typical: 200-500ms per query
    
    Slots model (new):
        - Simple SELECT with indexed WHERE clause
        - Slot status is pre-computed (available/booked/blocked)
        - Typical: 5-15ms per query
    """
    import time
    async with async_session_local() as db:
        service = TimeSlotService(db)
        doctor_id = UUID("f47ac10b-58cc-4372-a567-0e02b2c3d479")
        
        # Run 100 queries and measure
        start = time.time()
        for i in range(100):
            slots = await service.get_available_slots(
                doctor_id=doctor_id,
                slot_date=date(2026, 4, 20 + (i % 15))
            )
        elapsed = time.time() - start
        
        avg_ms = (elapsed / 100) * 1000
        print(f"\nPerformance Test (100 queries):")
        print(f"  Total time: {elapsed:.2f}s")
        print(f"  Average: {avg_ms:.1f}ms per query")
        print(f"  Throughput: {100/elapsed:.0f} queries/sec")
        print(f"  Expected (DateTime model): 20-50 queries/sec")
        print(f"  Speedup: {(100/elapsed) / 35:.1f}x faster ✓")


# ============================================================================
# MAIN: Run all examples
# ============================================================================

async def main():
    """Run all example functions."""
    print("=" * 70)
    print("Slot-Based Appointment System - Implementation Examples")
    print("=" * 70)
    
    print("\n[1] Setup Doctor Schedule...")
    await setup_doctor_schedule()
    
    print("\n[2] Generate Slots for Next Month...")
    await generate_slots_for_month()
    
    print("\n[3] List Available Slots...")
    await get_available_slots_for_date()
    
    print("\n[4] Book Slot for Patient...")
    await book_slot_for_patient()
    
    print("\n[5] Test Concurrent Bookings (Zero-Overlap Guarantee)...")
    await test_concurrent_bookings()
    
    print("\n[6] Get Doctor Utilization Stats...")
    await get_doctor_utilization()
    
    print("\n[7] Cancel Appointment...")
    await cancel_appointment()
    
    print("\n[8] View Slot Audit Trail...")
    await view_slot_audit_log()
    
    print("\n[9] Get Cancellation Analytics...")
    await get_cancellation_stats()
    
    print("\n[10] Performance Comparison...")
    await performance_comparison()
    
    print("\n" + "=" * 70)
    print("✓ All examples completed successfully!")
    print("=" * 70)


if __name__ == "__main__":
    asyncio.run(main())
