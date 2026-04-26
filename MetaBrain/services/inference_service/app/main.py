from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from uuid import uuid4

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse, Response

from services.inference_service.app.routes import router
from services.inference_service.app.schemas import ErrorResponse
from services.inference_service.app.service import InferenceServiceError


class JsonFormatter(logging.Formatter):
    _reserved = {
        "name",
        "msg",
        "args",
        "levelname",
        "levelno",
        "pathname",
        "filename",
        "module",
        "exc_info",
        "exc_text",
        "stack_info",
        "lineno",
        "funcName",
        "created",
        "msecs",
        "relativeCreated",
        "thread",
        "threadName",
        "processName",
        "process",
    }

    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, object] = {
            "ts": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }
        for key, value in record.__dict__.items():
            if key in self._reserved or key.startswith("_"):
                continue
            payload[key] = value
        if record.exc_info:
            payload["error"] = str(record.exc_info[1])
        return json.dumps(payload, ensure_ascii=True, separators=(",", ":"))


def configure_json_logging() -> None:
    root = logging.getLogger()
    if getattr(root, "_inference_json_configured", False):
        return

    handler = logging.StreamHandler()
    handler.setFormatter(JsonFormatter())
    root.handlers = [handler]
    root.setLevel(logging.INFO)
    setattr(root, "_inference_json_configured", True)


configure_json_logging()
logger = logging.getLogger("cerebro_ai_med.distributed.inference")


app = FastAPI(title="inference-service", version="2.0.0")
app.include_router(router)


@app.middleware("http")
async def add_request_id(request: Request, call_next):
    request_id = request.headers.get("X-Request-ID") or str(uuid4())
    request.state.request_id = request_id

    response: Response = await call_next(request)
    response.headers["X-Request-ID"] = request_id
    return response


@app.exception_handler(RequestValidationError)
async def handle_request_validation(_: Request, exc: RequestValidationError) -> JSONResponse:
    logger.info("request_validation_error", extra={"validation_error_count": len(exc.errors())})
    payload = ErrorResponse.model_validate(
        {
            "error": {
                "code": "invalid_request",
                "message": "Request payload validation failed.",
                "category": "validation",
            }
        }
    )
    return JSONResponse(status_code=422, content=payload.model_dump(mode="json"))


@app.exception_handler(InferenceServiceError)
async def handle_service_error(request: Request, exc: InferenceServiceError) -> JSONResponse:
    logger.warning(
        "inference_service_error",
        extra={
            "request_id": getattr(request.state, "request_id", "unknown"),
            "code": exc.code,
            "category": exc.category,
        },
    )
    payload = ErrorResponse.model_validate(
        {
            "error": {
                "code": exc.code,
                "message": exc.message,
                "category": exc.category,
            }
        }
    )
    return JSONResponse(status_code=exc.status_code, content=payload.model_dump(mode="json"))


@app.exception_handler(Exception)
async def handle_unexpected_error(request: Request, exc: Exception) -> JSONResponse:
    logger.error(
        "unexpected_inference_error",
        extra={"request_id": getattr(request.state, "request_id", "unknown")},
        exc_info=exc,
    )
    payload = ErrorResponse.model_validate(
        {
            "error": {
                "code": "internal_error",
                "message": "Internal system error.",
                "category": "system",
            }
        }
    )
    return JSONResponse(status_code=500, content=payload.model_dump(mode="json"))
