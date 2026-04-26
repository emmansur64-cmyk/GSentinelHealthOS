"""Endpoints para el sistema de aprendizaje del bot (Knowledge Management)."""

from uuid import UUID
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from api.app.schemas.bot_lesson_schema import (
    BotLessonCreate,
    BotLessonResponse,
    BotLessonUpdate,
)
from api.app.models import BotLesson
from api.app.dependencies.db import get_db
from api.app.core.security import get_current_user, UserAuth
from api.app.dependencies.auth import RoleChecker

# Router con prefijo /admin/learn
router = APIRouter(
    prefix="/admin/learn",
    tags=["bot-knowledge"],
    dependencies=[Depends(RoleChecker(["doctor", "admin"]))],
)


# ============ POST: Crear lección ============

@router.post(
    "",
    response_model=BotLessonResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Crear nueva lección de bot",
    description="El doctor enseña al bot patrones de comportamiento correcto"
)
async def create_lesson(
    payload: BotLessonCreate,
    db: AsyncSession = Depends(get_db),
    user: UserAuth = Depends(get_current_user),
) -> BotLessonResponse:
    """
    Crea una nueva lección para que el bot aprenda.
    
    **Validaciones:**
    - Patrón normalizado (lowercase, stripped)
    - No duplicados (mismo doctor + patrón)
    - Longitud máxima 200 caract (patrón) y 500 (acción)
    
    **Auditoría:**
    - Se registra doctor_id automáticamente
    - Se marca created_at con timestamp del servidor
    """
    
    # Obtener doctor_id desde el usuario
    if not user.doctor_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Usuario no tiene doctor_id asociado"
        )
    
    doctor_id = UUID(user.doctor_id)
    
    # Validar duplicados
    existing = await db.execute(
        select(BotLesson).where(
            and_(
                BotLesson.doctor_id == doctor_id,
                BotLesson.pattern == payload.pattern,
            )
        )
    )
    
    if existing.scalar():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Ya existe una lección con este patrón para tu usuario"
        )
    
    # Crear la lección
    lesson = BotLesson(
        pattern=payload.pattern,
        correct_action=payload.correct_action,
        category=payload.category,
        doctor_id=doctor_id,
    )
    
    db.add(lesson)
    await db.flush()  # Obtener el ID generado
    await db.commit()
    
    return BotLessonResponse.model_validate(lesson)


# ============ GET: Listar lecciones del doctor ============

@router.get(
    "",
    response_model=List[BotLessonResponse],
    summary="Listar tus lecciones",
    description="Obtiene todas las lecciones que has creado"
)
async def list_lessons(
    category: Optional[str] = Query(None, description="Filtrar por categoría"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    user: UserAuth = Depends(get_current_user),
) -> List[BotLessonResponse]:
    """
    Lista las lecciones del doctor actual.
    
    **Parámetros:**
    - category: Filtrar por "intent", "entity", "tone", "flow"
    - skip/limit: Paginación
    """
    
    if not user.doctor_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Usuario no tiene doctor_id asociado"
        )
    
    doctor_id = UUID(user.doctor_id)
    
    # Construir query base
    query = select(BotLesson).where(BotLesson.doctor_id == doctor_id)
    
    # Aplicar filtros opcionales
    if category:
        query = query.where(BotLesson.category == category.lower())
    
    # Aplicar paginación
    query = query.offset(skip).limit(limit).order_by(BotLesson.created_at.desc())
    
    result = await db.execute(query)
    lessons = result.scalars().all()
    
    return [BotLessonResponse.model_validate(lesson) for lesson in lessons]


# ============ GET: Obtener lección por ID ============

@router.get(
    "/{lesson_id}",
    response_model=BotLessonResponse,
    summary="Obtener lección por ID",
)
async def get_lesson(
    lesson_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: UserAuth = Depends(get_current_user),
) -> BotLessonResponse:
    """Obtiene una lección específica (solo si pertenece al doctor actual)."""
    
    if not user.doctor_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Usuario no tiene doctor_id asociado"
        )
    
    doctor_id = UUID(user.doctor_id)
    
    result = await db.execute(
        select(BotLesson).where(
            and_(
                BotLesson.id == lesson_id,
                BotLesson.doctor_id == doctor_id,
            )
        )
    )
    
    lesson = result.scalar()
    if not lesson:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lección no encontrada o no tienes acceso"
        )
    
    return BotLessonResponse.model_validate(lesson)


# ============ PUT: Actualizar lección ============

@router.put(
    "/{lesson_id}",
    response_model=BotLessonResponse,
    summary="Actualizar lección",
)
async def update_lesson(
    lesson_id: UUID,
    payload: BotLessonUpdate,
    db: AsyncSession = Depends(get_db),
    user: UserAuth = Depends(get_current_user),
) -> BotLessonResponse:
    """
    Actualiza una lección existente.
    
    **Campos actualizables:**
    - correct_action
    - category
    
    **El patrón NO es modificable** (es la clave de aprendizaje)
    """
    
    if not user.doctor_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Usuario no tiene doctor_id asociado"
        )
    
    doctor_id = UUID(user.doctor_id)
    
    result = await db.execute(
        select(BotLesson).where(
            and_(
                BotLesson.id == lesson_id,
                BotLesson.doctor_id == doctor_id,
            )
        )
    )
    
    lesson = result.scalar()
    if not lesson:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lección no encontrada o no tienes acceso"
        )
    
    # Actualizar solo campos no-None
    if payload.correct_action is not None:
        lesson.correct_action = payload.correct_action
    
    if payload.category is not None:
        lesson.category = payload.category
    
    await db.commit()
    await db.refresh(lesson)
    
    return BotLessonResponse.model_validate(lesson)


# ============ DELETE: Eliminar lección ============

@router.delete(
    "/{lesson_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
    summary="Eliminar lección",
)
async def delete_lesson(
    lesson_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: UserAuth = Depends(get_current_user),
) -> Response:
    """Elimina una lección (solo si pertenece al doctor actual)."""
    
    if not user.doctor_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Usuario no tiene doctor_id asociado"
        )
    
    doctor_id = UUID(user.doctor_id)
    
    result = await db.execute(
        select(BotLesson).where(
            and_(
                BotLesson.id == lesson_id,
                BotLesson.doctor_id == doctor_id,
            )
        )
    )
    
    lesson = result.scalar()
    if not lesson:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lección no encontrada o no tienes acceso"
        )
    
    await db.delete(lesson)
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ============ GET: Estadísticas de aprendizaje ============

@router.get(
    "/stats/summary",
    summary="Estadísticas de aprendizaje",
)
async def get_stats(
    db: AsyncSession = Depends(get_db),
    user: UserAuth = Depends(get_current_user),
):
    """Retorna estadísticas de cuántas lecciones has creado por categoría."""
    
    if not user.doctor_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Usuario no tiene doctor_id asociado"
        )
    
    doctor_id = UUID(user.doctor_id)
    
    # Total de lecciones
    total_result = await db.execute(
        select(BotLesson).where(BotLesson.doctor_id == doctor_id)
    )
    total = len(total_result.scalars().all())
    
    # Por categoría
    from sqlalchemy import func
    stats_result = await db.execute(
        select(
            BotLesson.category,
            func.count(BotLesson.id).label("count")
        ).where(BotLesson.doctor_id == doctor_id).group_by(BotLesson.category)
    )
    
    categories = {row[0]: row[1] for row in stats_result.all()}
    
    return {
        "total_lessons": total,
        "by_category": categories,
        "doctor_id": str(doctor_id),
    }
