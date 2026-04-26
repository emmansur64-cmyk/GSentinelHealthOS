#!/usr/bin/env bash
# Quick Start Guide: Time Slot System Implementation
# Este script establece el entorno y verifica la implementación

cat << "EOF"
╔════════════════════════════════════════════════════════════════════════════╗
║                  SLOT-BASED APPOINTMENTS - QUICK START                    ║
║                Installation & Verification Guide                           ║
╚════════════════════════════════════════════════════════════════════════════╝
EOF

# ============================================================================
# SECTION 1: Pre-requisites Check
# ============================================================================

echo -e "\n[1] Checking prerequisites...\n"

# Check Python
echo -n "✓ Python 3.10+: "
python --version 2>/dev/null || echo "❌ Not found"

# Check PostgreSQL
echo -n "✓ PostgreSQL 14+: "
psql --version 2>/dev/null || echo "❌ Not found"

# Check poetry/pip
echo -n "✓ pip/poetry: "
pip --version 2>/dev/null || echo "❌ Not found"

# ============================================================================
# SECTION 2: Database Setup
# ============================================================================

echo -e "\n[2] Database Setup\n"
echo "Run these steps:"
echo ""
echo "  # Activate your Python environment"
echo "  source /path/to/venv/bin/activate"
echo ""
echo "  # Apply the migration"
echo "  cd /path/to/workspace"
echo "  alembic upgrade 20260402_0005"
echo ""
echo "  # Verify tables created"
echo "  psql -U postgres -d gsentinel_health -c \"SELECT * FROM information_schema.tables WHERE table_schema='public';\""
echo ""
echo "✓ Expected tables:"
echo "  - time_slots"
echo "  - appointments_v2"
echo "  - doctor_schedule_config"
echo "  - slot_audit_log"
echo ""

# ============================================================================
# SECTION 3: Setup Doctor Schedule (Example)
# ============================================================================

echo -e "\n[3] Setup Doctor Schedule (Example)\n"
echo "Run this Python script to configure a doctor's hours:"
echo ""
cat << 'PYTHON'
import asyncio
from datetime import time as time_type
from uuid import UUID

from api.app.db.session import async_session_local
from api.app.services.time_slot_service import TimeSlotService

async def setup_example():
    async with async_session_local() as db:
        service = TimeSlotService(db)
        
        # Use any doctor_id (create a doctor first if needed)
        doctor_id = UUID("f47ac10b-58cc-4372-a567-0e02b2c3d479")
        
        # Monday-Friday: 09:00-17:00
        for day in range(5):
            await service.set_doctor_schedule(
                doctor_id=doctor_id,
                day_of_week=day,
                work_start=time_type(9, 0),
                work_end=time_type(17, 0),
                break_start=time_type(13, 0),
                break_end=time_type(14, 0),
                default_duration=30,
                max_slots_per_day=16,
                is_working_day=True
            )
        
        # Saturday: 09:00-13:00
        await service.set_doctor_schedule(
            doctor_id=doctor_id,
            day_of_week=5,
            work_start=time_type(9, 0),
            work_end=time_type(13, 0),
            is_working_day=True
        )
        
        # Sunday: OFF
        await service.set_doctor_schedule(
            doctor_id=doctor_id,
            day_of_week=6,
            is_working_day=False
        )
        
        print("✓ Doctor schedule configured")

asyncio.run(setup_example())
PYTHON
echo ""

# ============================================================================
# SECTION 4: Generate Slots
# ============================================================================

echo -e "\n[4] Generate Slots for 30 Days\n"
echo "Via Python:"
echo ""
cat << 'PYTHON'
from datetime import date

async def generate():
    async with async_session_local() as db:
        service = TimeSlotService(db)
        doctor_id = UUID("f47ac10b-58cc-4372-a567-0e02b2c3d479")
        
        stats = await service.generate_slots_batch(
            doctor_id=doctor_id,
            start_date=date(2026, 4, 15),
            num_days=30,
            duration_minutes=30
        )
        
        print(f"Generated: {stats['generated']} days")
        print(f"Skipped: {stats['skipped']} days")
        print(f"Errors: {stats['errors']} days")

