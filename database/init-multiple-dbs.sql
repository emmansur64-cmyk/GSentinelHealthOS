-- Crear base de datos gsentinel_saas para Prisma (Next.js)
-- Este script se ejecuta automáticamente en /docker-entrypoint-initdb.d/
-- solo si el volumen postgres_data está vacío

CREATE DATABASE gsentinel_saas
  WITH OWNER = sentinel
  ENCODING = 'UTF8';

GRANT ALL PRIVILEGES ON DATABASE gsentinel_saas TO sentinel;
