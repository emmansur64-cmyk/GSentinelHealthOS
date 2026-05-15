"""
Security regression suite — GSentinelHealthOS API.

Verifica que TODOS los endpoints PHI rechacen acceso anónimo con 401 o 403.
Corre contra cualquier entorno: pytest --base-url=http://127.0.0.1:8000

Uso:
    pytest api/tests/security/test_auth_regression.py -v --base-url=http://127.0.0.1:8000
"""
from __future__ import annotations

import os
import pytest
import httpx

BASE_URL = os.getenv("API_BASE_URL", "http://127.0.0.1:8000")

ANON_HEADERS: dict = {}
FAKE_JWT_HEADERS = {"Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.fake.signature"}
FAKE_INTERNAL_KEY_HEADERS = {"X-Internal-Key": "invalid-key-12345"}


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _client() -> httpx.Client:
    return httpx.Client(base_url=BASE_URL, timeout=10.0, follow_redirects=False)


def assert_auth_required(response: httpx.Response, endpoint: str) -> None:
    assert response.status_code in (401, 403), (
        f"SECURITY FAIL: {endpoint} returned {response.status_code} for anonymous request "
        f"(expected 401 or 403). Body: {response.text[:200]}"
    )


def assert_invalid_jwt_rejected(response: httpx.Response, endpoint: str) -> None:
    assert response.status_code in (401, 403), (
        f"SECURITY FAIL: {endpoint} returned {response.status_code} for forged JWT "
        f"(expected 401 or 403). Body: {response.text[:200]}"
    )


# ─────────────────────────────────────────────────────────────────────────────
# FASE 1 — Patients (PHI endpoints)
# ─────────────────────────────────────────────────────────────────────────────

class TestPatientsAuth:
    def test_list_patients_anonymous(self):
        with _client() as c:
            r = c.get("/api/v1/patients/")
        assert_auth_required(r, "GET /api/v1/patients/")

    def test_list_patients_fake_jwt(self):
        with _client() as c:
            r = c.get("/api/v1/patients/", headers=FAKE_JWT_HEADERS)
        assert_invalid_jwt_rejected(r, "GET /api/v1/patients/ [fake JWT]")

    def test_get_patient_anonymous(self):
        with _client() as c:
            r = c.get("/api/v1/patients/00000000-0000-0000-0000-000000000001")
        assert_auth_required(r, "GET /api/v1/patients/{id}")

    def test_create_patient_anonymous(self):
        with _client() as c:
            r = c.post("/api/v1/patients/", json={
                "name": "Test", "email": "test@example.com", "phone": "+5491100000000"
            })
        assert_auth_required(r, "POST /api/v1/patients/")

    def test_update_patient_anonymous(self):
        with _client() as c:
            r = c.put(
                "/api/v1/patients/00000000-0000-0000-0000-000000000001",
                json={"name": "Hacked"}
            )
        assert_auth_required(r, "PUT /api/v1/patients/{id}")

    def test_delete_patient_anonymous(self):
        with _client() as c:
            r = c.delete("/api/v1/patients/00000000-0000-0000-0000-000000000001")
        assert_auth_required(r, "DELETE /api/v1/patients/{id}")

    def test_whatsapp_upsert_requires_internal_key(self):
        with _client() as c:
            r = c.post("/api/v1/patients/whatsapp-upsert", json={
                "phone": "+5491100000000", "full_name": "Test"
            })
        assert_auth_required(r, "POST /api/v1/patients/whatsapp-upsert")

    def test_whatsapp_upsert_fake_internal_key_rejected(self):
        with _client() as c:
            r = c.post(
                "/api/v1/patients/whatsapp-upsert",
                json={"phone": "+5491100000000", "full_name": "Test"},
                headers=FAKE_INTERNAL_KEY_HEADERS
            )
        assert r.status_code in (401, 403), (
            f"SECURITY FAIL: whatsapp-upsert accepted fake internal key, returned {r.status_code}"
        )


# ─────────────────────────────────────────────────────────────────────────────
# FASE 1 — Doctors
# ─────────────────────────────────────────────────────────────────────────────

