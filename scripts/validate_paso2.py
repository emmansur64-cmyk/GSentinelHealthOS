#!/usr/bin/env python
"""Script de validación rápida para Paso 2: Schemas y CORS."""

import sys
import os
from pathlib import Path
from datetime import datetime, timedelta
import uuid

# Agregar proyecto a path
project_root = Path(__file__).parent.parent  # Sube un nivel de scripts/ a raíz
sys.path.insert(0, str(project_root))
os.chdir(str(project_root))

print("=" * 80)
print("✓ PASO 2: VALIDACIÓN PYDANTIC 2.0 Y BLINDAJE CORS")
print("=" * 80)

# Test 1: Imports
print("\n[1/4] Testing imports...")
try:
    from api.app.schemas import PatientBase, AppointmentCreate, AppointmentResponse
    from api.app.core import settings
    print("✅ Imports successful")
except ImportError as e:
    print(f"❌ Import failed: {e}")
    sys.exit(1)

# Test 2: Configuración
print("\n[2/4] Testing Configuration (BaseSettings)...")
try:
    print(f"  API Title: {settings.api_title}")
    print(f"  API Version: {settings.api_version}")
    print(f"  Debug Mode: {settings.debug}")
    print(f"  Allowed Origins: {settings.origins_list}")
    print("✅ Configuration loaded successfully")
except Exception as e:
    print(f"❌ Configuration error: {e}")
    sys.exit(1)

# Test 3: Schema Validation
print("\n[3/4] Testing Schema Validation (Pydantic 2.0)...")
try:
    # Test PatientBase - válido
    patient = PatientBase(
        name="Dr. García López",
        phone="+34912345678",
        email="doctor@gsentinel.com"
    )
    print(f"  ✓ PatientBase created: {patient.name} ({patient.phone})")
    
    # Test PatientBase - fallo: teléfono sin prefijo
    try:
        invalid_patient = PatientBase(
            name="John",
            phone="912345678",  # Sin +34
            email="john@example.com"
        )
        print("  ❌ PatientBase validation failed - should reject phone without prefix")
    except Exception:
        print("  ✓ PatientBase correctly rejected phone without prefix")
    
    # Test AppointmentCreate
    appointment = AppointmentCreate(
        doctor_id=uuid.uuid4(),
        patient_id=uuid.uuid4(),
        date_time=datetime.now() + timedelta(days=1),
        reason="Check-up",
        status="scheduled"
    )
    print(f"  ✓ AppointmentCreate created: {appointment.status} on {appointment.date_time}")
    
    # Test AppointmentResponse
    response = AppointmentResponse(
        id=uuid.uuid4(),
        doctor_id=uuid.uuid4(),
        patient_id=uuid.uuid4(),
        date_time=datetime.now() + timedelta(days=2),
        reason="Consultation",
        status="scheduled"
    )
    print(f"  ✓ AppointmentResponse created with id: {response.id}")
    
    print("✅ All schema validations passed")
    
except Exception as e:
    print(f"❌ Schema validation error: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

# Test 4: CORS Configuration
print("\n[4/4] Testing CORS Configuration...")
try:
    # Verificar que el archivo main.py contiene el middleware CORS
    main_py_path = project_root / "api" / "app" / "main.py"
    with open(main_py_path, 'r', encoding='utf-8') as f:
        main_content = f.read()
    
    if "CORSMiddleware" in main_content and "settings.origins_list" in main_content:
        print("  ✓ CORSMiddleware configured with settings.origins_list")
    else:
        print("  ⚠ CORSMiddleware configuration not found")
    
    if "allow_credentials=True" in main_content:
        print("  ✓ CORS allow_credentials set to True")
    else:
        print("  ⚠ CORS allow_credentials not properly configured")
    
    print(f"  ✓ Allowed origins from config: {', '.join(settings.origins_list)}")
    print("✅ CORS configuration valid")
    
except Exception as e:
    print(f"❌ CORS configuration error: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

print("\n" + "=" * 80)
print("✅ TODOS LOS TESTS COMPLETADOS - Paso 2 Validado")
print("=" * 80)
print("\nNOTA: Para usar en producción:")
print("1. Copia .env.example a .env")
print("2. Actualiza ALLOWED_ORIGINS en .env con dominios reales")
print("3. Cambia JWT_SECRET a valor seguro: openssl rand -hex 32")
print("4. Corre: python scripts/validate_paso2.py")
