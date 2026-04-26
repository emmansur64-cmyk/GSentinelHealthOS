"""Base schema for all Pydantic models.

Configuración base que permite a Pydantic leer modelos de SQLAlchemy directamente.
"""

from pydantic import BaseModel, ConfigDict


class BaseSchema(BaseModel):
    """Schema base con soporte para SQLAlchemy ORM models (from_attributes=True)."""

    model_config = ConfigDict(
        from_attributes=True,  # Pydantic v2: permite construir desde objetos SQLAlchemy
        populate_by_name=True,  # Permite usar alias en deserialización
    )
