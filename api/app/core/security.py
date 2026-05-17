"""Seguridad Híbrida: API Keys (servicios) + JWT (humanos) - Fase 3.2."""

from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any
import hmac
import os
from fastapi import HTTPException, Depends, status, Header, Request
from fastapi.security import OAuth2PasswordBearer
import jwt
from passlib.context import CryptContext  # type: ignore[reportMissingImports]
from pydantic import BaseModel

from api.app.core import settings

# ============ CONFIGURACIÓN ============

# JWT
JWT_SECRET_KEY = settings.jwt_secret
JWT_ALGORITHM = settings.jwt_algorithm
JWT_EXPIRATION_HOURS = settings.jwt_expiration_hours
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# API Keys válidas para servicios internos
# En producción, estas deben guardarse de forma segura (vault, BD encriptada)
INTERNAL_API_KEYS: dict[str, str] = {
    "gateway": settings.gateway_api_key,
    "brain": settings.brain_api_key,
}
_shared_internal_services_key = os.getenv("INTERNAL_SERVICES_KEY", "").strip()
if _shared_internal_services_key:
    INTERNAL_API_KEYS["internal-services"] = _shared_internal_services_key
# Panel Super-Admin registrado sólo si el key está configurado
if settings.panel_admin_api_key and settings.panel_admin_api_key not in {
    "change-me-panel-admin-key", ""
}:
    INTERNAL_API_KEYS["panel-admin"] = settings.panel_admin_api_key

# ⚠️ HARDENING (Fase 3.3): API Key Scopes
# Cada servicio tiene permisos limitados por endpoint
API_KEY_SCOPES: dict[str, list[str]] = {
    "gateway": [
        "appointments:create",
        "appointments:validate-slot",
        "patients:read-by-phone",
        "patients:create-shadow",
    ],
    "brain": [
        "appointments:read",
        "patients:read",
        "appointments:analyse",
    ],
    "panel-admin": [
        "admin:read",
        "admin:write",
    ],
}

# ⚠️ IP WHITELISTING (Fase 3.3):
# En producción, restringir API Key a IPs específicas
ALLOWED_IPS_BY_SERVICE: dict[str, list[str]] = {
    "gateway": os.getenv("GATEWAY_ALLOWED_IPS", "").split(",") if os.getenv("GATEWAY_ALLOWED_IPS") else [],
    "brain": os.getenv("BRAIN_ALLOWED_IPS", "").split(",") if os.getenv("BRAIN_ALLOWED_IPS") else [],
    "panel-admin": os.getenv("PANEL_ADMIN_ALLOWED_IPS", "").split(",") if os.getenv("PANEL_ADMIN_ALLOWED_IPS") else [],
}

# OAuth2 scheme para JWT
oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl="/api/v1/auth/token",
    auto_error=False,
    scopes={
        "user:read": "Leer datos del usuario",
        "appointment:create": "Crear citas",
        "appointment:read": "Leer citas",
    }
)

AUTH_COOKIE_NAME = "gs_access_token"
AUTH_CSRF_COOKIE_NAME = "gs_csrf_token"


# ============ MODELOS ============

class Token(BaseModel):
    """Respuesta de token JWT."""
    access_token: str
    token_type: str
    expires_in: int


class TokenData(BaseModel):
    """Datos extraídos del JWT."""
    subject: str  # Usuario ID o "gateway", "brain"
    scopes: list[str] = []
    role: Optional[str] = None
    username: Optional[str] = None
    doctor_id: Optional[str] = None
    client_id: Optional[str] = None
    clinic_id: Optional[str] = None
    type: str = "user"  # "user" o "service"


class InternalAuth(BaseModel):
    """Contexto de autenticación para servicios internos."""
    service: str  # "gateway", "brain", "api"
    scopes: list[str] = []
    is_internal: bool = True


class UserAuth(BaseModel):
    """Contexto de autenticación para usuarios."""
    user_id: str
    username: str
    role: str = "doctor"
    doctor_id: Optional[str] = None
    client_id: Optional[str] = None
    clinic_id: Optional[str] = None
    email: str
    scopes: list[str]
    is_internal: bool = False


