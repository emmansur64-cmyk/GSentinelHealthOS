"""
Tests de integración - Flujo E2E completo
"""

import pytest
from datetime import datetime
from fastapi.testclient import TestClient

from api.app.main import app


@pytest.fixture
def client():
    """Cliente de test para FastAPI"""
    return TestClient(app)


@pytest.fixture
def sample_patient(client):
    """Crea un paciente de prueba"""
    response = client.post(
        "/api/v1/patients",
        json={
            "name": "Paciente Test",
            "email": "patient@test.com",
            "phone": "+34612345678"
        }
    )
    assert response.status_code == 201
    return response.json()


@pytest.fixture
def sample_doctor(client):
    """Crea un doctor de prueba"""
    response = client.post(
        "/api/v1/doctors",
        json={
            "name": "Dr. Test",
            "email": "doctor@hospital.com",
            "specialty": "Cardiología",
            "phone": "+34901234567",
            "license_number": "MAT-TEST-001"
        }
    )
    assert response.status_code == 201
    return response.json()


class TestAPIIntegration:
    """Tests de integración del API"""
    
    def test_health_check(self, client):
        """Debe verificar el estado del API"""
        response = client.get("/api/health/readiness")
        
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ready"
        assert "redis_connected" in data
        assert "outbox" in data
        assert "providers" in data
        assert "queue_depths" in data
        assert "brain_metrics" in data
        assert "ratios" in data

        outbox = data["outbox"]
        assert "status" in outbox
        assert "pending" in outbox
        assert "failed" in outbox
        assert "near_max_attempts" in outbox

        providers = data["providers"]
        assert "status" in providers
        assert "circuits" in providers

        queue_depths = data["queue_depths"]
        assert "whatsapp_incoming" in queue_depths
        assert "whatsapp_outgoing" in queue_depths

        brain_metrics = data["brain_metrics"]
        assert "system_reset_total" in brain_metrics
        assert "lock_contention_total" in brain_metrics
        assert "messages_processed_total" in brain_metrics

        ratios = data["ratios"]
        assert "system_reset_per_processed" in ratios
        assert "lock_contention_per_processed" in ratios

        alerts = data["alerts"]
        assert "lock_contention_high" in alerts
        assert "queue_backlog_high" in alerts
        assert "system_reset_ratio_high" in alerts

    def test_health_dashboard_summary_includes_queue_and_reset_metrics(self, client):
        """Debe exponer métricas operativas y de negocio para el dashboard."""
        response = client.get("/api/health/dashboard-summary")

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ready"
        assert "outbox" in data
        assert "providers" in data

        queues = data["queues"]
        assert "whatsapp_incoming" in queues
        assert "whatsapp_outgoing" in queues

        brain = data["brain"]
        assert "system_reset_total" in brain
        assert "lock_contention_total" in brain
        assert "messages_processed_total" in brain

        ratios = data["ratios"]
        assert "system_reset_per_processed" in ratios
        assert "lock_contention_per_processed" in ratios

        alerts = data["alerts"]
        assert "lock_contention_high" in alerts
        assert "queue_backlog_high" in alerts
        assert "system_reset_ratio_high" in alerts

    def test_health_outbox_endpoint(self, client):
        """Debe exponer estado de outbox para alertas operativas."""
        response = client.get("/api/health/outbox")
        assert response.status_code in (200, 503)

        data = response.json()
        assert "status" in data
        assert "outbox" in data
        assert "timestamp" in data

        outbox = data["outbox"]
        assert "status" in outbox
        assert "pending" in outbox
        assert "failed" in outbox

    def test_health_providers_endpoint(self, client):
        """Debe exponer estado de circuit breakers por proveedor."""
        response = client.get("/api/health/providers")
        assert response.status_code in (200, 503)

        data = response.json()
        assert "status" in data
        assert "providers" in data

        providers = data["providers"]
        assert "status" in providers
        assert "circuits" in providers
    
    def test_create_patient_flow(self, client):
        """Debe crear un paciente completamente"""
        response = client.post(
            "/api/v1/patients",
            json={
                "name": "Juan Pérez",
                "email": "juan@test.com",
                "phone": "+34612345678",
                "date_of_birth": "1985-03-15T00:00:00"
            }
        )
        
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "Juan Pérez"
        assert data["email"] == "juan@test.com"
        assert "id" in data
    
    def test_duplicate_patient_email(self, client):
        """Debe rechazar paciente con email duplicado"""
        # Crear primero
        client.post(
            "/api/v1/patients",
            json={
                "name": "Juan",
                "email": "duplicate@test.com"
            }
        )
        
        # Intentar crear con el mismo email
        response = client.post(
            "/api/v1/patients",
            json={
                "name": "Otro Juan",
                "email": "duplicate@test.com"
            }
        )
        
        assert response.status_code == 400
    
    def test_get_patient(self, client, sample_patient):
        """Debe obtener un paciente existente"""
        patient_id = sample_patient["id"]
        
        response = client.get(f"/api/v1/patients/{patient_id}")
        
        assert response.status_code == 200
        assert response.json()["id"] == patient_id
    
    def test_list_patients(self, client, sample_patient):
        """Debe listar pacientes con paginación"""
        response = client.get("/api/v1/patients?skip=0&limit=10")
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) > 0
    
    def test_update_patient(self, client, sample_patient):
        """Debe actualizar datos de un paciente"""
        patient_id = sample_patient["id"]
        
        response = client.put(
            f"/api/v1/patients/{patient_id}",
            json={"phone": "+34698765432"}
        )
        
        assert response.status_code == 200
        assert response.json()["phone"] == "+34698765432"
    
    def test_delete_patient(self, client, sample_patient):
        """Debe eliminar un paciente"""
        patient_id = sample_patient["id"]
        
        response = client.delete(f"/api/v1/patients/{patient_id}")
        
        assert response.status_code == 204
        
        # Verificar que fue eliminado
        verify = client.get(f"/api/v1/patients/{patient_id}")
        assert verify.status_code == 404
    
    def test_doctor_crud_flow(self, client):
        """Debe completar CRUD de doctores"""
        # CREATE
        create_response = client.post(
            "/api/v1/doctors",
            json={
                "name": "Dr. Cardiólogo",
                "email": "cardio@hospital.com",
                "specialty": "Cardiología",
                "phone": "+34901234567",
                "license_number": "MAT-CARDIO-001"
            }
        )
        assert create_response.status_code == 201
        doctor_id = create_response.json()["id"]
        
        # READ
        read_response = client.get(f"/api/v1/doctors/{doctor_id}")
        assert read_response.status_code == 200
        assert read_response.json()["specialty"] == "Cardiología"
        
        # UPDATE
        update_response = client.put(
            f"/api/v1/doctors/{doctor_id}",
            json={"phone": "+34902222222"}
        )
        assert update_response.status_code == 200
        
        # DELETE
        delete_response = client.delete(f"/api/v1/doctors/{doctor_id}")
        assert delete_response.status_code == 204
    
    def test_list_doctors_by_specialty(self, client, sample_doctor):
        """Debe listar doctores por especialidad"""
        response = client.get("/api/v1/doctors/specialty/Cardiología")
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)


