#!/bin/bash
# Script para iniciar todos los servicios localmente

set -e

echo "🚀 Iniciando GSentinelHealthOS..."

# Verificar variables de entorno
if [ ! -f .env ]; then
    echo "❌ Archivo .env no encontrado"
    echo "Copia .env.example a .env y configura las variables"
    exit 1
fi

# Cargar variables de entorno
source .env

# Instalar dependencias si es necesario
if [ ! -d "venv" ]; then
    echo "📦 Creando virtual environment..."
    python -m venv venv
    source venv/bin/activate
    pip install -r requirements.txt
else
    source venv/bin/activate
fi

# Crear base de datos si no existe
echo "🗄️  Inicializando base de datos..."
python scripts/seed_db.py

# Iniciar servicios en paralelo
echo ""
echo "🎯 Iniciando servicios..."
echo ""

# API
echo "▶️  Iniciando API en puerto 8000..."
cd api && uvicorn app.main:app --reload --port 8000 &
API_PID=$!
cd ..

# Brain
echo "▶️  Iniciando Brain en puerto 8001..."
python brain/main.py &
BRAIN_PID=$!

# Gateway
echo "▶️  Iniciando Gateway en puerto 8002..."
cd whatsapp_gateway && uvicorn app.main:app --reload --port 8002 &
GATEWAY_PID=$!
cd ..

echo ""
echo "✅ Todos los servicios iniciados:"
echo "   - API: http://localhost:8000"
echo "   - Brain Worker: http://localhost:8001"
echo "   - WhatsApp Gateway: http://localhost:8002"
echo ""
echo "📚 Documentación interactiva:"
echo "   - Swagger: http://localhost:8000/docs"
echo "   - ReDoc: http://localhost:8000/redoc"
echo ""
echo "Presiona Ctrl+C para detener todos los servicios..."
echo ""

# Mantener los procesos vivos
trap "kill $API_PID $BRAIN_PID $GATEWAY_PID 2>/dev/null; echo ''; echo '👋 Servicios detenidos'; exit" SIGINT

wait $API_PID $BRAIN_PID $GATEWAY_PID
