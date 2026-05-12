ARG PYTHON_VERSION=3.11.11-slim-bookworm
FROM python:${PYTHON_VERSION}

WORKDIR /app

RUN apt-get update && apt-get install -y gcc postgresql-client && rm -rf /var/lib/apt/lists/*

COPY MetaBrain/services/decision_service/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY MetaBrain/services/decision_service ./MetaBrain/services/decision_service
COPY MetaBrain/services/shared ./MetaBrain/services/shared

ENV PYTHONPATH=/app/MetaBrain
ENV PYTHONUNBUFFERED=1

RUN groupadd -r appuser && useradd -r -g appuser -d /app appuser
USER appuser

EXPOSE 8012

CMD ["uvicorn", "services.decision_service.main:app", "--host", "0.0.0.0", "--port", "8012", "--workers", "1"]