asyncio.run(generate())
PYTHON
echo ""
echo "Via cURL (if FastAPI running on localhost:8000):"
echo ""
echo "  curl -X POST 'http://localhost:8000/api/v1/slots/generate-batch' \\"
echo "    -H 'Content-Type: application/json' \\"
echo "    -d '{"
echo "      \"doctor_id\": \"f47ac10b-58cc-4372-a567-0e02b2c3d479\","
echo "      \"start_date\": \"2026-04-15\","
echo "      \"num_days\": 30,"
echo "      \"duration_minutes\": 30"
echo "    }'"
echo ""

# ============================================================================
# SECTION 5: API Testing
# ============================================================================

echo -e "\n[5] API Testing\n"
echo "Start FastAPI server:"
echo ""
echo "  # Terminal 1"
echo "  cd /path/to/workspace"
echo "  python -m uvicorn api.main:app --reload --host 0.0.0.0 --port 8000"
echo ""
echo "Test availab
le slots:"
echo ""
echo "  # Terminal 2"
echo "  curl -X GET 'http://localhost:8000/api/v1/slots/available' \\"
echo "    -G -d 'doctor_id=f47ac10b-58cc-4372-a567-0e02b2c3d479' \\"
echo "    -d 'date=2026-04-20'"
echo ""
echo "Response should include list of TimeSlot objects."
echo ""

# ============================================================================
# SECTION 6: Booking Test
# ============================================================================

echo -e "\n[6] Book a Slot\n"
echo "Book first available slot:"
echo ""
echo "  # Get first slot from availability list"
echo "  SLOT_ID='<first-slot-id-from-list>'"
echo "  PATIENT_ID='00000000-0000-0000-0000-000000000001'"
echo ""
echo "  curl -X POST 'http://localhost:8000/api/v1/slots/book' \\"
echo "    -H 'Content-Type: application/json' \\"
echo "    -d \"{"
echo "      \\\"slot_id\\\": \\\"$SLOT_ID\\\","
echo "      \\\"patient_id\\\": \\\"$PATIENT_ID\\\","
echo "      \\\"appointment_notes\\\": \\\"Annual checkup\\\","
echo "      \\\"idempotency_key\\\": \\\"booking-test-$(date +%s)\\\""
echo "    }\""
echo ""
echo "Expected response: 201 Created with appointment_id"
echo ""

# ============================================================================
# SECTION 7: Concurrent Test
# ============================================================================

echo -e "\n[7] Concurrent Booking Test (100 simultaneous)\n"
echo "Test zero-overlap guarantee:"
echo ""
cat << 'BASH'
#!/bin/bash

SLOT_ID="<same-slot-id>"
BASE_URL="http://localhost:8000/api/v1/slots/book"

successes=0
conflicts=0

for i in {1..100}; do
  patient_id=$(printf "00000000-0000-0000-0000-%012d" $i)
  
  response=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL" \
    -H 'Content-Type: application/json' \
    -d "{
      \"slot_id\": \"$SLOT_ID\",
      \"patient_id\": \"$patient_id\",
      \"idempotency_key\": \"concurrent-$i\"
    }")
  
  http_code=$(echo "$response" | tail -1)
  
  if [ "$http_code" == "201" ]; then
    ((successes++))
  elif [ "$http_code" == "409" ]; then
    ((conflicts++))
  fi
done &

wait

echo "Results:"
echo "  ✓ Successes (201): $successes"
echo "  ✗ Conflicts (409): $conflicts"
echo "Expected: 1 success, 99 conflicts (proving zero-doubles)"
BASH
echo ""

# ============================================================================
# SECTION 8: Audit Trail
# ============================================================================

echo -e "\n[8] View Audit Trail\n"
echo "Check all state changes for a slot:"
echo ""
echo "  psql -U postgres -d gsentinel_health -c \"SELECT * FROM slot_audit_log ORDER BY changed_at DESC LIMIT 10;\""
echo ""
echo "Or via API (if endpoint exposed):"
echo ""
echo "  curl -X GET 'http://localhost:8000/api/v1/slots/<slot-id>/audit-log'"
echo ""

