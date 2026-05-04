# API Dockerfile
FROM python:3.11-slim

WORKDIR /app

# Instalar dependencias del sistema
RUN apt-get update && apt-get install -y \
    gcc \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# Copiar requirements
COPY requirements.txt .

# Instalar dependencias Python
RUN pip install --no-cache-dir -r requirements.txt

# Copiar código
COPY api ./api
COPY brain ./brain
COPY MetaBrain ./MetaBrain
COPY shared ./shared
COPY alembic.ini .
COPY alembic ./alembic

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD python -c "import httpx; httpx.get('http://localhost:8000/api/health/readiness')" || exit 1

# Comando por defecto
CMD ["uvicorn", "api.app.main:app", "--host", "0.0.0.0", "--port", "8000"]
