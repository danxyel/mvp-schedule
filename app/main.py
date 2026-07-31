"""
main.py — Punto de entrada FastAPI · MVP Schedule v2.2

Levanta con:
    uvicorn app.main:app --reload

OpenAPI disponible en:
    http://localhost:8000/docs      ← UI interactiva
    http://localhost:8000/openapi.json  ← spec que exportamos a Stitch
"""

import logging
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
app = FastAPI(
    title="MVP Schedule",
    description="Sistema de agendamiento multitenant · v2.2",
    version="2.2.0",
    lifespan=lifespan,
    # En producción cambiar a False y no exponer /docs públicamente
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
)

# ── CORS ──────────────────────────────────────────────────────────────────────
# Durante desarrollo permite el frontend en localhost:5173 (Vite por defecto)
# En producción reemplazar con la URL real del frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",   # Vite dev
        "http://localhost:3000",   # Create React App / Next.js
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from fastapi import Body
from app.dependencies import crear_token
from app.models_v2_2 import Usuario, UsuarioTenant
from app.database import get_db
from sqlalchemy.orm import Session
import bcrypt

_ROL_RANK = {"cliente": 0, "asesor": 1, "admin": 2, "superadmin": 3}

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
    token = crear_token(usuario.id)

    membresias = db.query(UsuarioTenant).filter(
        UsuarioTenant.usuario_id == usuario.id,
        UsuarioTenant.activo.is_(True),
    ).all()
    rol = "cliente"
    if membresias:
        rol = max(
            (m.rol.value for m in membresias),
            key=lambda v: _ROL_RANK.get(v, -1),
        )

    return {"token": token, "usuario_id": usuario.id, "nombre": usuario.nombre, "rol": rol}
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