class TestWhatsAppGatewayIntegration:
    """Tests de integración del Gateway de WhatsApp"""
    
    def test_webhook_verify(self, client):
        """Debe verificar correctamente el webhook"""
        response = client.get(
            "/webhook/whatsapp",
            params={
                "hub.mode": "subscribe",
                "hub.verify_token": "test_verify_token",
                "hub.challenge": "challenge_string"
            }
        )
        
        # Resultado depende de la configuración del gateway
        assert response.status_code in [200, 403]
    
    def test_webhook_receive_message(self, client):
        """Debe recibir mensaje del webhook de Meta"""
        payload = {
            "entry": [{
                "changes": [{
                    "value": {
                        "messages": [{
                            "from": "+34612345678",
                            "id": "msg_123",
                            "timestamp": str(datetime.utcnow().timestamp()),
                            "type": "text",
                            "text": {"body": "Test message"}
                        }]
                    }
                }]
            }]
        }
        
        response = client.post(
            "/webhook/whatsapp",
            json=payload,
            headers={
                "X-Hub-Signature-256": "sha256=test"  # Será validado en el gateway
            }
        )
        
        assert response.status_code in [200, 403]


class TestEndToEndFlow:
    """Tests E2E del flujo completo"""
    
    def test_complete_appointment_booking_flow(self, client):
        """Flujo completo: crear paciente → doctor → cita"""
        
        # 1. Crear paciente
        patient_response = client.post(
            "/api/v1/patients",
            json={
                "name": "Paciente E2E",
                "email": "e2e@test.com",
                "phone": "+34612345678"
            }
        )
        assert patient_response.status_code == 201
        patient_id = patient_response.json()["id"]
        
        # 2. Crear doctor
        doctor_response = client.post(
            "/api/v1/doctors",
            json={
                "name": "Dr. E2E",
                "email": "dre2e@hospital.com",
                "specialty": "Medicina General",
                "phone": "+34901234567",
                "license_number": "MAT-E2E-001"
            }
        )
        assert doctor_response.status_code == 201
        doctor_id = doctor_response.json()["id"]
        
        # 3. (Opcional) Crear cita
        # En producción, esto vendría del Brain via API
        # Por ahora solo verificamos que los endpoints funcionan
        
        assert patient_id is not None
        assert doctor_id is not None
    
    def test_patient_doctor_consistency(self, client, sample_patient, sample_doctor):
        """Verifica consistencia entre datos de paciente y doctor"""
        
        patient_resp = client.get(f"/api/v1/patients/{sample_patient['id']}")
        doctor_resp = client.get(f"/api/v1/doctors/{sample_doctor['id']}")
        
        patient = patient_resp.json()
        doctor = doctor_resp.json()
        
        assert patient["id"] == sample_patient["id"]
        assert doctor["id"] == sample_doctor["id"]
        
        # Ambos deben ser accesibles y consistentes
        assert patient_resp.status_code == 200
        assert doctor_resp.status_code == 200
