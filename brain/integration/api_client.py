"""Cliente HTTP para comunicacion entre Brain y API."""

from __future__ import annotations

from datetime import datetime
import re
from typing import Any, Dict, Optional

import httpx

from brain.core.config import settings
from shared.logging_utils import mask_phone
from shared.utils import setup_logger

logger = setup_logger(__name__)


class APIClientError(RuntimeError):
    """Error controlado al invocar la API interna."""

    def __init__(self, message: str, status_code: int | None = None):
        super().__init__(message)
        self.status_code = status_code


class APIClient:
    """Cliente HTTP para consumir la API interna"""
    
    def __init__(
        self,
        base_url: str = settings.api_base_url,
        internal_api_key: str = settings.brain_api_key,
    ):
        """
        Args:
            base_url: URL base de la API
        """
        self.base_url = base_url.rstrip("/")
        self.internal_api_key = internal_api_key
        self.client = httpx.AsyncClient(base_url=base_url)

    def _headers(self) -> Dict[str, str]:
        return {"X-Internal-Key": self.internal_api_key}

    @staticmethod
    def _sanitize_endpoint(endpoint: str) -> str:
        by_phone_marker = "/patients/by-phone/"
        if by_phone_marker in endpoint:
            prefix, phone = endpoint.split(by_phone_marker, maxsplit=1)
            return f"{prefix}{by_phone_marker}{mask_phone(phone)}"

        return re.sub(r"\+?\d{8,15}", lambda m: mask_phone(m.group(0)), endpoint)

    @staticmethod
    def _extract_error_detail(response: httpx.Response) -> str:
        try:
            payload = response.json()
        except ValueError:
            return response.text or f"HTTP {response.status_code}"

        if isinstance(payload, dict):
            detail = payload.get("detail")
            if isinstance(detail, str):
                return detail
        return str(payload)

    @staticmethod
    def _normalize_lessons_payload(payload: Any) -> list[Dict[str, Any]]:
        """Normaliza payload de lecciones y descarta filas invalidas."""
        if not isinstance(payload, list):
            return []

        normalized: list[Dict[str, Any]] = []
        for item in payload:
            if not isinstance(item, dict):
                continue

            pattern = str(item.get("pattern") or "").strip()
            correct_action = str(item.get("correct_action") or "").strip()
            if not pattern or not correct_action:
                continue

            normalized.append(
                {
                    "id": item.get("id"),
                    "pattern": pattern,
                    "correct_action": correct_action,
                    "category": str(item.get("category") or ""),
                    "doctor_id": item.get("doctor_id"),
                    "created_at": item.get("created_at"),
                }
            )

        return normalized
    
    async def get(
        self,
        endpoint: str,
        params: Optional[Dict] = None,
        *,
        raise_on_error: bool = False,
    ) -> Optional[Any]:
        """GET request"""
        try:
            endpoint_label = self._sanitize_endpoint(endpoint)
            response = await self.client.get(
                endpoint,
                params=params,
                headers=self._headers(),
            )
            response.raise_for_status()
            logger.info(f"✓ GET {endpoint_label} - {response.status_code}")
            return response.json()
        except httpx.HTTPStatusError as e:
            detail = self._extract_error_detail(e.response)
            logger.error(f"Error GET {self._sanitize_endpoint(endpoint)}: {detail}")
            if raise_on_error:
                raise APIClientError(detail, status_code=e.response.status_code) from e
            return None
        except httpx.HTTPError as e:
            logger.error(f"Error GET {self._sanitize_endpoint(endpoint)}: {str(e)}")
            if raise_on_error:
                raise APIClientError(str(e)) from e
            return None
    
    async def post(
        self,
        endpoint: str,
        data: Dict,
        *,
        raise_on_error: bool = False,
    ) -> Optional[Any]:
        """POST request"""
        try:
            endpoint_label = self._sanitize_endpoint(endpoint)
            response = await self.client.post(
                endpoint,
                json=data,
                headers=self._headers(),
            )
            response.raise_for_status()
            logger.info(f"✓ POST {endpoint_label} - {response.status_code}")
            return response.json()
        except httpx.HTTPStatusError as e:
            detail = self._extract_error_detail(e.response)
            logger.error(f"Error POST {self._sanitize_endpoint(endpoint)}: {detail}")
            if raise_on_error:
                raise APIClientError(detail, status_code=e.response.status_code) from e
            return None
        except httpx.HTTPError as e:
            logger.error(f"Error POST {self._sanitize_endpoint(endpoint)}: {str(e)}")
            if raise_on_error:
                raise APIClientError(str(e)) from e
            return None
    
    async def put(self, endpoint: str, data: Dict) -> Optional[Any]:
        """PUT request"""
        try:
            endpoint_label = self._sanitize_endpoint(endpoint)
            response = await self.client.put(endpoint, json=data, headers=self._headers())
            response.raise_for_status()
            logger.info(f"✓ PUT {endpoint_label} - {response.status_code}")
            return response.json()
        except httpx.HTTPError as e:
            logger.error(f"Error PUT {self._sanitize_endpoint(endpoint)}: {str(e)}")
            return None
    
    async def delete(self, endpoint: str) -> bool:
        """DELETE request"""
        try:
            endpoint_label = self._sanitize_endpoint(endpoint)
            response = await self.client.delete(endpoint, headers=self._headers())
            response.raise_for_status()
            logger.info(f"✓ DELETE {endpoint_label} - {response.status_code}")
            return True
        except httpx.HTTPError as e:
            logger.error(f"Error DELETE {self._sanitize_endpoint(endpoint)}: {str(e)}")
            return False

    async def get_or_create_patient_by_phone(self, phone: str) -> Optional[Dict[str, Any]]:
        return await self.get(f"/api/v1/patients/by-phone/{phone}")

    async def list_doctors_by_specialty(self, specialty: str) -> list[Dict[str, Any]]:
        response = await self.get(f"/api/v1/doctors/specialty/{specialty}")
        if isinstance(response, list):
            return response
        return []

    async def create_appointment(
        self,
        *,
        patient_id: str,
        doctor_id: str,
        appointment_at: datetime,
        reason: str,
    ) -> Dict[str, Any]:
        response = await self.post(
            "/api/v1/appointments",
            {
                "patient_id": patient_id,
                "doctor_id": doctor_id,
                "date_time": appointment_at.isoformat(),
                "reason": reason,
                "status": "scheduled",
            },
            raise_on_error=True,
        )
        if not isinstance(response, dict):
            raise APIClientError("La API devolvio una respuesta invalida al crear la cita")
        return response

    async def get_patient_appointments(self, patient_id: str) -> list[Dict[str, Any]]:
        response = await self.get(f"/api/v1/appointments/patient/{patient_id}")
        if isinstance(response, list):
            return response
        return []

    async def cancel_appointment(self, appointment_id: str) -> Dict[str, Any]:
        try:
            response = await self.client.delete(
                f"/api/v1/appointments/{appointment_id}",
                headers=self._headers(),
            )
            response.raise_for_status()
            payload = response.json()
        except httpx.HTTPStatusError as e:
            detail = self._extract_error_detail(e.response)
            logger.error(f"Error DELETE /api/v1/appointments/{appointment_id}: {detail}")
            raise APIClientError(detail, status_code=e.response.status_code) from e
        except httpx.HTTPError as e:
            logger.error(f"Error DELETE /api/v1/appointments/{appointment_id}: {str(e)}")
            raise APIClientError(str(e)) from e

        if not isinstance(payload, dict):
            raise APIClientError("La API devolvio una respuesta invalida al cancelar la cita")
        return payload

    async def get_bot_lessons(self, doctor_id: str, *, limit: int = 50) -> list[Dict[str, Any]]:
        """Obtiene las lecciones de un doctor con fallback de endpoint."""
        # Endpoint service-to-service usado por Brain
        response = await self.get(f"/api/v1/admin/lessons/{doctor_id}")
        lessons = self._normalize_lessons_payload(response)
        if lessons:
            return lessons[:limit]

        # Fallback por compatibilidad con endpoint de dashboard
        fallback = await self.get("/api/v1/admin/learn", params={"skip": 0, "limit": limit})
        return self._normalize_lessons_payload(fallback)[:limit]
    
    async def close(self):
        """Cierra la conexión HTTP"""
        await self.client.aclose()


# Singleton instance (opcional)
_api_client: Optional[APIClient] = None


async def get_api_client(base_url: str = "http://localhost:8000") -> APIClient:
    """Factory para obtener cliente de API"""
    global _api_client
    if _api_client is None:
        _api_client = APIClient(base_url=base_url)
    return _api_client
