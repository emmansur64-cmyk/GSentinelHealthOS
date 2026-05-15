"""Manejo global de excepciones para API."""

from __future__ import annotations

from datetime import datetime
from uuid import uuid4

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
from shared.utils import setup_logger


logger = setup_logger(__name__)


def _error_payload(status_code: int, message: str, request: Request) -> dict[str, str | int]:
    return {
        "success": False,
        "status_code": status_code,
        "error": message,
        "path": str(request.url.path),
        "timestamp": datetime.utcnow().isoformat(),
        "request_id": str(uuid4()),
    }


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(HTTPException)
    async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
        status_code = exc.status_code
        if status_code not in (400, 404):
            status_code = exc.status_code
        message = str(exc.detail)
        if status_code >= 500:
            logger.error("HTTPException interno en %s: %s", request.url.path, message)
            message = "Error interno del servidor"
        payload = _error_payload(status_code, message, request)
        return JSONResponse(status_code=status_code, content=payload, headers=getattr(exc, "headers", None))

    @app.exception_handler(ValueError)
    async def value_error_handler(request: Request, exc: ValueError) -> JSONResponse:
        logger.error("ValueError en %s: %s", request.url.path, exc, exc_info=True)
        payload = _error_payload(400, "Solicitud invalida", request)
        return JSONResponse(status_code=400, content=payload)