# ============================================================================
# SECTION 9: Metrics & Health
# ============================================================================

echo -e "\n[9] Check Utilization Metrics\n"
echo ""
echo "  curl -X GET 'http://localhost:8000/api/v1/slots/doctors/<doctor-id>/utilization' \\"
echo "    -G -d 'date=2026-04-20'"
echo ""
echo "Expected:"
echo "  {"
echo "    \"total\": 16,"
echo "    \"booked\": 5,"
echo "    \"available\": 11,"
echo "    \"blocked\": 0,"
echo "    \"cancelled\": 0"
echo "  }"
echo ""

# ============================================================================
# SECTION 10: Run Full Example Script
# ============================================================================

echo -e "\n[10] Run Full Example Script\n"
echo ""
echo "  python examples/slot_based_appointments_guide.py"
echo ""
echo "This runs all 10 examples:"
echo "  1. Setup doctor schedule"
echo "  2. Generate slots"
echo "  3. List availability"
echo "  4. Book slot"
echo "  5. Test concurrent bookings"
echo "  6. Get utilization"
echo "  7. Cancel appointment"
echo "  8. View audit trail"
echo "  9. Cancellation stats"
echo "  10. Performance comparison"
echo ""

# ============================================================================
# TROUBLESHOOTING
# ============================================================================

cat << "EOF"

╔════════════════════════════════════════════════════════════════════════════╗
║                         TROUBLESHOOTING                                   ║
╚════════════════════════════════════════════════════════════════════════════╝

❌ Migration fails: "Table already exists"
  → Drop database and re-create: 
    dropdb gsentinel_health && createdb gsentinel_health
  → Run migrations: alembic upgrade head

❌ No slots generated
  → Check doctor_schedule_config table:
    SELECT * FROM doctor_schedule_config WHERE doctor_id='<doctor_id>';
  → Must have row for each day_of_week with is_working_day=true

❌ Query slow (> 50ms)
  → Verify index exists:
    SELECT * FROM pg_indexes WHERE tablename='time_slots';
  → Should see: idx_time_slots_doctor_date_status
  → Run: REINDEX TABLE time_slots;

❌ APIEndpoint returns 404
  → Verify endpoint registered:
    curl http://localhost:8000/docs
  → Should show /api/v1/slots/* endpoints

❌ SLOT_NOT_FOUND when booking
  → Generate slots first:
    POST /api/v1/slots/generate-batch
  → Verify slot exists:
    SELECT * FROM time_slots LIMIT 1;

❌ Cannot connect to PostgreSQL
  → Check connection string:
    echo $DATABASE_URL
  → Verify server running:
    psql -U postgres -c "SELECT 1"

❌ Concurrent test shows > 1 success
  → Database lock might be misconfigured
  → Check PostgreSQL transaction isolation:
    SHOW transaction_isolation;
  → Should be: read_committed (default is safe)

╔════════════════════════════════════════════════════════════════════════════╗
║                         NEXT STEPS                                         ║
╚════════════════════════════════════════════════════════════════════════════╝

1. Read documentation:
   - SLOT_BASED_REDESIGN_SUMMARY.md (10 mins)
   - ARCHITECTURE_SLOT_BASED_REDESIGN.md (60 mins)
   - DATETIME_VS_SLOTS_VISUAL_COMPARISON.md (15 mins)

2. Understand the system:
   - Models: api/app/models/time_slot_models.py
   - Service: api/app/services/time_slot_service.py
   - Endpoints: api/app/api/v1/endpoints/time_slots.py

3. Run examples:
   - python examples/slot_based_appointments_guide.py

4. Integrate with your frontend:
   - Call GET /api/v1/slots/available to list options
   - Call POST /api/v1/slots/book to reserve

5. Monitor in production:
   - GET /api/v1/slots/doctors/{id}/utilization for metrics
   - SELECT * FROM slot_audit_log for compliance

6. Contact support if issues:
   - Review SLOT_BASED_REDESIGN_INDEX.md for file locations
   - Check docstrings in code for parameter details

╚════════════════════════════════════════════════════════════════════════════╝

EOF

echo ""
echo "✓ Setup guide complete!"
echo ""