class TestDoctorsAuth:
    def test_list_doctors_anonymous(self):
        with _client() as c:
            r = c.get("/api/v1/doctors/")
        assert_auth_required(r, "GET /api/v1/doctors/")

    def test_get_doctor_anonymous(self):
        with _client() as c:
            r = c.get("/api/v1/doctors/00000000-0000-0000-0000-000000000001")
        assert_auth_required(r, "GET /api/v1/doctors/{id}")

    def test_create_doctor_anonymous(self):
        with _client() as c:
            r = c.post("/api/v1/doctors/", json={
                "name": "Dr. Test", "email": "dr@test.com",
                "specialty": "general", "license_number": "MAT-12345"
            })
        assert_auth_required(r, "POST /api/v1/doctors/")

    def test_update_doctor_anonymous(self):
        with _client() as c:
            r = c.put(
                "/api/v1/doctors/00000000-0000-0000-0000-000000000001",
                json={"name": "Hacked Doctor"}
            )
        assert_auth_required(r, "PUT /api/v1/doctors/{id}")

    def test_delete_doctor_anonymous(self):
        with _client() as c:
            r = c.delete("/api/v1/doctors/00000000-0000-0000-0000-000000000001")
        assert_auth_required(r, "DELETE /api/v1/doctors/{id}")

    def test_list_by_specialty_anonymous(self):
        with _client() as c:
            r = c.get("/api/v1/doctors/specialty/cardiologia")
        assert_auth_required(r, "GET /api/v1/doctors/specialty/{specialty}")


# ─────────────────────────────────────────────────────────────────────────────
# FASE 1 — Slots (tiempo de citas)
# ─────────────────────────────────────────────────────────────────────────────

class TestSlotsAuth:
    def test_generate_slots_anonymous(self):
        with _client() as c:
            r = c.post("/api/v1/slots/generate", json={
                "doctor_id": 1, "slot_date": "2026-05-20T00:00:00Z",
                "start_hour": 9, "end_hour": 17, "duration_minutes": 30
            })
        assert_auth_required(r, "POST /api/v1/slots/generate")

    def test_get_available_slots_anonymous(self):
        with _client() as c:
            r = c.get("/api/v1/slots/available?doctor_id=1&date=2026-05-20")
        assert_auth_required(r, "GET /api/v1/slots/available")

    def test_book_slot_anonymous(self):
        with _client() as c:
            r = c.post("/api/v1/slots/book", json={"slot_id": 1, "patient_id": 1})
        assert_auth_required(r, "POST /api/v1/slots/book")

    def test_book_next_by_priority_anonymous(self):
        with _client() as c:
            r = c.post("/api/v1/slots/book-next-by-priority", json={
                "doctor_id": 1, "slot_date": "2026-05-20T00:00:00Z",
                "patient_id": 1, "priority": "normal"
            })
        assert_auth_required(r, "POST /api/v1/slots/book-next-by-priority")

    def test_cancel_appointment_anonymous(self):
        with _client() as c:
            r = c.post("/api/v1/slots/appointments/1/cancel")
        assert_auth_required(r, "POST /api/v1/slots/appointments/{id}/cancel")

    def test_cancel_appointment_enumeration(self):
        """Confirm múltiples IDs enteros no son cancelables anónimamente."""
        with _client() as c:
            for appt_id in (1, 2, 100, 9999):
                r = c.post(f"/api/v1/slots/appointments/{appt_id}/cancel")
                assert r.status_code in (401, 403), (
                    f"SECURITY FAIL: appointment {appt_id} cancellation returned {r.status_code}"
                )

    def test_reschedule_appointment_anonymous(self):
        with _client() as c:
            r = c.post(
                "/api/v1/slots/appointments/1/reschedule",
                json={"new_slot_id": 99}
            )
        assert_auth_required(r, "POST /api/v1/slots/appointments/{id}/reschedule")

    def test_reassignment_audit_anonymous(self):
        with _client() as c:
            r = c.get("/api/v1/slots/reassignment-audit?doctor_id=1")
        assert_auth_required(r, "GET /api/v1/slots/reassignment-audit")

    def test_urgent_sla_anonymous(self):
        with _client() as c:
            r = c.get("/api/v1/slots/urgent-sla?doctor_id=1")
        assert_auth_required(r, "GET /api/v1/slots/urgent-sla")

    def test_utilization_anonymous(self):
        with _client() as c:
            r = c.get("/api/v1/slots/utilization?doctor_id=1&date=2026-05-20")
        assert_auth_required(r, "GET /api/v1/slots/utilization")


