"""
Utilidades compartidas - Logging, validación y helpers comunes
"""

import logging
import sys
import json
from typing import Any, Dict, Optional
from datetime import datetime

# ============ CONFIGURACIÓN DE LOGGING ============

def setup_logger(
    name: str,
    level: int = logging.INFO,
    log_file: Optional[str] = None
) -> logging.Logger:
    """
    Configura un logger con formato consistente
    
    Args:
        name: Nombre del logger (generalmente __name__)
        level: Nivel de logging (DEBUG, INFO, WARNING, ERROR, CRITICAL)
        log_file: Archivo opcional para guardar logs
        
    Returns:
        Logger configurado
    """
    logger = logging.getLogger(name)
    if logger.handlers:
        return logger
    logger.setLevel(level)

    # Formato consistente
    formatter = logging.Formatter(
        fmt='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )

    # Handler para consola
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setFormatter(formatter)
    logger.addHandler(console_handler)

    # Handler para archivo (opcional)
    if log_file:
        file_handler = logging.FileHandler(log_file)
        file_handler.setFormatter(formatter)
        logger.addHandler(file_handler)

    return logger


def log_structured(
    logger: logging.Logger,
    level: int,
    event: str,
    **fields: Any,
) -> None:
    """Emit JSON structured logs compatible with existing backend logger."""
    payload: Dict[str, Any] = {
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "event": event,
        "logger": logger.name,
        **fields,
    }
    logger.log(level, json.dumps(payload, default=str, ensure_ascii=True))


# ============ VALIDADORES ============

def validate_email(email: str) -> bool:
    """Valida formato de email básico"""
    import re
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return re.match(pattern, email) is not None


def validate_phone(phone: str) -> bool:
    """Valida formato de teléfono (al menos 8 dígitos)"""
    import re
    pattern = r'^\+?[\d\s\-\(\)]{8,}$'
    return re.match(pattern, phone) is not None


def validate_license_number(license_number: str) -> bool:
    """Valida formato de número de matrícula médica"""
    return len(license_number.strip()) >= 4


# ============ HELPERS DE RESPUESTA ============

class AppResponse(dict):
    """Estructura uniforme para respuestas de API"""
    
    def __init__(
        self,
        success: bool,
        data: Any = None,
        message: str = "",
        error: Optional[str] = None,
        timestamp: Optional[datetime] = None
    ):
        super().__init__()
        self.update({
            "success": success,
            "data": data,
            "message": message,
            "error": error,
            "timestamp": timestamp or datetime.utcnow().isoformat()
        })
    
    @classmethod
    def success(cls, data: Any, message: str = "Operación exitosa"):
        """Crea respuesta de éxito"""
        return cls(success=True, data=data, message=message)
    
    @classmethod
    def error(cls, error: str, message: str = "Error en operación"):
        """Crea respuesta de error"""
        return cls(success=False, error=error, message=message)


# ============ PAGINATION ============

class PaginationParams:
    """Helper para paginación consistente"""
    
    def __init__(self, skip: int = 0, limit: int = 10, max_limit: int = 100):
        self.skip = max(0, skip)
        self.limit = min(limit, max_limit)
    
    def get_slice(self):
        """Retorna tupla (skip, limit) para query"""
        return self.skip, self.limit


# ============ CONVERSIÓN DE DATOS ============

def model_to_dict(model: Any, exclude: Optional[list[str]] = None) -> Dict[str, Any]:
    """Convierte modelo SQLAlchemy a diccionario"""
    if exclude is None:
        exclude = []
    
    return {
        column.name: getattr(model, column.name)
        for column in model.__table__.columns
        if column.name not in exclude
    }


# ============ DECORADORES ============

def log_execution(logger: logging.Logger):
    """Decorador para loguear ejecución de funciones"""
    def decorator(func):
        def wrapper(*args, **kwargs):
            logger.info(f"Ejecutando: {func.__name__}")
            try:
                result = func(*args, **kwargs)
                logger.info(f"✓ {func.__name__} completado exitosamente")
                return result
            except Exception as e:
                logger.error(f"✗ Error en {func.__name__}: {str(e)}")
                raise
        return wrapper
    return decorator
