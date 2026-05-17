# Brain Dockerfile
FROM python:3.11.11-slim-bookworm
WORKDIR /app
RUN apt-get update && apt-get install -y gcc postgresql-client && rm -rf /var/lib/apt/lists/*
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY brain ./brain
COPY MB-Chat ./MB-Chat
COPY shared ./shared
ENV PYTHONPATH=/app
ENV PYTHONUNBUFFERED=1
RUN touch brain/__init__.py

RUN groupadd -r appuser && useradd -r -g appuser -d /app appuser
RUN mkdir -p /app/artifacts/semantic_index && chown -R appuser:appuser /app/artifacts
USER appuser

CMD ["python", "brain/main.py"]