# ─────────────────────────────────────────────────────────────────────────────
# Buffer Slots
# ─────────────────────────────────────────────────────────────────────────────

class TestBufferSlotsAuth:
    def test_book_with_buffer_anonymous(self):
        with _client() as c:
            r = c.post("/api/v1/slots/book-with-buffer", json={
                "slot_id": 1, "patient_id": 1, "buffer_minutes": 15
            })
        assert_auth_required(r, "POST /api/v1/slots/book-with-buffer")

    def test_cancel_with_buffer_release_anonymous(self):
        with _client() as c:
            r = c.post("/api/v1/slots/cancel-with-buffer-release", json={
                "appointment_id": 1, "buffer_minutes": 15
            })
        assert_auth_required(r, "POST /api/v1/slots/cancel-with-buffer-release")

    def test_buffer_impact_anonymous(self):
        with _client() as c:
            r = c.get("/api/v1/slots/buffer-impact/1?slot_date=2026-05-20")
        assert_auth_required(r, "GET /api/v1/slots/buffer-impact/{doctor_id}")

    def test_buffer_integrity_check_anonymous(self):
        with _client() as c:
            r = c.get("/api/v1/slots/buffer-integrity-check/1?slot_date=2026-05-20")
        assert_auth_required(r, "GET /api/v1/slots/buffer-integrity-check/{doctor_id}")


# ─────────────────────────────────────────────────────────────────────────────
# JWT validation — tokens inválidos/expirados
# ─────────────────────────────────────────────────────────────────────────────

class TestJWTValidation:
    ENDPOINTS_REQUIRING_JWT = [
        ("GET", "/api/v1/patients/"),
        ("GET", "/api/v1/doctors/"),
        ("POST", "/api/v1/slots/book"),
        ("POST", "/api/v1/slots/appointments/1/cancel"),
    ]

    @pytest.mark.parametrize("method,path", ENDPOINTS_REQUIRING_JWT)
    def test_forged_jwt_rejected(self, method: str, path: str):
        with _client() as c:
            r = c.request(method, path, headers=FAKE_JWT_HEADERS)
        assert r.status_code in (401, 403), (
            f"SECURITY FAIL: {method} {path} accepted forged JWT, returned {r.status_code}"
        )

    @pytest.mark.parametrize("method,path", ENDPOINTS_REQUIRING_JWT)
    def test_expired_jwt_rejected(self, method: str, path: str):
        # Token JWT con exp en el pasado (2020-01-01)
        expired_token = (
            "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9."
            "eyJzdWIiOiJ0ZXN0IiwiZXhwIjoxNTc3ODM2ODAwfQ."
            "invalid_signature_for_expired_token"
        )
        with _client() as c:
            r = c.request(method, path, headers={"Authorization": f"Bearer {expired_token}"})
        assert r.status_code in (401, 403), (
            f"SECURITY FAIL: {method} {path} accepted expired JWT, returned {r.status_code}"
        )


# ─────────────────────────────────────────────────────────────────────────────
# Tenant isolation — cross-tenant requests
# ─────────────────────────────────────────────────────────────────────────────

class TestTenantIsolation:
    def test_mismatched_clinic_id_header_rejected(self):
        """X-Clinic-Id que no coincide con JWT debe ser rechazado."""
        with _client() as c:
            r = c.get(
                "/api/v1/patients/",
                headers={
                    "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.fake.sig",
                    "X-Clinic-Id": "00000000-0000-0000-0000-000000000999",
                }
            )
        assert r.status_code in (401, 403), (
            f"SECURITY FAIL: cross-tenant header + fake JWT returned {r.status_code}"
        )


