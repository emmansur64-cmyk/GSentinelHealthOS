"""Hardening de Seguridad Fase 3.3: Scopes + IP Whitelisting."""

from typing import Optional, List
from fastapi import HTTPException, status, Header
from api.app.core.security import (
    INTERNAL_API_KEYS,
    API_KEY_SCOPES,
    ALLOWED_IPS_BY_SERVICE,
)


def get_client_ip(x_forwarded_for: Optional[str] = None) -> str:
    """
    Extrae la IP del cliente desde headers.
    
    En entorno Docker/K8s, los load balancers setean X-Forwarded-For
    con la IP original del cliente.
    """
    if x_forwarded_for:
        # X-Forwarded-For puede tener múltiples IPs (proxy chain)
        return x_forwarded_for.split(",")[0].strip()
    
    return "0.0.0.0"  # Fallback


async def validate_api_key_with_scope(
    x_internal_key: str,
    required_scope: str,
    x_forwarded_for: Optional[str] = Header(None),
) -> dict:
    """
    Valida API Key con verificación de:
    1. Clave válida (existe en INTERNAL_API_KEYS)
    2. Scope requerido (tiene permiso para esta acción)
    3. IP del cliente (si está configurado whitelist)
    
    ⚠️ HARDENING (Fase 3.3):
    - API_KEY_SCOPES: Limita acciones por servicio
    - IP_WHITELISTING: Solo acepta desde IPs permitidas
    
    Args:
        x_internal_key: API Key del servicio
        required_scope: Scope requerido (ej: "appointments:create")
        x_forwarded_for: Header de IP cliente (Docker/K8s)
    
    Returns:
        Dict con service_name, scopes, ip_client
    
    Raises:
        HTTPException 403: Si la clave es inválida, sin scope, o IP no permitida
    """
    
    if not x_internal_key:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="X-Internal-Key header requerido"
        )
    
    # 1️⃣ Validar que la clave exista
    service_name = None
    for service, key in INTERNAL_API_KEYS.items():
        if x_internal_key == key:
            service_name = service
            break
    
    if not service_name:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="X-Internal-Key inválida"
        )
    
    # 2️⃣ Validar que el servicio tenga el scope requerido
    service_scopes = API_KEY_SCOPES.get(service_name, [])
    if required_scope not in service_scopes:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Servicio '{service_name}' no tiene permiso para '{required_scope}'. "
                    f"Scopes permitidos: {service_scopes}"
        )
    
    # 3️⃣ Validar IP del cliente (si hay whitelist)
    client_ip = get_client_ip(x_forwarded_for)
    allowed_ips = ALLOWED_IPS_BY_SERVICE.get(service_name, [])
    
    if allowed_ips:  # Solo validar si hay whitelist configurada
        if client_ip not in allowed_ips:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"IP {client_ip} no está en whitelist para servicio '{service_name}'. "
                        f"IPs permitidas: {allowed_ips}"
            )
    
    # ✅ Todo OK
    return {
        "service": service_name,
        "scopes": service_scopes,
        "ip_client": client_ip,
        "required_scope": required_scope,
    }


def check_api_key_scope(
    auth_data: dict,
    required_scope: str
) -> bool:
    """
    Verifica si la autenticación tiene un scope específico.
    
    Args:
        auth_data: Resultado de validate_api_key_with_scope()
        required_scope: Scope a verificar
    
    Returns:
        True si tiene el permiso
    """
    return required_scope in auth_data.get("scopes", [])
