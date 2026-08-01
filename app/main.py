"""
main.py — Punto de entrada FastAPI · MVP Schedule v2.2

Levanta con:
    uvicorn app.main:app --reload

OpenAPI disponible en:
    http://localhost:8000/docs      ← UI interactiva
    http://localhost:8000/openapi.json  ← spec que exportamos a Stitch
"""

import logging
import os
from typing import Optional, List
from dotenv import load_dotenv
load_dotenv()
from contextlib import asynccontextmanager

from fastapi import FastAPI, Depends, Body
from fastapi.middleware.cors import CORSMiddleware

from app.database import verificar_conexion
from app.router_v2_2 import router, superadmin_router

# ── Logging ──────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
)
log = logging.getLogger(__name__)


# ── Lifespan ─────────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Tareas de arranque y apagado."""
    # Arranque
    if verificar_conexion():
        log.info("Base de datos: conectada ✓")
    else:
        log.warning("Base de datos: no disponible al arrancar")

    yield  # la app corre aquí

    # Apagado limpio (APScheduler si lo tienes)
    log.info("Apagando servidor...")


# ── App ───────────────────────────────────────────────────────────────────────
# ENV: "development" (default) expone /docs, /redoc y /openapi.json.
# En "production" se deshabilitan para no exponer Swagger públicamente.
_ENV = os.getenv("ENV", "development")
app = FastAPI(
    title="MVP Schedule",
    description="Sistema de agendamiento multitenant · v2.2",
    version="2.2.0",
    lifespan=lifespan,
    docs_url=None if _ENV == "production" else "/docs",
    redoc_url=None if _ENV == "production" else "/redoc",
    openapi_url=None if _ENV == "production" else "/openapi.json",
)

# ── CORS ──────────────────────────────────────────────────────────────────────
# CORS_ORIGINS: lista de orígenes permitidos separados por coma.
# Default = localhost del dev (Vite 5173 + CRA/Next 3000). En producción
# apuntar a la URL real del frontend (ej. https://tu-app.vercel.app).
_cors_origins = [
    o.strip()
    for o in os.getenv("CORS_ORIGINS", "http://localhost:5173,http://localhost:3000").split(",")
    if o.strip()
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from fastapi import Body
from pydantic import EmailStr
from app.dependencies import crear_token
from app.models_v2_2 import Usuario, UsuarioTenant, Tenant
from app.schemas_v2_2 import TenantPublicOut
from app.database import get_db
from sqlalchemy.orm import Session
import bcrypt

_ROL_RANK = {"cliente": 0, "asesor": 1, "admin": 2, "superadmin": 3}


def _resolver_membresia(db: Session, usuario_id: int):
    """Devuelve (rol, tenant_slug, tenant_nombre) según la mejor membresía activa del usuario.

    Compartido por /auth/login y /auth/register para que ambos devuelvan
    exactamente el mismo rol/tenant — antes /auth/register siempre devolvía
    "cliente" aunque el usuario ya tuviera una membresía como asesor/admin.
    """
    membresias = db.query(UsuarioTenant).filter(
        UsuarioTenant.usuario_id == usuario_id,
        UsuarioTenant.activo.is_(True),
    ).all()
    rol = "cliente"
    tenant_slug = None
    tenant_nombre = None
    if membresias:
        mejor = max(membresias, key=lambda m: _ROL_RANK.get(m.rol.value, -1))
        rol = mejor.rol.value
        if rol != "superadmin":
            tenant = db.get(Tenant, mejor.tenant_id)
            if tenant is not None:
                tenant_slug = tenant.slug
                tenant_nombre = tenant.nombre
    return rol, tenant_slug, tenant_nombre


@app.post("/auth/login", tags=["Auth"])
def login(
    email: str = Body(...),
    password: str = Body(...),
    db: Session = Depends(get_db),
):
    from fastapi import HTTPException, status
    usuario = db.query(Usuario).filter_by(email=email).first()
    if usuario is None or usuario.es_invitado:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Email o contraseña incorrectos")
    if not usuario.password_hash or not bcrypt.checkpw(
        password.encode("utf-8"),
        usuario.password_hash.encode("utf-8"),
    ):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Email o contraseña incorrectos")
    token = crear_token(usuario.id)
    rol, tenant_slug, tenant_nombre = _resolver_membresia(db, usuario.id)

    return {
        "token": token,
        "usuario_id": usuario.id,
        "nombre": usuario.nombre,
        "rol": rol,
        "tenant_slug": tenant_slug,
        "tenant_nombre": tenant_nombre,
    }


@app.post("/auth/register", tags=["Auth"])
def register(
    email: EmailStr = Body(...),
    password: str = Body(..., min_length=8),
    nombre: str = Body(..., min_length=1),
    telefono: Optional[str] = Body(None),
    db: Session = Depends(get_db),
):
    from fastapi import HTTPException, status
    from sqlalchemy.exc import IntegrityError

    email_norm = email.strip().lower()
    nombre_norm = nombre.strip()
    if not nombre_norm:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "El nombre es obligatorio")

    hash_pw = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
    existente = db.query(Usuario).filter_by(email=email_norm).first()

    if existente is not None:
        # Caso especial: un admin ya invitó a este email (POST /admin/usuarios/invitar).
        # Ese usuario existe como placeholder (es_invitado=True, sin password_hash) y
        # hoy no tenía ninguna forma de activarse — este es el fix.
        if existente.es_invitado and not existente.password_hash:
            existente.password_hash = hash_pw
            existente.nombre = nombre_norm
            if telefono:
                existente.telefono = telefono
            existente.es_invitado = False
            db.commit()
            db.refresh(existente)
            usuario = existente
        else:
            raise HTTPException(status.HTTP_409_CONFLICT, "Ya existe una cuenta con ese email")
    else:
        usuario = Usuario(
            email=email_norm,
            password_hash=hash_pw,
            es_invitado=False,
            nombre=nombre_norm,
            telefono=telefono or None,
        )
        try:
            db.add(usuario)
            db.commit()
            db.refresh(usuario)
        except IntegrityError:
            db.rollback()
            raise HTTPException(status.HTTP_409_CONFLICT, "Ya existe una cuenta con ese email")

    token = crear_token(usuario.id)
    rol, tenant_slug, tenant_nombre = _resolver_membresia(db, usuario.id)
    return {
        "token": token,
        "usuario_id": usuario.id,
        "nombre": usuario.nombre,
        "rol": rol,
        "tenant_slug": tenant_slug,
        "tenant_nombre": tenant_nombre,
    }


@app.get("/tenants/publicos", response_model=List[TenantPublicOut], tags=["Tenants"])
def listar_tenants_publicos(db: Session = Depends(get_db)):
    tenants = db.query(Tenant).filter(Tenant.activo == True).order_by(Tenant.nombre).all()
    return tenants
# ── Rutas ─────────────────────────────────────────────────────────────────────
app.include_router(router)
app.include_router(superadmin_router)


# ── Health check ─────────────────────────────────────────────────────────────
@app.get("/health", tags=["Sistema"])
def health():
    """Endpoint de salud. Lo usa Docker, Railway, Render, etc."""
    db_ok = verificar_conexion()
    return {
        "status": "ok" if db_ok else "degradado",
        "version": "2.2.0",
        "database": "conectada" if db_ok else "no disponible",
    }


@app.get("/", tags=["Sistema"])
def root():
    return {"mensaje": "MVP Schedule API v2.2", "docs": "/docs"}