# ============ FUNCIONES DE UTILIDAD ============

def create_jwt_token(
    subject: str,
    scopes: Optional[list[str]] = None,
    expires_delta: Optional[timedelta] = None
) -> Dict[str, Any]:
    """
    Crea un token JWT.
    
    Args:
        subject: Identificador único (user_id, email, etc.)
        scopes: Lista de permisos
        expires_delta: Tiempo de expiración personalizado
    
    Returns:
        Dict con access_token, token_type, expires_in
    """
    if scopes is None:
        scopes = []
    
    encoded_jwt = create_access_token(
        {
            "sub": subject,
            "scopes": scopes,
            "username": subject,
            "type": "user",
        },
        expires_delta=expires_delta,
    )

    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRATION_HOURS)
    
    return {
        "access_token": encoded_jwt,
        "token_type": "bearer",
        "expires_in": int((expire - datetime.now(timezone.utc)).total_seconds())
    }


def get_password_hash(password: str) -> str:
    """Genera hash bcrypt para almacenar credenciales."""
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifica password plano contra hash bcrypt."""
    return pwd_context.verify(plain_password, hashed_password)


def create_access_token(
    data: Dict[str, Any],
    expires_delta: Optional[timedelta] = None,
) -> str:
    """Crea access token JWT para OAuth2 password flow."""
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(hours=JWT_EXPIRATION_HOURS)
    )
    to_encode.update(
        {
            "exp": expire,
            "iat": datetime.now(timezone.utc),
            "type": "user",
            "iss": settings.jwt_issuer,
            "aud": settings.jwt_audience,
        }
    )
    return jwt.encode(to_encode, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)


def verify_jwt_token(token: str) -> TokenData:
    """
    Verifica y decodifica un token JWT.
    
    Raises:
        HTTPException 401: Si el token es inválido o expirado
    """
    try:
        payload = jwt.decode(
            token,
            JWT_SECRET_KEY,
            algorithms=[JWT_ALGORITHM],
            issuer=settings.jwt_issuer,
            audience=settings.jwt_audience,
            options={"require": ["exp", "iat", "sub"]},
        )
        subject: Optional[str] = payload.get("sub")
        scopes: list[str] = payload.get("scopes", [])
        role: Optional[str] = payload.get("role")
        username: Optional[str] = payload.get("username")
        doctor_id: Optional[str] = payload.get("doctor_id")
        client_id: Optional[str] = payload.get("client_id")
        clinic_id: Optional[str] = payload.get("clinic_id")
        
        if subject is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token JWT inválido",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        return TokenData(
            subject=subject,
            scopes=scopes,
            role=role,
            username=username,
            doctor_id=doctor_id,
            client_id=client_id,
            clinic_id=clinic_id,
            type=payload.get("type", "user"),
        )
    
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token JWT expirado",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token JWT inválido",
            headers={"WWW-Authenticate": "Bearer"},
        )


# ============ DEPENDENCIAS ============

async def validate_api_key(
    request: Request,
    x_internal_key: Optional[str] = Header(None)
) -> InternalAuth:
    """
    Valida API Key para comunicación entre servicios internos.
    
    Header esperado: X-Internal-Key
    
    Raises:
        HTTPException 403: Si la clave es inválida o no está presente
    """
    if not x_internal_key:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="X-Internal-Key header requerido para servicios internos"
        )
    
    # Constant-time comparison prevents timing side-channel attacks on key recovery.
    service_name = None
    for service, key in INTERNAL_API_KEYS.items():
        if hmac.compare_digest(x_internal_key, key):
            service_name = service
            break
    
    if not service_name:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="X-Internal-Key inválida"
        )

    # Use the direct connection IP for internal service whitelisting.
    # X-Forwarded-For is attacker-controlled and MUST NOT be trusted for access control decisions.
    client_ip = request.client.host if request.client and request.client.host else "0.0.0.0"

    allowed_ips = [
        ip.strip()
        for ip in ALLOWED_IPS_BY_SERVICE.get(service_name, [])
        if ip and ip.strip()
    ]
    if allowed_ips and client_ip not in allowed_ips:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="IP no permitida para servicio interno",
        )
    
    return InternalAuth(
        service=service_name,
        scopes=API_KEY_SCOPES.get(service_name, []),
        is_internal=True,
    )


def ensure_required_scope(required_scope: Optional[str], auth_data: Dict[str, Any]) -> None:
    """Rechaza credenciales internas o JWT sin el scope requerido."""
    if not required_scope:
        return

    scopes = auth_data.get("scopes") or []
    if required_scope not in scopes:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Scope requerido: {required_scope}",
        )


async def get_current_user(
    request: Request,
    token: Optional[str] = Depends(oauth2_scheme),
) -> UserAuth:
    """
    Valida JWT y obtiene el usuario actual.
    
    Usado para endpoints de mdicos/dashboard.
    
    Raises:
        HTTPException 401: Si el token es inválido
    """
    auth_token = token or request.cookies.get(AUTH_COOKIE_NAME)
    if not auth_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="missing_bearer_token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token_data = verify_jwt_token(auth_token)
    
    return UserAuth(
        user_id=token_data.subject,
        username=token_data.username or token_data.subject,
        role=token_data.role or "doctor",
        doctor_id=token_data.doctor_id,
        client_id=token_data.client_id,
        clinic_id=token_data.clinic_id,
        email=token_data.subject,
        scopes=token_data.scopes,
        is_internal=False
    )


async def get_current_user_optional(
    request: Request,
    token: Optional[str] = Depends(oauth2_scheme),
) -> Optional[UserAuth]:
    """Obtiene usuario actual pero permite sin autenticación."""
    try:
        return await get_current_user(request=request, token=token)
    except HTTPException:
        return None


async def validate_hybrid_auth(
    request: Request,
    x_internal_key: Optional[str] = Header(None),
    authorization: Optional[str] = Header(None),
    required_scope: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Validación híbrida: Permite API Key (servicios) O JWT (usuarios).
    
    Usado en endpoints creados tanto por Gateway como por Dashboard.
    
    Returns:
        Dict con auth_type ("service" o "user") y datos
    
    Raises:
        HTTPException 403: Si ninguna autenticación es válida
    """
    # Intenta API Key primero
    if x_internal_key:
        service_auth = await validate_api_key(request=request, x_internal_key=x_internal_key)
        auth_data = {
            "auth_type": "service",
            "service": service_auth.service,
            "scopes": service_auth.scopes,
            "is_internal": True,
        }
        ensure_required_scope(required_scope, auth_data)
        return auth_data

    # Intenta JWT por Authorization header o cookie de sesión
    jwt_token: Optional[str] = None
    if authorization is not None and not isinstance(authorization, str):
        authorization = None
    if authorization:
        parts = authorization.split()
        if len(parts) == 2 and parts[0].lower() == "bearer":
            jwt_token = parts[1]
    if jwt_token is None:
        jwt_token = request.cookies.get(AUTH_COOKIE_NAME)

    if jwt_token:
        try:
            token_data = verify_jwt_token(jwt_token)
            auth_data = {
                "auth_type": "user",
                "user_id": token_data.subject,
                "username": token_data.username,
                "role": token_data.role,
                "doctor_id": token_data.doctor_id,
                "client_id": token_data.client_id,
                "clinic_id": token_data.clinic_id,
                "scopes": token_data.scopes,
                "is_internal": False
            }
            ensure_required_scope(required_scope, auth_data)
            return auth_data
        except HTTPException:
            pass  # Si falla, continúa a error final
    
    # Si llegamos aquí, ninguna autenticación fue válida
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Se requiere autenticación: X-Internal-Key (services) o Authorization: Bearer <JWT> (users)"
    )


# ============ HELPERS ============

def check_permissions(
    required_scope: str,
    auth_data: Dict[str, Any]
) -> bool:
    """
    Verifica si la autenticación tiene el permiso requerido.
    
    Servicios internos y usuarios se validan contra scopes declarados.
    """
    scopes = auth_data.get("scopes", [])
    return required_scope in scopes
