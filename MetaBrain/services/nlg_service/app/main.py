"""FastAPI app initialization, logging setup, exception handlers."""

from __future__ import annotations

import json
import logging
import uuid
from datetime import datetime, timezone

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from services.nlg_service.app.routes import router, get_llm_status_snapshot
from services.nlg_service.app.engine import NLGEngineError
from services.nlg_service.app.schemas import ErrorResponse


# JSON Logging Setup
class JsonFormatter(logging.Formatter):
    """Format logs as JSON for structured logging."""
    
    _reserved = {
        "name", "msg", "args", "created", "filename", "funcName",
        "levelname", "levelno", "lineno", "module", "msecs", "message",
        "pathname", "process", "processName", "relativeCreated", "thread",
        "threadName", "exc_info", "exc_text", "stack_info", "asctime",
    }
    
    def format(self, record: logging.LogRecord) -> str:
        """Format log record as JSON."""
        log_obj = {
            "ts": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }
        
        # Add custom fields from extra
        for key, value in record.__dict__.items():
            if key not in self._reserved and not key.startswith("_"):
                log_obj[key] = value
        
        # Add error if present
        if record.exc_info:
            log_obj["error"] = {
                "type": record.exc_info[0].__name__,
                "message": str(record.exc_info[1]),
            }
        
        return json.dumps(log_obj, ensure_ascii=False, default=str)


def configure_json_logging() -> None:
    """Configure root logger with JSON formatter."""
    if not getattr(logging.root, "_nlg_json_configured", False):
        handler = logging.StreamHandler()
        handler.setFormatter(JsonFormatter())
        logging.root.addHandler(handler)
        logging.root.setLevel(logging.INFO)
        logging.root._nlg_json_configured = True


# Configure logging
configure_json_logging()
logger = logging.getLogger(__name__)

# Create FastAPI app
app = FastAPI(
    title="nlg-service",
    version="1.0.0",
    description="Natural Language Generation service for medical decision support",
)

# Add request ID middleware
@app.middleware("http")
async def add_request_id(request: Request, call_next):
    """Add X-Request-ID to request for tracing."""
    request_id = request.headers.get("X-Request-ID", str(uuid.uuid4()))
    request.state.request_id = request_id
    
    response = await call_next(request)
    response.headers["X-Request-ID"] = request_id
    return response


# Exception handlers
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Handle Pydantic validation errors."""
    request_id = getattr(request.state, "request_id", "unknown")
    
    logger.warning(
        "validation_error_logged",
        extra={
            "request_id": request_id,
            "error_count": len(exc.errors()),
        }
    )
    
    return JSONResponse(
        status_code=422,
        content={
            "error": {
                "code": "invalid_request",
                "message": "Invalid request payload",
                "category": "validation",
            }
        }
    )


@app.exception_handler(NLGEngineError)
async def nlg_engine_error_handler(request: Request, exc: NLGEngineError):
    """Handle NLG engine errors."""
    request_id = getattr(request.state, "request_id", "unknown")
    
    logger.error(
        "nlg_engine_error_logged",
        extra={
            "request_id": request_id,
            "code": exc.code,
            "message": exc.message,
        }
    )
    
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": {
                "code": exc.code,
                "message": exc.message,
                "category": "nlg",
            }
        }
    )


@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    """Handle unexpected exceptions."""
    request_id = getattr(request.state, "request_id", "unknown")
    
    logger.error(
        "unexpected_error_logged",
        extra={
            "request_id": request_id,
            "error": str(exc),
            "error_type": type(exc).__name__,
        }
    )
    
    return JSONResponse(
        status_code=500,
        content={
            "error": {
                "code": "internal_error",
                "message": "Internal server error",
                "category": "system",
            }
        }
    )


# Include routes
app.include_router(router)

try:
    llm_status = get_llm_status_snapshot()
    prompt_sources = llm_status.get("prompt_sources", {})
    loaded_count = sum(1 for source in prompt_sources.values() if source.get("loaded"))
    fallback_count = sum(1 for source in prompt_sources.values() if source.get("fallback_used"))
    logger.info(
        "nlg_prompts_startup_validation",
        extra={
            "mode": llm_status.get("mode"),
            "groq_enabled": llm_status.get("groq_enabled"),
            "prompt_sources": prompt_sources,
            "prompts_loaded_count": loaded_count,
            "prompts_fallback_count": fallback_count,
        },
    )
except Exception as exc:  # pragma: no cover - startup diagnostics must not block app boot
    logger.warning("nlg_prompts_startup_validation_failed", extra={"error": str(exc)})

logger.info("nlg_service_initialized", extra={"version": "1.0.0"})
