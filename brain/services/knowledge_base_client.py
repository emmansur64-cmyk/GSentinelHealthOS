"""
Extensión del API client para obtener lecciones del Bot Knowledge Base.

Se integra con brain/integration/api_client.py
"""

from typing import Optional, Any, List
import asyncio
import httpx

from shared.utils import setup_logger

logger = setup_logger(__name__)


class KnowledgeBaseClient:
    """Cliente HTTP para acceder a Bot Knowledge Base desde el Brain."""
    
    def __init__(self, api_base_url: str, timeout: int = 5):
        """
        Args:
            api_base_url: Base URL del API (ej: http://localhost:8000)
            timeout: Timeout en segundos para requests
        """
        self.api_base_url = api_base_url.rstrip("/")
        self.timeout = timeout
        self._session: Optional[httpx.AsyncClient] = None
        self._auth_token: Optional[str] = None
    
    async def _get_session(self) -> httpx.AsyncClient:
        """Obtiene o crea sesión HTTP asíncrona."""
        if self._session is None:
            self._session = httpx.AsyncClient(timeout=self.timeout)
        return self._session
    
    def set_auth_token(self, token: str) -> None:
        """Establece token JWT para autenticación."""
        self._auth_token = token
    
    async def get_bot_lessons(
        self,
        doctor_id: str,
        category: Optional[str] = None,
        limit: int = 50,
    ) -> List[dict[str, Any]]:
        """
        Obtiene lecciones del doctor del bot knowledge base.
        
        Args:
            doctor_id: ID del doctor (UUID)
            category: Filtrar por categoría (opcional)
            limit: Cantidad máxima de lecciones
        
        Returns:
            Lista de lecciones con {id, pattern, correct_action, category, created_at}
        
        Raises:
            Exception: Si hay error en la API
        """
        if not self._auth_token:
            logger.warning("[KnowledgeBase] Sin token JWT, no se pueden obtener lecciones")
            return []
        
        try:
            session = await self._get_session()
            
            # Construir URL
            url = f"{self.api_base_url}/api/v1/admin/learn"
            params: dict[str, int | str] = {"skip": 0, "limit": limit}
            if category:
                params["category"] = category
            
            headers = {
                "Authorization": f"Bearer {self._auth_token}",
                "Accept": "application/json",
            }
            
            response = await session.get(url, params=params, headers=headers)

            if response.status_code == 401:
                logger.warning("[KnowledgeBase] Token JWT inválido o expirado")
                return []

            if response.status_code == 403:
                logger.warning("[KnowledgeBase] Acceso denegado (sin rol doctor/admin)")
                return []

            if response.status_code >= 400:
                logger.warning(f"[KnowledgeBase] API error: {response.status_code}")
                return []

            lessons = response.json()
            logger.debug(f"[KnowledgeBase] ✓ Obtenidas {len(lessons)} lecciones para doctor {doctor_id}")
            return lessons if isinstance(lessons, list) else []
            
        except asyncio.TimeoutError:
            logger.warning(f"[KnowledgeBase] Timeout obteniendo lecciones ({self.timeout}s)")
        except Exception as e:
            logger.warning(f"[KnowledgeBase] Error: {type(e).__name__}: {e}")
        
        return []
    
    async def get_lesson_stats(self, doctor_id: str) -> dict[str, Any]:
        """
        Obtiene estadísticas de aprendizaje del doctor.
        
        Returns:
            {total_lessons: int, by_category: {intent: int, ...}}
        """
        if not self._auth_token:
            return {}
        
        try:
            session = await self._get_session()
            url = f"{self.api_base_url}/api/v1/admin/learn/stats/summary"
            headers = {"Authorization": f"Bearer {self._auth_token}"}
            
            response = await session.get(url, headers=headers)
            if response.status_code == 200:
                payload = response.json()
                return payload if isinstance(payload, dict) else {}
            
        except Exception as e:
            logger.warning(f"[KnowledgeBase] Error obteniendo stats: {e}")
        
        return {}
    
    async def close(self) -> None:
        """Cierra la sesión HTTP."""
        if self._session:
            await self._session.aclose()
            self._session = None
    
    async def __aenter__(self):
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.close()


# ============ EXTENSIÓN AL API CLIENT EXISTENTE ============

def extend_api_client_with_knowledge(api_client_instance: Any) -> None:
    """
    Extiende una instancia de APIClient con métodos de Knowledge Base.
    
    Uso:
        from brain.integration.api_client import APIClient
        client = APIClient(...)
        extend_api_client_with_knowledge(client)
        
        # Ahora disponible:
        lessons = await client.get_bot_lessons(doctor_id)
    """
    kb_client = KnowledgeBaseClient(api_client_instance.api_base_url)
    
    # Copiar métodos
    api_client_instance.get_bot_lessons = kb_client.get_bot_lessons
    api_client_instance.get_lesson_stats = kb_client.get_lesson_stats
    api_client_instance.set_knowledge_token = kb_client.set_auth_token
    
    logger.info("[KnowledgeBase] APIClient extendido con métodos de Knowledge Base")