# ─────────────────────────────────────────────────────────────────────────────
# OAuth2 state CSRF
# ─────────────────────────────────────────────────────────────────────────────

class TestOAuth2CSRFState:
    def test_callback_with_raw_uuid_state_rejected(self):
        """El callback NO debe aceptar un UUID raw como state (sin firma HMAC)."""
        with _client() as c:
            r = c.get(
                "/api/meta/embedded-signup/callback",
                params={
                    "code": "fake_oauth_code_12345",
                    "state": "00000000-0000-0000-0000-000000000001",
                }
            )
        # Debe rechazar: sin auth O state inválido (no HMAC firmado)
        assert r.status_code in (400, 401, 403, 422), (
            f"SECURITY FAIL: OAuth callback accepted raw UUID state, returned {r.status_code}. "
            f"Body: {r.text[:200]}"
        )

    def test_callback_requires_authentication(self):
        """El callback sin JWT debe rechazarse con 401."""
        with _client() as c:
            r = c.post(
                "/api/meta/embedded-signup/callback",
                json={"code": "fake_code", "state": "fake_state"}
            )
        assert r.status_code in (401, 403), (
            f"SECURITY FAIL: OAuth callback without auth returned {r.status_code}"
        )

    def test_initiate_requires_authentication(self):
        """El endpoint de initiate sin JWT debe rechazarse."""
        with _client() as c:
            r = c.post(
                "/api/meta/embedded-signup/initiate",
                json={"clinic_id": "00000000-0000-0000-0000-000000000001"}
            )
        assert r.status_code in (401, 403), (
            f"SECURITY FAIL: OAuth initiate without auth returned {r.status_code}"
        )


# ─────────────────────────────────────────────────────────────────────────────
# WebSocket — JWT no en query string
# ─────────────────────────────────────────────────────────────────────────────

class TestWebSocketAuth:
    def test_ws_with_jwt_in_query_param_rejected(self):
        """WebSocket con token en ?token= debe ser rechazado (legacy inseguro)."""
        import websocket as ws_lib
        try:
            conn = ws_lib.create_connection(
                f"ws://127.0.0.1:8000/ws/notifications?token=eyJhbGciOiJIUzI1NiJ9.fake.sig",
                timeout=3
            )
            conn.close()
            pytest.fail("SECURITY FAIL: WebSocket accepted JWT via query param")
        except Exception:
            pass  # Conexión rechazada = correcto

    def test_ws_without_auth_rejected(self):
        """WebSocket sin ninguna auth debe ser rechazado."""
        import websocket as ws_lib
        try:
            conn = ws_lib.create_connection(
                "ws://127.0.0.1:8000/ws/notifications",
                timeout=3
            )
            conn.close()
            pytest.fail("SECURITY FAIL: WebSocket connected without authentication")
        except Exception:
            pass  # Conexión rechazada = correcto


# ─────────────────────────────────────────────────────────────────────────────
# Smoke — endpoints públicos que SÍ deben ser accesibles
# ─────────────────────────────────────────────────────────────────────────────

class TestPublicEndpoints:
    def test_liveness_public(self):
        with _client() as c:
            r = c.get("/api/health/liveness")
        assert r.status_code == 200, f"Health liveness should be 200, got {r.status_code}"

    def test_root_public(self):
        with _client() as c:
            r = c.get("/")
        assert r.status_code == 200, f"Root should be 200, got {r.status_code}"

    def test_auth_token_endpoint_exists(self):
        """El endpoint de login no debe requerir auth previa."""
        with _client() as c:
            r = c.post("/api/v1/auth/token", data={
                "username": "nonexistent@test.com",
                "password": "wrongpassword",
                "grant_type": "password"
            })
        # Debe devolver 401 (credenciales inválidas) NO 403 (auth requerida)
        assert r.status_code in (400, 401, 422), (
            f"Auth token endpoint unexpected status: {r.status_code}"
        )
