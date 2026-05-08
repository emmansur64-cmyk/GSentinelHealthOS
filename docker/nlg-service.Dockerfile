ARG PYTHON_VERSION=3.11
FROM python:${PYTHON_VERSION}-slim

WORKDIR /app

RUN apt-get update && apt-get install -y gcc postgresql-client && rm -rf /var/lib/apt/lists/*

COPY MetaBrain/services/nlg_service/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY MetaBrain/services/nlg_service ./MetaBrain/services/nlg_service
COPY MetaBrain/services/shared ./MetaBrain/services/shared

ENV PYTHONPATH=/app/MetaBrain
ENV PYTHONUNBUFFERED=1

EXPOSE 8013

CMD ["uvicorn", "services.nlg_service.main:app", "--host", "0.0.0.0", "--port", "8013", "--workers", "1"]