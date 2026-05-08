ARG PYTHON_VERSION=3.11
FROM python:${PYTHON_VERSION}-slim

WORKDIR /app

RUN apt-get update && apt-get install -y gcc postgresql-client && rm -rf /var/lib/apt/lists/*

COPY MetaBrain/services/inference_service/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY MetaBrain/services/inference_service ./MetaBrain/services/inference_service
COPY MetaBrain/services/shared ./MetaBrain/services/shared
COPY MetaBrain/cerebro_ai_med ./MetaBrain/cerebro_ai_med

ENV PYTHONPATH=/app/MetaBrain
ENV PYTHONUNBUFFERED=1

EXPOSE 8011

CMD ["uvicorn", "services.inference_service.main:app", "--host", "0.0.0.0", "--port", "8011", "--workers", "1"]