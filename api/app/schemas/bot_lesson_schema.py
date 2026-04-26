"""Schemas para el sistema de aprendizaje del bot (Knowledge Base)."""

from typing import Optional
from uuid import UUID
from datetime import datetime
from pydantic import Field, field_validator
from api.app.schemas.base_schema import BaseSchema


class BotLessonCreate(BaseSchema):
    """Schema para crear una nueva lección del bot."""
    
    pattern: str = Field(
        ..., 
        min_length=3, 
        max_length=200,
        description="Patrón que el usuario dijo mal (será normalizado/lowercased)"
    )
    correct_action: str = Field(
        ..., 
        min_length=1, 
        max_length=500,
        description="La acción correcta que debe aprender el bot"
    )
    category: str = Field(
        ..., 
        description="Categorización: 'intent', 'entity', 'tone', 'flow', etc."
    )
    
    @field_validator("pattern")
    @classmethod
    def sanitize_pattern(cls, v: str) -> str:
        """Normaliza y sanitiza el patrón."""
        return v.lower().strip()
    
    @field_validator("category")
    @classmethod
    def validate_category(cls, v: str) -> str:
        """Valida que la categoría sea conocida."""
        valid_categories = {"intent", "entity", "tone", "flow"}
        if v.lower() not in valid_categories:
            raise ValueError(f"category debe ser uno de {valid_categories}")
        return v.lower()


class BotLessonResponse(BaseSchema):
    """Schema para responder con una lección del bot."""
    
    id: UUID
    pattern: str
    correct_action: str
    category: str
    doctor_id: UUID
    created_at: datetime
    updated_at: Optional[datetime] = None


class BotLessonUpdate(BaseSchema):
    """Schema para actualizar una lección (opcional)."""
    
    correct_action: Optional[str] = Field(None, max_length=500)
    category: Optional[str] = None
    
    @field_validator("category")
    @classmethod
    def validate_category(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        valid_categories = {"intent", "entity", "tone", "flow"}
        if v.lower() not in valid_categories:
            raise ValueError(f"category debe ser uno de {valid_categories}")
        return v.lower()
