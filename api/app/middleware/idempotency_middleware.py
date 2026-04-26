from __future__ import annotations

from datetime import datetime
from typing import Any, Callable, cast

from fastapi import status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

from api.app.db.session import async_session_local
from api.app.models import IdempotencyRecord
from shared.utils import setup_logger


logger = setup_logger(__name__)


class IdempotencyMiddleware(BaseHTTPMiddleware):
    """Middleware para persistir y reutilizar respuestas por Idempotency-Key."""

    IDEMPOTENCY_HEADER = "Idempotency-Key"
    TARGET_METHODS = {"POST"}
    TARGET_PATHS = {"/api/v1/appointments"}

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        normalized_path = request.url.path.rstrip("/") or "/"
        request_method = request.method.upper()
        idempotency_key = request.headers.get(self.IDEMPOTENCY_HEADER)

        if (
            request_method not in self.TARGET_METHODS
            or normalized_path not in self.TARGET_PATHS
        ):
            return await call_next(request)

        if not idempotency_key:
            return JSONResponse(
                status_code=status.HTTP_400_BAD_REQUEST,
                content={"detail": "Header Idempotency-Key es obligatorio"},
            )

        body_bytes = await request.body()

        async def receive() -> dict[str, object]:
            return {"type": "http.request", "body": body_bytes, "more_body": False}

        replayable_request = Request(request.scope, receive)

        async with async_session_local() as session:
            existing_stmt = select(IdempotencyRecord).where(
                IdempotencyRecord.idempotency_key == idempotency_key,
                IdempotencyRecord.http_method == request_method,
                IdempotencyRecord.request_path == normalized_path,
            )
            existing = (await session.execute(existing_stmt)).scalars().first()
            existing_record = cast(Any, existing)

            if existing_record and bool(existing_record.is_completed) and existing_record.status_code is not None:
                logger.info(
                    "Idempotency replay",
                    extra={
                        "event": "idempotency_replay",
                        "idempotency_key": idempotency_key,
                        "method": request_method,
                        "path": normalized_path,
                        "status_code": cast(int, existing_record.status_code),
                    },
                )
                replay_content_type = cast(str, existing_record.content_type) or "application/json"
                replay_media_type = replay_content_type.split(";")[0].strip()
                replay_headers = {
                    "X-Idempotency-Replayed": "true",
                    self.IDEMPOTENCY_HEADER: idempotency_key,
                }
                return Response(
                    content=cast(str, existing_record.response_body) or "",
                    status_code=cast(int, existing_record.status_code),
                    media_type=replay_media_type,
                    headers=replay_headers,
                )

            if existing_record and not bool(existing_record.is_completed):
                return JSONResponse(
                    status_code=status.HTTP_409_CONFLICT,
                    content={"detail": "Request con la misma Idempotency-Key en progreso"},
                )

            if not existing:
                new_record = IdempotencyRecord(
                    idempotency_key=idempotency_key,
                    http_method=request_method,
                    request_path=normalized_path,
                    is_completed=False,
                )
                session.add(new_record)
                try:
                    await session.commit()
                except IntegrityError:
                    await session.rollback()
                    existing = (await session.execute(existing_stmt)).scalars().first()
                    existing_record = cast(Any, existing)
                    if existing_record and bool(existing_record.is_completed) and existing_record.status_code is not None:
                        replay_content_type = cast(str, existing_record.content_type) or "application/json"
                        replay_media_type = replay_content_type.split(";")[0].strip()
                        replay_headers = {
                            "X-Idempotency-Replayed": "true",
                            self.IDEMPOTENCY_HEADER: idempotency_key,
                        }
                        return Response(
                            content=cast(str, existing_record.response_body) or "",
                            status_code=cast(int, existing_record.status_code),
                            media_type=replay_media_type,
                            headers=replay_headers,
                        )
                    return JSONResponse(
                        status_code=status.HTTP_409_CONFLICT,
                        content={"detail": "Request con la misma Idempotency-Key en progreso"},
                    )

        response = await call_next(replayable_request)
        response_body = b""
        async for chunk in response.body_iterator:
            response_body += chunk

        content_type = response.headers.get("content-type", "application/json")
        response_text = response_body.decode("utf-8", errors="replace")

        async with async_session_local() as session:
            update_stmt = select(IdempotencyRecord).where(
                IdempotencyRecord.idempotency_key == idempotency_key,
                IdempotencyRecord.http_method == request_method,
                IdempotencyRecord.request_path == normalized_path,
            )
            record = (await session.execute(update_stmt)).scalars().first()
            if record:
                record_any = cast(Any, record)
                record_any.status_code = response.status_code
                record_any.content_type = content_type
                record_any.response_body = response_text
                record_any.is_completed = True
                record_any.updated_at = datetime.utcnow()
                await session.commit()

        response_headers = dict(response.headers)
        response_headers[self.IDEMPOTENCY_HEADER] = idempotency_key
        return Response(
            content=response_body,
            status_code=response.status_code,
            media_type=content_type.split(";")[0].strip(),
            headers=response_headers,
        )
