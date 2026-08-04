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
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import Optional, List
from dotenv import load_dotenv
load_dotenv()
from contextlib import asynccontextmanager

import httpx

from fastapi import FastAPI, Depends, Body, Request, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, RedirectResponse
from slowapi.errors import RateLimitExceeded
from sqlalchemy import select

from app.database import verificar_conexion
from app.rate_limiter import limiter
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

# ── Rate limiting ─────────────────────────────────────────────────────────────
# Protege /auth/login y /auth/register contra fuerza bruta. El contador vive en
# memoria por IP (suficiente para MVP); detrás de un proxy (Render) conviene
# leer X-Forwarded-For en vez de request.client.host.
app.state.limiter = limiter


@app.exception_handler(RateLimitExceeded)
async def _rate_limit_handler(request: Request, exc: RateLimitExceeded):
    return JSONResponse(
        status_code=429,
        content={
            "codigo": "demasiadas_solicitudes",
            "mensaje": "Demasiados intentos. Espera un momento e intenta de nuevo.",
        },
    )

from fastapi import Body
from pydantic import EmailStr
from app.dependencies import crear_token
from app.models_v2_2 import Usuario, UsuarioTenant, Tenant
from app.schemas_v2_2 import TenantPublicOut
from app.database import get_db
from sqlalchemy.orm import Session
import bcrypt
import app.services_v2_2 as svc

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
@limiter.limit("5/minute")
def login(
    request: Request,
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
    if not usuario.activo:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Esta cuenta fue desactivada. Contacta a tu administrador.")
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
@limiter.limit("3/hour")
def register(
    request: Request,
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
        # Antes había un caso especial aquí para que un email invitado
        # (es_invitado=True, sin password_hash) "completara su registro"
        # mandando cualquier password nueva por este endpoint — sin probar
        # que fuera dueño del correo. Ahora que existe activación verificada
        # por token (POST /auth/activar-cuenta), ese hueco se cierra: un
        # email existente siempre es 409, sin excepción.
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


@app.get("/auth/activar-cuenta/validar", tags=["Auth"])
@limiter.limit("10/minute")
def validar_token_activacion(request: Request, token: str, db: Session = Depends(get_db)):
    """Chequeo de solo lectura — no consume el token ni dice de quién es.

    Permite que la pantalla de activación avise "enlace inválido o
    vencido" antes de que el usuario llene el formulario de contraseña.
    """
    usuario = svc.buscar_usuario_por_token_acceso(db, token)
    return {"valido": usuario is not None}


@app.post("/auth/activar-cuenta", tags=["Auth"])
@limiter.limit("10/minute")
def activar_cuenta(
    request: Request,
    token: str = Body(...),
    password: str = Body(..., min_length=8),
    db: Session = Depends(get_db),
):
    """Activa una cuenta sin contraseña (invitado de reserva, vinculado por
    admin/superadmin, inscrito en serie) usando el token de un solo uso
    mandado por email. Global — no depende de tenant_slug: el token ya
    identifica al usuario sin ambigüedad, y la respuesta reusa la misma
    resolución de membresía que /auth/login (auto-login inmediato).
    """
    from fastapi import HTTPException, status

    usuario = svc.buscar_usuario_por_token_acceso(db, token)
    if usuario is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "El enlace no es válido o ya expiró")

    usuario.password_hash = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
    usuario.email_verificado = True
    usuario.es_invitado = False
    svc.limpiar_token_acceso(usuario)
    db.commit()
    db.refresh(usuario)

    token_jwt = crear_token(usuario.id)
    rol, tenant_slug, tenant_nombre = _resolver_membresia(db, usuario.id)
    return {
        "token": token_jwt,
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


# ============================================================
# MERCADOPAGO — CALLBACK + WEBHOOK (sin {tenant_slug})
# ============================================================
@app.get("/api/v2/mercadopago/redirect", tags=["Pagos"])
def mercadopago_redirect(
    reference: str,
    status: str = "pending",
):
    """Redirige al frontend después de que el cliente vuelve de MercadoPago."""
    base = os.environ.get("FRONTEND_URL", "http://localhost:5173").rstrip("/")
    if reference.startswith("reserva:"):
        folio = reference[len("reserva:"):]
        redirect_url = f"{base}/mis-reservas/{folio}?pago={status}"
    elif reference.startswith("inscripcion:"):
        redirect_url = f"{base}/mis-series?pago={status}"
    else:
        redirect_url = f"{base}/mis-reservas?pago={status}"
    return RedirectResponse(redirect_url)


@app.get("/api/v2/mercadopago/callback", tags=["Pagos"])
def mercadopago_callback(
    code: str,
    state: str,
    db: Session = Depends(get_db),
):
    """Callback OAuth de MercadoPago. Valida el state firmado, intercambia
    el code por tokens y guarda la configuración en el tenant."""
    tenant_id = svc.validar_mp_state(state)
    tenant = db.get(Tenant, tenant_id)
    if tenant is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Tenant no encontrado")

    data = svc._mp_intercambiar_code(code)
    access_token = data.get("access_token")
    refresh_token = data.get("refresh_token")
    if not access_token or not refresh_token:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "MercadoPago no entregó los tokens esperados")

    tenant.pago_config = {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "mp_user_id": data.get("user_id"),
        "expires_at": (datetime.now(timezone.utc) + timedelta(days=180)).isoformat(),
    }
    db.commit()

    base = os.environ.get("FRONTEND_URL", "http://localhost:5173").rstrip("/")
    return RedirectResponse(f"{base}/t/{tenant.slug}/admin?mp=conectado")


@app.post("/api/v2/webhooks/mercadopago", status_code=status.HTTP_200_OK, tags=["Pagos"])
async def webhook_mercadopago(
    request: Request,
    db: Session = Depends(get_db),
):
    """Recibe notificaciones de MercadoPago. No confía en el payload:
    re-consulta el pago directo a la API de MP antes de marcar nada pagado."""
    body = await request.json()
    query = request.query_params

    # Soportar formato v1 (topic + id en query/body) y v2 (type + data.id)
    payment_id = (
        body.get("data", {}).get("id")
        or query.get("id")
        or body.get("id")
    )
    mp_user_id = body.get("user_id") or body.get("collector_id") or query.get("user_id")

    if not payment_id:
        return {"ok": True}

    # Buscar tenant por mp_user_id si la notificación lo trae; si no, iterar.
    tenant = None
    if mp_user_id:
        tenant = db.execute(
            select(Tenant).where(
                Tenant.pago_config.isnot(None),
                Tenant.pago_config.op("->>")("mp_user_id") == str(mp_user_id),
            )
        ).scalars().first()

    if tenant is None:
        # Fallback MVP: probar con cada tenant conectado hasta encontrar el pago.
        candidatos = db.execute(
            select(Tenant).where(Tenant.pago_config.isnot(None))
        ).scalars().all()
    else:
        candidatos = [tenant]

    payment_data = None
    tenant_encontrado = None
    for t in candidatos:
        cfg = t.pago_config if isinstance(t.pago_config, dict) else {}
        access_token = cfg.get("access_token")
        if not access_token:
            continue
        try:
            r = httpx.get(
                f"https://api.mercadopago.com/v1/payments/{payment_id}",
                headers={"Authorization": f"Bearer {access_token}"},
                timeout=30,
            )
        except Exception:
            log.exception("Error consultando pago %s en tenant %s", payment_id, t.id)
            continue
        if r.status_code == 200:
            payment_data = r.json()
            tenant_encontrado = t
            break
        if r.status_code == 401:
            # Token vencido; intentar refrescar y reintentar una vez.
            if svc._mp_refrescar_tokens(t, db):
                cfg = t.pago_config if isinstance(t.pago_config, dict) else {}
                access_token = cfg.get("access_token")
                try:
                    r = httpx.get(
                        f"https://api.mercadopago.com/v1/payments/{payment_id}",
                        headers={"Authorization": f"Bearer {access_token}"},
                        timeout=30,
                    )
                except Exception:
                    continue
                if r.status_code == 200:
                    payment_data = r.json()
                    tenant_encontrado = t
                    break

    if payment_data is None or tenant_encontrado is None:
        log.warning("Webhook MercadoPago: no se pudo obtener el pago %s", payment_id)
        return {"ok": True}

    status_detail = payment_data.get("status")
    external_reference = payment_data.get("external_reference")
    transaction_amount = payment_data.get("transaction_amount")

    if status_detail != "approved":
        log.info("Webhook MercadoPago: pago %s no aprobado (%s)", payment_id, status_detail)
        return {"ok": True}

    if not external_reference:
        log.warning("Webhook MercadoPago: pago aprobado sin external_reference")
        return {"ok": True}

    try:
        svc.confirmar_pago_por_referencia(
            db,
            external_reference,
            Decimal(str(transaction_amount or 0)),
            metodo="mercadopago",
        )
        db.commit()
    except svc.ReservaError as e:
        db.rollback()
        log.warning("Webhook MercadoPago: %s (ref=%s)", e.mensaje, external_reference)
        # Devolvemos 200 para que MP no reintente; ya registramos el warning.
        return {"ok": True, "advertencia": e.mensaje}
    except Exception:
        db.rollback()
        log.exception("Error DB en webhook MercadoPago ref=%s", external_reference)
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "Error interno")

    log.info("Webhook MercadoPago: pago confirmado ref=%s", external_reference)
    return {"ok": True}


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
