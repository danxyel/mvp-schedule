"""
dependencies.py — Dependencias de FastAPI

Resuelve tres cosas en cada request:
  1. El tenant activo (por slug en la URL)
  2. El usuario autenticado (por JWT en el header)
  3. Variante opcional del usuario (endpoints públicos + autenticados)

JWT firmado con HS256. En producción cambiar SECRET_KEY por una variable
de entorno de al menos 32 caracteres aleatorios. Nunca commitear el valor real.
"""

import os
from typing import Optional
from datetime import datetime, timezone

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy import select
from sqlalchemy.orm import Session
import jwt

from app.database import get_db
from app.models_v2_2 import Tenant, Usuario

# ── Configuración JWT ────────────────────────────────────────────────────────
SECRET_KEY = os.getenv("JWT_SECRET_KEY", "CAMBIA_ESTO_EN_PRODUCCION_MIN_32_CHARS")
ALGORITHM = "HS256"

bearer_scheme = HTTPBearer(auto_error=False)


# ── Tenant ───────────────────────────────────────────────────────────────────
def get_current_tenant(
    tenant_slug: str,           # viene del path parameter {tenant_slug}
    db: Session = Depends(get_db),
) -> Tenant:
    """Resuelve el tenant por slug. 404 si no existe o está inactivo."""
    tenant = db.execute(
        select(Tenant).where(
            Tenant.slug == tenant_slug,
            Tenant.activo.is_(True),
        )
    ).scalar_one_or_none()

    if tenant is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Tenant '{tenant_slug}' no encontrado",
        )
    return tenant


# ── Usuario autenticado ───────────────────────────────────────────────────────
def _decode_token(token: str) -> dict:
    """Decodifica y valida el JWT. Lanza 401 si es inválido o expirado."""
    import logging
    log = logging.getLogger(__name__)
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        log.info(f"_decode_token: Token decoded successfully for user {payload.get('sub')}")
        return payload
    except jwt.ExpiredSignatureError as e:
        log.error(f"_decode_token: Token expirado: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token expirado",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except jwt.InvalidTokenError as e:
        log.error(f"_decode_token: Token inválido: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido",
            headers={"WWW-Authenticate": "Bearer"},
        )


def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> Usuario:
    """Exige usuario autenticado. 401 si no hay token o es inválido."""
    import logging
    log = logging.getLogger(__name__)

    if credentials is None:
        log.warning("get_current_user: No Authorization header found")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Se requiere autenticación",
            headers={"WWW-Authenticate": "Bearer"},
        )

    log.info(f"get_current_user: Token received (first 20 chars): {credentials.credentials[:20]}...")

    payload = _decode_token(credentials.credentials)
    usuario_id: Optional[int] = payload.get("sub")

    if usuario_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token sin identidad",
        )

    usuario = db.get(Usuario, int(usuario_id))
    if usuario is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario no encontrado",
        )
    if not usuario.activo:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Cuenta desactivada",
        )
    return usuario


def get_current_user_optional(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> Optional[Usuario]:
    """Versión opcional: devuelve None si no hay token en vez de lanzar 401.

    Para endpoints públicos que muestran más información a usuarios autenticados
    (ej. meet_url solo a inscritos confirmados).
    """
    if credentials is None:
        return None
    try:
        payload = _decode_token(credentials.credentials)
        usuario_id = payload.get("sub")
        if usuario_id is None:
            return None
        return db.get(Usuario, int(usuario_id))
    except HTTPException:
        return None


# ── Utilidad: generar token (para el endpoint de login) ──────────────────────
def crear_token(usuario_id: int, expires_delta_hours: int = 24) -> str:
    """Genera un JWT firmado. Usar solo desde el endpoint de autenticación."""
    from datetime import timedelta
    payload = {
        "sub": str(usuario_id),
        "iat": datetime.now(timezone.utc),
        "exp": datetime.now(timezone.utc) + timedelta(hours=expires_delta_hours),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)
