"""
router_v2_2.py — FastAPI
v2.2.1: webhook Stripe, check-in, completar sesión, excepciones específicas.
"""

import logging
from datetime import date, datetime, time, timedelta, timezone
from decimal import Decimal
from typing import Optional, List

import bcrypt
from fastapi import APIRouter, Body, Depends, HTTPException, Query, Path, Request, status
from sqlalchemy import select, func, or_
from sqlalchemy.orm import Session, joinedload, selectinload
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm.exc import StaleDataError

from app.database import get_db
from app.dependencies import (
    get_current_tenant, get_current_user, get_current_user_optional,
)
from app.models_v2_2 import (
    Tenant, Usuario, UsuarioTenant, Sesion, Reserva, Servicio, Sede, Beneficiario,
    SolicitudReserva,
    RolUsuario, EstadoSesion, EstadoReserva, EstadoPagoReserva, MetodoPagoUsado,
    EstadoSolicitud, ESTADOS_SESION_ACTIVA, PlanTenant,
    TipoAgenda, Modalidad, HorarioDisponibilidad, AsesorServicio, HorarioBloqueo,
    TipoBloqueo, utcnow,
)
from app.schemas_v2_2 import (
    ReservaCreate, ReservaOut, ReservaCreateResponse, ReagendarSesionIn,
    CancelarReservaIn, DisponibilidadDiaOut, SlotDisponible,
    SesionListOut, SesionDetailOut, SesionAdminOut, SesionesPaginadasOut,
    PaginacionOut, CheckoutUrlOut, OperacionOut, AsesorPublicOut, SedeOut,
    ReservaAdminListOut, ReservasAdminPaginadasOut,
    PagoLocalIn, AsignarAsesorIn,
    SolicitudCreate, SolicitudOut, SolicitudAdminOut, SolicitudConfirmarOut, SolicitudRechazarIn, CanalEnum,
    TenantCreate, TenantAdminOut, TenantUpdate,
    ServicioAdminIn, ServicioAdminUpdate, ServicioAdminOut, ServicioPublicOut,
    UsuarioAdminOut, HorarioAsesorOut, AsesorServicioOut,
    BloqueoCreate, BloqueoOut,
    exigir_aware,
)
import app.services_v2_2 as svc
from app.services_v2_2 import (
    ReservaError, CupoAgotadoError, FranjaOcupadaError, PermisoDenegadoError,
)

log = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v2/{tenant_slug}", tags=["Agenda v2.2"])


# ============================================================
# AUTORIZACIÓN
# ============================================================
def _membresia(db: Session, tenant_id: int, usuario_id: int) -> Optional[UsuarioTenant]:
    return db.execute(
        select(UsuarioTenant).where(
            UsuarioTenant.tenant_id == tenant_id,
            UsuarioTenant.usuario_id == usuario_id,
            UsuarioTenant.activo.is_(True),
        )
    ).scalar_one_or_none()


def _superadmin_en_algun_tenant(db: Session, usuario_id: int) -> Optional[UsuarioTenant]:
    return db.execute(
        select(UsuarioTenant).where(
            UsuarioTenant.usuario_id == usuario_id,
            UsuarioTenant.rol == RolUsuario.SUPERADMIN,
            UsuarioTenant.activo.is_(True),
        )
    ).scalars().first()


def requiere_staff(
    db: Session = Depends(get_db),
    tenant: Tenant = Depends(get_current_tenant),
    usuario: Usuario = Depends(get_current_user),
) -> UsuarioTenant:
    superadmin = _superadmin_en_algun_tenant(db, usuario.id)
    if superadmin:
        return superadmin
    m = _membresia(db, tenant.id, usuario.id)
    if m is None or m.rol not in (RolUsuario.ASESOR, RolUsuario.ADMIN, RolUsuario.SUPERADMIN):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Requiere permisos de personal")
    return m


def requiere_admin(
    db: Session = Depends(get_db),
    tenant: Tenant = Depends(get_current_tenant),
    usuario: Usuario = Depends(get_current_user),
) -> UsuarioTenant:
    superadmin = _superadmin_en_algun_tenant(db, usuario.id)
    if superadmin:
        return superadmin
    m = _membresia(db, tenant.id, usuario.id)
    if m is None or m.rol not in (RolUsuario.ADMIN, RolUsuario.SUPERADMIN):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Requiere permisos de administrador")
    return m


def requiere_superadmin(
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_current_user),
) -> UsuarioTenant:
    """Exige rol SUPERADMIN en cualquier tenant. No depende de {tenant_slug}."""
    m = _superadmin_en_algun_tenant(db, usuario.id)
    if m is None:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Requiere permisos de superadministrador")
    return m


def _es_staff(db: Session, tenant_id: int, usuario_id: int) -> bool:
    if _superadmin_en_algun_tenant(db, usuario_id) is not None:
        return True
    m = _membresia(db, tenant_id, usuario_id)
    return m is not None and m.rol in (RolUsuario.ASESOR, RolUsuario.ADMIN, RolUsuario.SUPERADMIN)


def _es_propietario_reserva(db: Session, tenant_id: int, reserva: Reserva, usuario_id: int) -> bool:
    """Devuelve True si el usuario es el creador de la reserva o su beneficiario."""
    if reserva.creado_por_usuario_id == usuario_id:
        return True
    if reserva.beneficiario_id is None:
        return False
    beneficiario = db.get(Beneficiario, reserva.beneficiario_id)
    return (
        beneficiario is not None
        and beneficiario.tenant_id == tenant_id
        and beneficiario.usuario_id == usuario_id
    )


# ============================================================
# TRADUCCIÓN DE ERRORES
# ============================================================
_CODIGO_HTTP = {
    "cupo_agotado": status.HTTP_409_CONFLICT,
    "franja_ocupada": status.HTTP_409_CONFLICT,
    "reserva_duplicada": status.HTTP_409_CONFLICT,
    "sesion_cerrada": status.HTTP_409_CONFLICT,
    "permiso_denegado": status.HTTP_403_FORBIDDEN,
    "sesion_no_encontrada": status.HTTP_404_NOT_FOUND,
    "servicio_no_encontrado": status.HTTP_404_NOT_FOUND,
    "no_requiere_confirmacion": status.HTTP_409_CONFLICT,
    "fecha_ambigua": status.HTTP_400_BAD_REQUEST,
    "identidad_requerida": status.HTTP_401_UNAUTHORIZED,
    "not_found": status.HTTP_404_NOT_FOUND,
    "estado_invalido": status.HTTP_409_CONFLICT,
}


def _http_de(err: ReservaError) -> HTTPException:
    return HTTPException(
        status_code=_CODIGO_HTTP.get(err.codigo, status.HTTP_400_BAD_REQUEST),
        detail={"codigo": err.codigo, "mensaje": err.mensaje},
    )


# ============================================================
# SERIALIZADORES
# ============================================================
def _asesor_out(sesion: Sesion) -> Optional[AsesorPublicOut]:
    if sesion.asesor is None or sesion.asesor.usuario is None:
        return None
    return AsesorPublicOut(
        id=sesion.asesor.id,
        nombre=sesion.asesor.usuario.nombre,
        avatar_url=sesion.asesor.usuario.avatar_url,
        bio=sesion.asesor.bio,
    )


def _sesion_list_out(s: Sesion) -> SesionListOut:
    return SesionListOut(
        id=s.id,
        servicio_id=s.servicio_id,
        fecha_hora_inicio=s.fecha_hora_inicio,
        fecha_hora_fin=s.fecha_hora_fin,
        timezone=s.timezone,
        estado=s.estado.value,
        cupo_maximo=s.cupo_maximo,
        inscritos=s.inscritos,
        lugares_disponibles=max(0, s.cupo_maximo - s.inscritos),
        asesor=_asesor_out(s),
        sede=SedeOut.model_validate(s.sede) if s.sede else None,
    )


def _solicitud_out(db: Session, s: SolicitudReserva) -> SolicitudOut:
    servicio = db.get(Servicio, s.servicio_id)
    return SolicitudOut(
        id=s.id,
        servicio_id=s.servicio_id,
        servicio_nombre=servicio.nombre if servicio else None,
        fecha_hora_propuesta=s.fecha_hora_propuesta,
        duracion_minutos=s.duracion_minutos,
        notas_cliente=s.notas_cliente,
        estado=s.estado.value,
        asesor_id=s.asesor_id,
        motivo_rechazo=s.motivo_rechazo,
        reserva_id=s.reserva_id,
        creado_en=s.creado_en,
    )


def _solicitud_admin_out(db: Session, s: SolicitudReserva) -> SolicitudAdminOut:
    servicio = db.get(Servicio, s.servicio_id)
    cliente = db.get(Usuario, s.cliente_usuario_id)
    return SolicitudAdminOut(
        id=s.id,
        servicio_id=s.servicio_id,
        servicio_nombre=servicio.nombre if servicio else None,
        fecha_hora_propuesta=s.fecha_hora_propuesta,
        duracion_minutos=s.duracion_minutos,
        notas_cliente=s.notas_cliente,
        estado=s.estado.value,
        asesor_id=s.asesor_id,
        motivo_rechazo=s.motivo_rechazo,
        reserva_id=s.reserva_id,
        creado_en=s.creado_en,
        cliente_usuario_id=s.cliente_usuario_id,
        nombre_cliente=cliente.nombre if cliente else None,
        email_cliente=cliente.email if cliente else None,
        resuelto_por_id=s.resuelto_por_id,
        resuelto_en=s.resuelto_en,
    )


# ============================================================
# SERVICIOS PÚBLICOS
# ============================================================
@router.get("/servicios", response_model=List[ServicioPublicOut])
def listar_servicios_publicos(
    db: Session = Depends(get_db),
    tenant: Tenant = Depends(get_current_tenant),
):
    servicios = db.execute(
        select(Servicio).where(
            Servicio.tenant_id == tenant.id,
            Servicio.activo.is_(True),
            Servicio.visible_web.is_(True),
        ).order_by(Servicio.nombre.asc()).limit(20)
    ).scalars().all()
    return servicios


# ============================================================
# DISPONIBILIDAD (público)
# ============================================================
@router.get("/servicios/{servicio_id}/disponibilidad", response_model=DisponibilidadDiaOut)
def disponibilidad_por_dia(
    servicio_id: int = Path(..., gt=0),
    fecha: datetime = Query(..., description="Fecha con offset, ej. 2026-08-01T00:00:00-06:00"),
    asesor_id: Optional[int] = Query(None, gt=0),
    db: Session = Depends(get_db),
    tenant: Tenant = Depends(get_current_tenant),
):
    try:
        fecha = exigir_aware(fecha, "fecha")
        datos = svc.listar_slots_disponibles(db, tenant, servicio_id, fecha, asesor_id)
    except ReservaError as e:
        raise _http_de(e)
    except ValueError as e:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, str(e))
    return DisponibilidadDiaOut(**datos)


@router.get("/servicios/{servicio_id}/sesiones", response_model=SesionesPaginadasOut)
def listar_sesiones_abiertas(
    servicio_id: int = Path(..., gt=0),
    desde: Optional[datetime] = Query(None),
    hasta: Optional[datetime] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    tenant: Tenant = Depends(get_current_tenant),
):
    cond = [
        Sesion.tenant_id == tenant.id,
        Sesion.servicio_id == servicio_id,
        Sesion.estado.in_(ESTADOS_SESION_ACTIVA),
    ]
    if desde:
        cond.append(Sesion.fecha_hora_inicio >= exigir_aware(desde, "desde"))
    else:
        cond.append(Sesion.fecha_hora_inicio >= datetime.now(timezone.utc))
    if hasta:
        cond.append(Sesion.fecha_hora_inicio <= exigir_aware(hasta, "hasta"))

    total = db.execute(select(func.count(Sesion.id)).where(*cond)).scalar_one()

    sesiones = db.execute(
        select(Sesion)
        .options(
            joinedload(Sesion.asesor).joinedload(UsuarioTenant.usuario),
            joinedload(Sesion.sede),
        )
        .where(*cond)
        .order_by(Sesion.fecha_hora_inicio)
        .limit(limit).offset(offset)
    ).scalars().unique().all()

    return SesionesPaginadasOut(
        items=[_sesion_list_out(s) for s in sesiones],
        paginacion=PaginacionOut(total=total, limit=limit, offset=offset),
    )


@router.get("/sesiones/{sesion_id}", response_model=SesionDetailOut)
def detalle_sesion(
    sesion_id: int = Path(..., gt=0),
    db: Session = Depends(get_db),
    tenant: Tenant = Depends(get_current_tenant),
    usuario: Optional[Usuario] = Depends(get_current_user_optional),
):
    s = db.execute(
        select(Sesion)
        .options(
            joinedload(Sesion.asesor).joinedload(UsuarioTenant.usuario),
            joinedload(Sesion.sede),
            joinedload(Sesion.servicio),
        )
        .where(Sesion.tenant_id == tenant.id, Sesion.id == sesion_id)
    ).scalars().unique().one_or_none()

    if s is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Sesión no encontrada")

    base = _sesion_list_out(s)
    meet = None
    if usuario is not None:
        inscrito = db.execute(
            select(Reserva.id).where(
                Reserva.sesion_id == s.id,
                Reserva.creado_por_usuario_id == usuario.id,
                Reserva.estado.in_([EstadoReserva.CONFIRMADA.value, EstadoReserva.EN_ESPERA.value]),
            ).limit(1)
        ).first()
        if inscrito or _es_staff(db, tenant.id, usuario.id):
            meet = s.meet_url

    return SesionDetailOut(
        **base.model_dump(),
        modalidad=s.servicio.modalidad.value if s.servicio else None,
        servicio_nombre=s.servicio.nombre if s.servicio else None,
        duracion_minutos=s.servicio.duracion_minutos if s.servicio else None,
        precio=s.servicio.precio if (s.servicio and tenant.mostrar_precios_web) else None,
        moneda=s.servicio.moneda if s.servicio else None,
        meet_url=meet,
    )


@router.get("/sesiones/{sesion_id}/admin", response_model=SesionAdminOut)
def detalle_sesion_admin(
    sesion_id: int = Path(..., gt=0),
    db: Session = Depends(get_db),
    tenant: Tenant = Depends(get_current_tenant),
    staff: UsuarioTenant = Depends(requiere_staff),
):
    s = db.execute(
        select(Sesion)
        .options(
            joinedload(Sesion.asesor).joinedload(UsuarioTenant.usuario),
            joinedload(Sesion.sede),
            joinedload(Sesion.servicio),
            selectinload(Sesion.reservas).joinedload(Reserva.creado_por),
        )
        .where(Sesion.tenant_id == tenant.id, Sesion.id == sesion_id)
    ).scalars().unique().one_or_none()

    if s is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Sesión no encontrada")

    base = _sesion_list_out(s)
    return SesionAdminOut(
        **base.model_dump(),
        modalidad=s.servicio.modalidad.value if s.servicio else None,
        servicio_nombre=s.servicio.nombre if s.servicio else None,
        duracion_minutos=s.servicio.duracion_minutos if s.servicio else None,
        precio=s.servicio.precio if s.servicio else None,
        moneda=s.servicio.moneda if s.servicio else None,
        meet_url=s.meet_url,
        notas_internas=s.notas_internas,
        google_event_id=s.google_event_id,
        creado_por_tipo=s.creado_por_tipo.value,
        creado_en=s.creado_en,
        version_id=s.version_id,
        reservas=[
            {
                "id": r.id,
                "folio": r.folio,
                "estado": r.estado.value,
                "estado_pago": r.estado_pago.value,
                "nombre_cliente": r.creado_por.nombre if r.creado_por else None,
                "email_cliente": r.creado_por.email if r.creado_por else None,
                "creado_en": r.creado_en,
            }
            for r in s.reservas
        ],
    )


# ============================================================
# CREAR RESERVA
# ============================================================
@router.post("/reservas", response_model=ReservaCreateResponse, status_code=status.HTTP_201_CREATED)
def crear_nueva_reserva(
    payload: ReservaCreate,
    request: Request,
    db: Session = Depends(get_db),
    tenant: Tenant = Depends(get_current_tenant),
    usuario: Optional[Usuario] = Depends(get_current_user_optional),
):
    ip = request.client.host if request.client else None
    ua = request.headers.get("user-agent")

    try:
        resultado = svc.crear_reserva(db, tenant, payload, usuario, ip=ip, user_agent=ua)
        db.commit()
    except ReservaError as e:
        db.rollback()
        raise _http_de(e)
    except StaleDataError:
        db.rollback()
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            {"codigo": "conflicto_concurrencia",
             "mensaje": "La sesión cambió mientras se procesaba. Intente de nuevo."},
        )
    except IntegrityError:
        db.rollback()
        log.exception("Violación de integridad al crear reserva")
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            {"codigo": "conflicto", "mensaje": "El horario dejó de estar disponible."},
        )
    except SQLAlchemyError:
        db.rollback()
        log.exception("Error de base de datos al crear reserva")
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "Error interno de base de datos")
    except Exception:
        db.rollback()
        raise

    reserva = resultado["reserva"]
    sesion = resultado["sesion"]
    servicio = resultado["servicio"]
    tareas = resultado["tareas_post_commit"]

    checkout = None
    if tareas["checkout"]:
        try:
            checkout = svc.iniciar_checkout(tenant, reserva, resultado["usuario"])
        except Exception:
            log.exception("Fallo al iniciar checkout para folio %s", reserva.folio)

    if tareas["sincronizar_calendario"]:
        try:
            svc.sincronizar_calendario(tenant, sesion)
        except Exception:
            log.exception("Fallo al sincronizar calendario para sesión %s", sesion.id)

    if tareas["enviar_confirmacion"]:
        try:
            svc.enviar_email_confirmacion(tenant, reserva, resultado["usuario"], sesion)
        except Exception:
            log.exception("Fallo al enviar confirmación para folio %s", reserva.folio)

    return ReservaCreateResponse(
        reserva=ReservaOut(
            id=reserva.id,
            folio=reserva.folio,
            codigo_confirmacion=reserva.codigo_confirmacion,
            estado=reserva.estado.value,
            estado_pago=reserva.estado_pago.value,
            sesion_id=sesion.id,
            servicio_id=servicio.id,
            servicio_nombre=servicio.nombre,
            fecha_hora_inicio=sesion.fecha_hora_inicio,
            fecha_hora_fin=sesion.fecha_hora_fin,
            timezone=sesion.timezone,
            modalidad=servicio.modalidad.value,
            precio_final=reserva.precio_final,
            moneda=reserva.moneda,
            meet_url=sesion.meet_url,
            sede=SedeOut.model_validate(sesion.sede) if sesion.sede else None,
            asesor=_asesor_out(sesion),
            hold_expira_en=reserva.hold_expira_en,
            notas_cliente=reserva.notas_cliente,
            creado_en=reserva.creado_en,
        ),
        checkout=checkout,
        mensaje=resultado["mensaje"],
        sesion_asignada_id=sesion.id,
        sesion_creada=resultado["sesion_creada"],
    )


# ============================================================
# WEBHOOK STRIPE — NUEVO
# ============================================================
@router.post("/webhooks/stripe", status_code=status.HTTP_200_OK)
async def webhook_stripe(
    request: Request,
    db: Session = Depends(get_db),
):
    import os, json
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")
    endpoint_secret = os.environ.get("STRIPE_WEBHOOK_SECRET")

    try:
        import stripe
        event = stripe.Webhook.construct_event(payload, sig_header, endpoint_secret)
    except (ValueError, stripe.error.SignatureVerificationError):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Firma inválida")
    except ImportError:
        event = json.loads(payload)

    if event.get("type") == "checkout.session.completed":
        session = event["data"]["object"]
        folio = session.get("metadata", {}).get("folio")
        monto = Decimal(str(session.get("amount_total", 0))) / 100
        if folio:
            try:
                svc.confirmar_pago_por_folio(db, folio, monto=monto, metodo="stripe")
                db.commit()
            except ReservaError as e:
                db.rollback()
                log.warning("Webhook Stripe: %s (folio=%s)", e.mensaje, folio)
                raise HTTPException(_CODIGO_HTTP.get(e.codigo, 400), e.mensaje)
            except SQLAlchemyError:
                db.rollback()
                log.exception("Error DB en webhook Stripe folio=%s", folio)
                raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "Error DB")

    return {"ok": True}


# ============================================================
# CONSULTAR RESERVA
# ============================================================
@router.get("/reservas/{folio}", response_model=ReservaOut)
def consultar_reserva(
    folio: str = Path(..., min_length=8, max_length=32),
    db: Session = Depends(get_db),
    tenant: Tenant = Depends(get_current_tenant),
    usuario: Usuario = Depends(get_current_user),
):
    r = db.execute(
        select(Reserva)
        .options(
            joinedload(Reserva.sesion).joinedload(Sesion.sede),
            joinedload(Reserva.sesion).joinedload(Sesion.asesor).joinedload(UsuarioTenant.usuario),
            joinedload(Reserva.servicio),
        )
        .where(Reserva.tenant_id == tenant.id, Reserva.folio == folio)
    ).scalars().unique().one_or_none()

    if r is None or (
        not _es_propietario_reserva(db, tenant.id, r, usuario.id)
        and not _es_staff(db, tenant.id, usuario.id)
    ):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Reserva no encontrada")

    s = r.sesion
    return ReservaOut(
        id=r.id, folio=r.folio, codigo_confirmacion=r.codigo_confirmacion,
        estado=r.estado.value, estado_pago=r.estado_pago.value,
        sesion_id=s.id, servicio_id=r.servicio_id,
        servicio_nombre=r.servicio.nombre if r.servicio else None,
        fecha_hora_inicio=s.fecha_hora_inicio, fecha_hora_fin=s.fecha_hora_fin,
        timezone=s.timezone,
        modalidad=r.servicio.modalidad.value if r.servicio else None,
        precio_final=r.precio_final, moneda=r.moneda,
        meet_url=s.meet_url if r.estado == EstadoReserva.CONFIRMADA else None,
        sede=SedeOut.model_validate(s.sede) if s.sede else None,
        asesor=_asesor_out(s),
        hold_expira_en=r.hold_expira_en,
        notas_cliente=r.notas_cliente,
        creado_en=r.creado_en,
    )


@router.get("/mis-reservas", response_model=List[ReservaOut])
def listar_mis_reservas(
    incluir_pasadas: bool = Query(False),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    tenant: Tenant = Depends(get_current_tenant),
    usuario: Usuario = Depends(get_current_user),
):
    stmt = (
        select(Reserva)
        .outerjoin(Beneficiario, Beneficiario.id == Reserva.beneficiario_id)
        .join(Sesion, Sesion.id == Reserva.sesion_id)
        .options(
            joinedload(Reserva.sesion).joinedload(Sesion.sede),
            joinedload(Reserva.sesion).joinedload(Sesion.asesor).joinedload(UsuarioTenant.usuario),
            joinedload(Reserva.servicio),
        )
        .where(
            Reserva.tenant_id == tenant.id,
            or_(
                Reserva.creado_por_usuario_id == usuario.id,
                Beneficiario.usuario_id == usuario.id,
            ),
        )
    )
    if not incluir_pasadas:
        stmt = stmt.where(Sesion.fecha_hora_inicio >= datetime.now(timezone.utc))

    filas = db.execute(
        stmt.order_by(Sesion.fecha_hora_inicio.desc()).limit(limit).offset(offset)
    ).scalars().unique().all()

    salida = []
    for r in filas:
        s = r.sesion
        salida.append(ReservaOut(
            id=r.id, folio=r.folio, codigo_confirmacion=r.codigo_confirmacion,
            estado=r.estado.value, estado_pago=r.estado_pago.value,
            sesion_id=s.id, servicio_id=r.servicio_id,
            servicio_nombre=r.servicio.nombre if r.servicio else None,
            fecha_hora_inicio=s.fecha_hora_inicio, fecha_hora_fin=s.fecha_hora_fin,
            timezone=s.timezone,
            modalidad=r.servicio.modalidad.value if r.servicio else None,
            precio_final=r.precio_final, moneda=r.moneda,
            meet_url=s.meet_url if r.estado == EstadoReserva.CONFIRMADA else None,
            sede=SedeOut.model_validate(s.sede) if s.sede else None,
            asesor=_asesor_out(s),
            hold_expira_en=r.hold_expira_en,
            notas_cliente=r.notas_cliente,
            creado_en=r.creado_en,
        ))
    return salida


# ============================================================
# SOLICITUDES DE RESERVA — confirmación manual (Tarea 2)
# ============================================================
@router.post("/solicitudes", response_model=SolicitudOut, status_code=status.HTTP_201_CREATED)
def crear_solicitud_reserva_endpoint(
    payload: SolicitudCreate,
    request: Request,
    db: Session = Depends(get_db),
    tenant: Tenant = Depends(get_current_tenant),
    usuario: Usuario = Depends(get_current_user),
):
    ip = request.client.host if request.client else None
    ua = request.headers.get("user-agent")

    try:
        solicitud = svc.crear_solicitud_reserva(db, tenant, payload, usuario, ip=ip, user_agent=ua)
        db.commit()
    except ReservaError as e:
        db.rollback()
        raise _http_de(e)
    except SQLAlchemyError:
        db.rollback()
        log.exception("Error de base de datos al crear solicitud de reserva")
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "Error interno de base de datos")
    except Exception:
        db.rollback()
        raise

    db.refresh(solicitud)
    return _solicitud_out(db, solicitud)


@router.get("/mis-solicitudes", response_model=List[SolicitudOut])
def listar_mis_solicitudes(
    db: Session = Depends(get_db),
    tenant: Tenant = Depends(get_current_tenant),
    usuario: Usuario = Depends(get_current_user),
):
    filas = db.execute(
        select(SolicitudReserva).where(
            SolicitudReserva.tenant_id == tenant.id,
            SolicitudReserva.cliente_usuario_id == usuario.id,
        ).order_by(SolicitudReserva.creado_en.desc())
    ).scalars().all()
    return [_solicitud_out(db, s) for s in filas]


# ============================================================
# ADMIN — LISTADO DE RESERVAS
# ============================================================
@router.get("/admin/reservas", response_model=ReservasAdminPaginadasOut)
def listar_reservas_admin(
    fecha: Optional[date] = Query(None, description="Filtra por fecha de la sesión. Default: hoy (omitir junto con estado para listar todas las fechas)"),
    estado: Optional[str] = Query(None, description="Filtra por estado de reserva (ej. confirmada). Si se omite fecha, aplica a todas las fechas"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    tenant: Tenant = Depends(get_current_tenant),
    staff: UsuarioTenant = Depends(requiere_staff),
):
    estado_enum = None
    if estado:
        try:
            estado_enum = EstadoReserva(estado)
        except ValueError:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY,
                f"Estado de reserva inválido: {estado}",
            )

    if fecha is None and estado_enum is None:
        fecha = date.today()

    cond = [Reserva.tenant_id == tenant.id]
    if fecha is not None:
        inicio = datetime.combine(fecha, time.min, tzinfo=timezone.utc)
        fin = inicio + timedelta(days=1)
        cond.extend([
            Sesion.fecha_hora_inicio >= inicio,
            Sesion.fecha_hora_inicio < fin,
        ])
    if estado_enum is not None:
        cond.append(Reserva.estado == estado_enum)

    total = db.execute(
        select(func.count(Reserva.id))
        .join(Sesion, Sesion.id == Reserva.sesion_id)
        .where(*cond)
    ).scalar_one()

    reservas = db.execute(
        select(Reserva)
        .join(Sesion, Sesion.id == Reserva.sesion_id)
          .options(
              joinedload(Reserva.sesion).joinedload(Sesion.asesor).joinedload(UsuarioTenant.usuario),
              joinedload(Reserva.servicio),
              joinedload(Reserva.creado_por),
          )
        .where(*cond)
        .order_by(Sesion.fecha_hora_inicio.desc())
        .limit(limit).offset(offset)
    ).scalars().unique().all()

    items = []
    for r in reservas:
        s = r.sesion
        asesor = s.asesor if s and s.asesor else None
        items.append(ReservaAdminListOut(
            id=r.id,
            folio=r.folio,
            estado=r.estado.value,
            estado_pago=r.estado_pago.value,
            nombre_cliente=r.creado_por.nombre if r.creado_por else None,
            email_cliente=r.creado_por.email if r.creado_por else None,
            servicio_id=r.servicio.id if r.servicio else 0,
            sesion_id=s.id,
            servicio_nombre=r.servicio.nombre if r.servicio else None,
            fecha_hora_inicio=s.fecha_hora_inicio,
            fecha_hora_fin=s.fecha_hora_fin,
            timezone=s.timezone,
            precio_final=r.precio_final,
            moneda=r.moneda,
            asesor=AsesorPublicOut(
                id=asesor.id,
                nombre=asesor.usuario.nombre if asesor.usuario else "Sin asignar",
                avatar_url=asesor.usuario.avatar_url if asesor.usuario else None,
                bio=asesor.bio,
            ) if asesor else None,
        ))

    return ReservasAdminPaginadasOut(
        items=items,
        paginacion=PaginacionOut(total=total, limit=limit, offset=offset),
    )


# ============================================================
# ADMIN — REGISTRO DE PAGO LOCAL
# ============================================================
@router.post("/admin/reservas/{folio}/pago-local", response_model=OperacionOut)
def registrar_pago_local(
    payload: PagoLocalIn,
    folio: str = Path(..., min_length=8, max_length=32),
    db: Session = Depends(get_db),
    tenant: Tenant = Depends(get_current_tenant),
    staff: UsuarioTenant = Depends(requiere_staff),
):
    r = db.execute(
        select(Reserva).where(Reserva.tenant_id == tenant.id, Reserva.folio == folio)
    ).scalar_one_or_none()

    if r is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Reserva no encontrada")

    if r.estado in (EstadoReserva.CANCELADA, EstadoReserva.NO_SHOW):
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "No se puede registrar un pago en una reserva cancelada",
        )
    if r.estado_pago == EstadoPagoReserva.COMPLETADO:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "La reserva ya tiene el pago registrado",
        )
    if r.estado_pago == EstadoPagoReserva.REEMBOLSADO:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "El pago de esta reserva fue reembolsado",
        )

    r.estado_pago = EstadoPagoReserva.COMPLETADO
    r.pagado_en = utcnow()
    r.metodo_pago_usado = MetodoPagoUsado(payload.metodo)
    r.hold_expira_en = None
    if payload.monto is not None:
        r.precio_final = payload.monto
    if r.estado == EstadoReserva.EN_ESPERA:
        r.estado = EstadoReserva.CONFIRMADA

    svc.actualizar_estado_sesion(db, r.sesion_id, tenant.id)

    svc.registrar_bitacora(
        db, tenant.id, "reserva", r.id, "pago_local",
        usuario_id=staff.usuario_id,
        detalles={
            "folio": folio,
            "metodo": payload.metodo,
            "monto": str(payload.monto) if payload.monto is not None else str(r.precio_final),
            "referencia": payload.referencia,
        },
    )

    db.commit()
    return OperacionOut(
        ok=True,
        mensaje="Pago registrado",
        detalle={"folio": folio, "metodo_pago_usado": payload.metodo},
    )


# ============================================================
# ADMIN — ASIGNAR ASESOR A RESERVA PENDIENTE (confirmación manual)
# ============================================================
@router.post("/admin/reservas/{reserva_id}/asignar-asesor", response_model=OperacionOut)
def asignar_asesor_reserva(
    payload: AsignarAsesorIn,
    reserva_id: int = Path(..., gt=0),
    db: Session = Depends(get_db),
    tenant: Tenant = Depends(get_current_tenant),
    staff: UsuarioTenant = Depends(requiere_staff),
):
    reserva = db.execute(
        select(Reserva).where(Reserva.tenant_id == tenant.id, Reserva.id == reserva_id)
    ).scalar_one_or_none()
    if reserva is None:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND,
            {"codigo": "reserva_no_encontrada", "mensaje": "Reserva no encontrada"},
        )

    if reserva.estado != EstadoReserva.PENDIENTE:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            {"codigo": "reserva_no_pendiente",
             "mensaje": "La reserva debe estar pendiente para asignar asesor"},
        )

    sesion = db.get(Sesion, reserva.sesion_id)
    if sesion is None:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND,
            {"codigo": "sesion_no_encontrada", "mensaje": "La sesión no existe"},
        )

    asesor = db.execute(
        select(UsuarioTenant).where(
            UsuarioTenant.tenant_id == tenant.id,
            UsuarioTenant.id == payload.asesor_id,
            UsuarioTenant.activo.is_(True),
            UsuarioTenant.rol.in_([RolUsuario.ASESOR.value, RolUsuario.ADMIN.value]),
        )
    ).scalar_one_or_none()
    if asesor is None:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND,
            {"codigo": "asesor_no_encontrado", "mensaje": "Asesor no encontrado en este tenant"},
        )

    servicio = db.get(Servicio, reserva.servicio_id)
    if servicio is None:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND,
            {"codigo": "servicio_no_encontrado", "mensaje": "El servicio no existe o no está disponible"},
        )

    try:
        svc.validar_disponibilidad_franja(
            db, tenant.id, servicio, sesion.fecha_hora_inicio, sesion.fecha_hora_fin,
            asesor_id=payload.asesor_id, tzname=sesion.timezone,
        )
    except ReservaError as e:
        db.rollback()
        raise _http_de(e)

    sesion.asesor_id = payload.asesor_id
    reserva.estado = EstadoReserva.CONFIRMADA

    svc.registrar_bitacora(
        db, tenant.id, "reserva", reserva.id, "asignar_asesor",
        usuario_id=staff.usuario_id,
        detalles={
            "folio": reserva.folio,
            "sesion_id": sesion.id,
            "asesor_id": payload.asesor_id,
        },
    )

    try:
        db.commit()
    except SQLAlchemyError:
        db.rollback()
        log.exception("Error DB al asignar asesor a reserva %s", reserva_id)
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "Error interno de base de datos")
    except Exception:
        db.rollback()
        raise

    db.refresh(reserva)

    # Efectos externos DESPUÉS del commit: no rompen la respuesta si fallan.
    try:
        svc.enviar_email_confirmacion(tenant, reserva, reserva.creado_por, sesion)
    except Exception:
        log.exception("Fallo al enviar confirmación para folio %s", reserva.folio)

    try:
        svc.sincronizar_calendario(tenant, sesion)
    except Exception:
        log.exception("Fallo al sincronizar calendario para sesión %s", sesion.id)

    return OperacionOut(
        ok=True,
        mensaje="Asesor asignado y reserva confirmada",
        detalle={
            "reserva_id": reserva.id,
            "folio": reserva.folio,
            "sesion_id": sesion.id,
            "asesor_id": payload.asesor_id,
        },
    )


# ============================================================
# ADMIN — SOLICITUDES DE RESERVA (confirmación manual, Tarea 10)
# El cliente propone fecha/hora (POST /solicitudes) y no reserva nada.
# El staff lista las pendientes y las confirma: esto crea la Reserva
# PENDIENTE real (crear_reserva) y el staff la termina de confirmar con
# POST /admin/reservas/{id}/asignar-asesor (email + calendario post-commit).
# ============================================================
@router.get("/admin/solicitudes", response_model=List[SolicitudAdminOut])
def listar_solicitudes_admin(
    estado: Optional[EstadoSolicitud] = Query(
        None, description="Filtrar por estado. Default: todas",
    ),
    servicio_id: Optional[int] = Query(None, gt=0),
    db: Session = Depends(get_db),
    tenant: Tenant = Depends(get_current_tenant),
    _: UsuarioTenant = Depends(requiere_staff),
):
    cond = [SolicitudReserva.tenant_id == tenant.id]
    if estado is not None:
        cond.append(SolicitudReserva.estado == estado)
    if servicio_id is not None:
        cond.append(SolicitudReserva.servicio_id == servicio_id)

    filas = db.execute(
        select(SolicitudReserva)
        .where(*cond)
        .order_by(SolicitudReserva.creado_en.asc())
    ).scalars().all()
    return [_solicitud_admin_out(db, s) for s in filas]


@router.post("/admin/solicitudes/{solicitud_id}/confirmar", response_model=SolicitudConfirmarOut)
def confirmar_solicitud_admin(
    solicitud_id: int = Path(..., gt=0),
    request: Request = None,
    db: Session = Depends(get_db),
    tenant: Tenant = Depends(get_current_tenant),
    staff: UsuarioTenant = Depends(requiere_staff),
):
    solicitud = db.execute(
        select(SolicitudReserva)
        .where(
            SolicitudReserva.tenant_id == tenant.id,
            SolicitudReserva.id == solicitud_id,
        )
        .with_for_update()
    ).scalar_one_or_none()
    if solicitud is None:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND,
            {"codigo": "solicitud_no_encontrada", "mensaje": "Solicitud no encontrada"},
        )

    if solicitud.estado != EstadoSolicitud.PENDIENTE:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            {"codigo": "solicitud_no_pendiente",
             "mensaje": "La solicitud ya fue resuelta"},
        )

    if solicitud.fecha_hora_propuesta <= utcnow():
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            {"codigo": "fecha_ambigua",
             "mensaje": "La fecha propuesta ya pasó; ya no se puede confirmar"},
        )

    servicio = db.get(Servicio, solicitud.servicio_id)
    if servicio is None or not servicio.activo:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND,
            {"codigo": "servicio_no_encontrado",
             "mensaje": "El servicio no existe o no está disponible"},
        )

    cliente = db.get(Usuario, solicitud.cliente_usuario_id)
    if cliente is None:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            {"codigo": "cliente_no_encontrado",
             "mensaje": "El cliente que propuso la cita ya no existe"},
        )

    ip = request.client.host if request.client else None
    ua = request.headers.get("user-agent")

    payload = ReservaCreate(
        servicio_id=solicitud.servicio_id,
        fecha_hora_inicio=solicitud.fecha_hora_propuesta,
        sesion_id=None,
        asesor_id=None,
        sede_id=None,
        notas_cliente=solicitud.notas_cliente,
        canal=CanalEnum.ADMIN,
    )
    try:
        resultado = svc.crear_reserva(
            db, tenant, payload, usuario_actual=cliente, ip=ip, user_agent=ua,
        )
    except ReservaError as e:
        db.rollback()
        raise _http_de(e)
    except StaleDataError:
        db.rollback()
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            {"codigo": "conflicto_concurrencia",
             "mensaje": "La sesión cambió mientras se procesaba. Intente de nuevo."},
        )
    except SQLAlchemyError:
        db.rollback()
        log.exception("Error de base de datos al confirmar solicitud %s", solicitud_id)
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "Error interno de base de datos")

    reserva = resultado["reserva"]
    sesion = resultado["sesion"]

    solicitud.estado = EstadoSolicitud.ACEPTADA
    solicitud.reserva_id = reserva.id
    solicitud.resuelto_por_id = staff.usuario_id
    solicitud.resuelto_en = utcnow()

    svc.registrar_bitacora(
        db, tenant.id, "solicitud_reserva", solicitud.id, "solicitud_reserva_confirmada",
        usuario_id=staff.usuario_id,
        detalles={
            "reserva_id": reserva.id,
            "folio": reserva.folio,
            "sesion_id": sesion.id,
            "sesion_creada": resultado["sesion_creada"],
        },
        ip=ip, user_agent=ua,
    )

    try:
        db.commit()
    except SQLAlchemyError:
        db.rollback()
        log.exception("Error DB al confirmar solicitud %s", solicitud_id)
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "Error interno de base de datos")

    db.refresh(solicitud)
    out = _solicitud_admin_out(db, solicitud)
    return SolicitudConfirmarOut(
        **out.model_dump(),
        folio_reserva=reserva.folio,
        sesion_id=sesion.id,
    )


@router.post("/admin/solicitudes/{solicitud_id}/rechazar", response_model=SolicitudAdminOut)
def rechazar_solicitud_admin(
    payload: SolicitudRechazarIn,
    solicitud_id: int = Path(..., gt=0),
    db: Session = Depends(get_db),
    tenant: Tenant = Depends(get_current_tenant),
    staff: UsuarioTenant = Depends(requiere_staff),
):
    solicitud = db.execute(
        select(SolicitudReserva)
        .where(
            SolicitudReserva.tenant_id == tenant.id,
            SolicitudReserva.id == solicitud_id,
        )
        .with_for_update()
    ).scalar_one_or_none()
    if solicitud is None:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND,
            {"codigo": "solicitud_no_encontrada", "mensaje": "Solicitud no encontrada"},
        )

    if solicitud.estado != EstadoSolicitud.PENDIENTE:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            {"codigo": "solicitud_no_pendiente",
             "mensaje": "La solicitud ya fue resuelta"},
        )

    solicitud.estado = EstadoSolicitud.RECHAZADA
    solicitud.motivo_rechazo = payload.motivo
    solicitud.resuelto_por_id = staff.usuario_id
    solicitud.resuelto_en = utcnow()

    svc.registrar_bitacora(
        db, tenant.id, "solicitud_reserva", solicitud.id, "solicitud_reserva_rechazada",
        usuario_id=staff.usuario_id,
        detalles={
            "motivo_rechazo": payload.motivo,
        },
    )

    try:
        db.commit()
    except SQLAlchemyError:
        db.rollback()
        log.exception("Error DB al rechazar solicitud %s", solicitud_id)
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "Error interno de base de datos")

    db.refresh(solicitud)
    return _solicitud_admin_out(db, solicitud)


# ============================================================
# ADMIN — GESTIÓN DE SERVICIOS
# ============================================================
def _servicio_admin_out(s: Servicio) -> ServicioAdminOut:
    return ServicioAdminOut.model_validate(s)


@router.get("/admin/servicios", response_model=List[ServicioAdminOut])
def listar_servicios_admin(
    activo: Optional[bool] = Query(None, description="Filtrar por estado activo"),
    db: Session = Depends(get_db),
    tenant: Tenant = Depends(get_current_tenant),
    _: UsuarioTenant = Depends(requiere_admin),
):
    cond = [Servicio.tenant_id == tenant.id]
    if activo is not None:
        cond.append(Servicio.activo.is_(activo))

    filas = db.execute(
        select(Servicio).where(*cond).order_by(Servicio.creado_en.desc())
    ).scalars().all()
    return [_servicio_admin_out(s) for s in filas]


@router.post("/admin/servicios", response_model=ServicioAdminOut, status_code=status.HTTP_201_CREATED)
def crear_servicio_admin(
    body: ServicioAdminIn,
    db: Session = Depends(get_db),
    tenant: Tenant = Depends(get_current_tenant),
    _: UsuarioTenant = Depends(requiere_admin),
):
    s = Servicio(
        tenant_id=tenant.id,
        nombre=body.nombre,
        descripcion=body.descripcion,
        categoria=body.categoria,
        color=body.color,
        slug=body.slug,
        tipo_agenda=TipoAgenda(body.tipo_agenda.value),
        modalidad=Modalidad(body.modalidad.value),
        duracion_minutos=body.duracion_minutos,
        buffer_antes_min=body.buffer_antes_min,
        buffer_despues_min=body.buffer_despues_min,
        cupo_minimo=body.cupo_minimo,
        cupo_maximo=body.cupo_maximo,
        precio=body.precio,
        moneda=body.moneda,
        pago_requerido=body.pago_requerido,
        visible_web=body.visible_web,
        requiere_confirmacion=body.requiere_confirmacion,
    )
    db.add(s)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "Ya existe un servicio con ese slug")
    db.refresh(s)
    return _servicio_admin_out(s)


@router.patch("/admin/servicios/{servicio_id}", response_model=ServicioAdminOut)
def actualizar_servicio_admin(
    servicio_id: int = Path(..., gt=0),
    body: ServicioAdminUpdate = Body(...),
    db: Session = Depends(get_db),
    tenant: Tenant = Depends(get_current_tenant),
    _: UsuarioTenant = Depends(requiere_admin),
):
    s = db.execute(
        select(Servicio).where(Servicio.id == servicio_id, Servicio.tenant_id == tenant.id)
    ).scalar_one_or_none()
    if s is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Servicio no encontrado")

    cambios = body.model_dump(exclude_unset=True)
    if not cambios:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "No se enviaron campos para actualizar")

    if "tipo_agenda" in cambios:
        cambios["tipo_agenda"] = TipoAgenda(cambios["tipo_agenda"].value)
    if "modalidad" in cambios:
        cambios["modalidad"] = Modalidad(cambios["modalidad"].value)

    for campo, valor in cambios.items():
        setattr(s, campo, valor)

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "Ya existe un servicio con ese slug")
    db.refresh(s)
    return _servicio_admin_out(s)


@router.post("/admin/servicios/{servicio_id}/activar", response_model=OperacionOut)
def activar_servicio_admin(
    servicio_id: int = Path(..., gt=0),
    db: Session = Depends(get_db),
    tenant: Tenant = Depends(get_current_tenant),
    _: UsuarioTenant = Depends(requiere_admin),
):
    s = db.execute(
        select(Servicio).where(Servicio.id == servicio_id, Servicio.tenant_id == tenant.id)
    ).scalar_one_or_none()
    if s is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Servicio no encontrado")

    s.activo = True
    db.commit()
    return OperacionOut(ok=True, mensaje="Servicio activado", detalle={"id": servicio_id})


@router.delete("/admin/servicios/{servicio_id}", response_model=OperacionOut)
def desactivar_servicio_admin(
    servicio_id: int = Path(..., gt=0),
    db: Session = Depends(get_db),
    tenant: Tenant = Depends(get_current_tenant),
    _: UsuarioTenant = Depends(requiere_admin),
):
    s = db.execute(
        select(Servicio).where(Servicio.id == servicio_id, Servicio.tenant_id == tenant.id)
    ).scalar_one_or_none()
    if s is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Servicio no encontrado")

    s.activo = False
    db.commit()
    return OperacionOut(ok=True, mensaje="Servicio desactivado", detalle={"id": servicio_id})


# ============================================================
# GESTIÓN DE USUARIOS DEL TENANT
# ============================================================
_ROLES_VINCULABLES = {
    "cliente": RolUsuario.CLIENTE,
    "asesor": RolUsuario.ASESOR,
    "admin": RolUsuario.ADMIN,
}


def _usuario_admin_out(ut: UsuarioTenant) -> UsuarioAdminOut:
    return UsuarioAdminOut(
        id=ut.id,
        usuario_id=ut.usuario_id,
        email=ut.usuario.email,
        nombre=ut.usuario.nombre,
        apellido=ut.usuario.apellido,
        telefono=ut.usuario.telefono,
        rol=ut.rol.value,
        activo=ut.activo,
        fecha_vinculacion=ut.fecha_vinculacion,
    )


def _usuario_tenant_admin(db: Session, tenant_id: int, ut_id: int) -> Optional[UsuarioTenant]:
    return db.execute(
        select(UsuarioTenant)
        .where(UsuarioTenant.id == ut_id, UsuarioTenant.tenant_id == tenant_id)
        .options(joinedload(UsuarioTenant.usuario))
    ).scalar_one_or_none()


@router.get("/admin/usuarios", response_model=List[UsuarioAdminOut])
def listar_usuarios_admin(
    db: Session = Depends(get_db),
    tenant: Tenant = Depends(get_current_tenant),
    _: UsuarioTenant = Depends(requiere_admin),
):
    filas = db.execute(
        select(UsuarioTenant)
        .where(UsuarioTenant.tenant_id == tenant.id)
        .options(joinedload(UsuarioTenant.usuario))
    ).scalars().all()
    filas = sorted(filas, key=lambda ut: (not ut.activo, (ut.usuario.nombre or "").lower()))
    return [_usuario_admin_out(ut) for ut in filas]


@router.post("/admin/usuarios/invitar", response_model=UsuarioAdminOut, status_code=status.HTTP_201_CREATED)
def invitar_usuario(
    email: str = Body(...),
    nombre: str = Body(...),
    rol: str = Body(...),
    password: Optional[str] = Body(None, min_length=8),
    db: Session = Depends(get_db),
    tenant: Tenant = Depends(get_current_tenant),
    staff: UsuarioTenant = Depends(requiere_admin),
):
    if rol not in _ROLES_VINCULABLES:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Rol inválido")

    email_norm = email.strip().lower()
    if not email_norm or not nombre.strip():
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Email y nombre son obligatorios")

    password_hash = None
    if password:
        password_hash = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

    usuario = db.execute(select(Usuario).where(Usuario.email == email_norm)).scalar_one_or_none()
    if usuario is None:
        usuario = Usuario(
            email=email_norm,
            nombre=nombre.strip(),
            es_invitado=not password_hash,
            password_hash=password_hash,
        )
        db.add(usuario)
        db.flush()
    else:
        ya_vinculado = db.execute(
            select(UsuarioTenant).where(
                UsuarioTenant.tenant_id == tenant.id,
                UsuarioTenant.usuario_id == usuario.id,
            )
        ).scalar_one_or_none()
        if ya_vinculado is not None:
            raise HTTPException(status.HTTP_409_CONFLICT, "El usuario ya está vinculado a este tenant")
        if password_hash:
            if usuario.password_hash is not None:
                raise HTTPException(
                    status.HTTP_422_UNPROCESSABLE_ENTITY,
                    "El usuario ya tiene una contraseña definida",
                )
            usuario.password_hash = password_hash
            usuario.es_invitado = False

    ut = UsuarioTenant(tenant_id=tenant.id, usuario_id=usuario.id, rol=_ROLES_VINCULABLES[rol], activo=True)
    db.add(ut)
    db.flush()

    svc.registrar_bitacora(
        db, tenant.id, "usuario_tenant", ut.id, "invitar",
        usuario_id=staff.usuario_id,
        detalles={"email": email_norm, "rol": rol, "password_set": bool(password_hash)},
    )

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "El usuario ya está vinculado a este tenant")

    ut = _usuario_tenant_admin(db, tenant.id, ut.id)
    return _usuario_admin_out(ut)


def _admins_activos_restantes(db: Session, tenant_id: int, excluir_ut_id: int) -> int:
    """Cuenta admins activos del tenant sin contar a `excluir_ut_id`.

    Se usa para bloquear operaciones que dejarían el tenant sin ningún admin.
    """
    return db.execute(
        select(func.count()).select_from(UsuarioTenant).where(
            UsuarioTenant.tenant_id == tenant_id,
            UsuarioTenant.rol == RolUsuario.ADMIN,
            UsuarioTenant.activo.is_(True),
            UsuarioTenant.id != excluir_ut_id,
        )
    ).scalar_one()


@router.patch("/admin/usuarios/{ut_id}/rol", response_model=UsuarioAdminOut)
def cambiar_rol_usuario(
    ut_id: int = Path(..., gt=0),
    rol: str = Body(..., embed=True),
    db: Session = Depends(get_db),
    tenant: Tenant = Depends(get_current_tenant),
    staff: UsuarioTenant = Depends(requiere_admin),
):
    if rol not in _ROLES_VINCULABLES:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Rol inválido")

    ut = _usuario_tenant_admin(db, tenant.id, ut_id)
    if ut is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Usuario no encontrado")
    if ut.rol == RolUsuario.SUPERADMIN:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "No se puede cambiar el rol de un superadmin")

    rol_nuevo = _ROLES_VINCULABLES[rol]
    if ut.rol == RolUsuario.ADMIN and rol_nuevo != RolUsuario.ADMIN:
        if _admins_activos_restantes(db, tenant.id, ut.id) == 0:
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                "No puedes quitar el rol de admin al único admin activo del tenant",
            )

    rol_anterior = ut.rol.value
    ut.rol = rol_nuevo

    svc.registrar_bitacora(
        db, tenant.id, "usuario_tenant", ut.id, "cambiar_rol",
        usuario_id=staff.usuario_id,
        detalles={"ut_id": ut_id, "rol_anterior": rol_anterior, "rol_nuevo": rol_nuevo.value},
    )

    db.commit()
    return _usuario_admin_out(ut)


@router.delete("/admin/usuarios/{ut_id}", response_model=OperacionOut)
def desvincular_usuario(
    ut_id: int = Path(..., gt=0),
    db: Session = Depends(get_db),
    tenant: Tenant = Depends(get_current_tenant),
    staff: UsuarioTenant = Depends(requiere_admin),
):
    ut = _usuario_tenant_admin(db, tenant.id, ut_id)
    if ut is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Usuario no encontrado")

    if ut.rol == RolUsuario.ADMIN and _admins_activos_restantes(db, tenant.id, ut.id) == 0:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "No puedes desvincular al único admin activo del tenant",
        )

    ut.activo = False
    ut.desvinculado_en = datetime.now(timezone.utc)

    svc.registrar_bitacora(
        db, tenant.id, "usuario_tenant", ut.id, "desvincular",
        usuario_id=staff.usuario_id,
        detalles={"ut_id": ut_id, "rol": ut.rol.value},
    )

    db.commit()
    return OperacionOut(ok=True, mensaje="Usuario desvinculado", detalle={"ut_id": ut_id})


# ============================================================
# HORARIOS Y SERVICIOS DEL ASESOR
# ============================================================
def _asesor_admin(db: Session, tenant_id: int, ut_id: int) -> UsuarioTenant:
    ut = _usuario_tenant_admin(db, tenant_id, ut_id)
    if ut is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Usuario no encontrado")
    if ut.rol != RolUsuario.ASESOR:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "El usuario no es un asesor")
    return ut


def _servicio_admin(db: Session, tenant_id: int, servicio_id: int) -> Servicio:
    s = db.execute(
        select(Servicio).where(Servicio.id == servicio_id, Servicio.tenant_id == tenant_id)
    ).scalar_one_or_none()
    if s is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Servicio no encontrado")
    return s


@router.get("/admin/asesores/{ut_id}/horarios", response_model=List[HorarioAsesorOut])
def listar_horarios_asesor(
    ut_id: int = Path(..., gt=0),
    db: Session = Depends(get_db),
    tenant: Tenant = Depends(get_current_tenant),
    _: UsuarioTenant = Depends(requiere_admin),
):
    _asesor_admin(db, tenant.id, ut_id)
    filas = db.execute(
        select(HorarioDisponibilidad).where(
            HorarioDisponibilidad.tenant_id == tenant.id,
            HorarioDisponibilidad.entidad_tipo == "asesor",
            HorarioDisponibilidad.entidad_id == ut_id,
        )
    ).scalars().all()
    filas = sorted(filas, key=lambda h: (h.dia_semana, h.hora_inicio))
    return [HorarioAsesorOut.model_validate(h) for h in filas]


@router.post(
    "/admin/asesores/{ut_id}/horarios",
    response_model=HorarioAsesorOut,
    status_code=status.HTTP_201_CREATED,
)
def crear_horario_asesor(
    ut_id: int = Path(..., gt=0),
    dia_semana: int = Body(...),
    hora_inicio: time = Body(...),
    hora_fin: time = Body(...),
    db: Session = Depends(get_db),
    tenant: Tenant = Depends(get_current_tenant),
    staff: UsuarioTenant = Depends(requiere_admin),
):
    _asesor_admin(db, tenant.id, ut_id)
    if not 0 <= dia_semana <= 6:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "dia_semana debe estar entre 0 y 6")
    if hora_fin <= hora_inicio:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "hora_fin debe ser mayor a hora_inicio")

    h = HorarioDisponibilidad(
        tenant_id=tenant.id,
        entidad_tipo="asesor",
        entidad_id=ut_id,
        dia_semana=dia_semana,
        hora_inicio=hora_inicio,
        hora_fin=hora_fin,
        activo=True,
    )
    db.add(h)
    db.flush()

    svc.registrar_bitacora(
        db, tenant.id, "horario_disponibilidad", h.id, "crear",
        usuario_id=staff.usuario_id,
        detalles={"ut_id": ut_id, "dia_semana": dia_semana, "hora_inicio": str(hora_inicio), "hora_fin": str(hora_fin)},
    )

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "El horario no es válido")
    db.refresh(h)
    return HorarioAsesorOut.model_validate(h)


@router.delete("/admin/asesores/{ut_id}/horarios/{h_id}", response_model=OperacionOut)
def eliminar_horario_asesor(
    ut_id: int = Path(..., gt=0),
    h_id: int = Path(..., gt=0),
    db: Session = Depends(get_db),
    tenant: Tenant = Depends(get_current_tenant),
    staff: UsuarioTenant = Depends(requiere_admin),
):
    _asesor_admin(db, tenant.id, ut_id)
    h = db.execute(
        select(HorarioDisponibilidad).where(
            HorarioDisponibilidad.id == h_id,
            HorarioDisponibilidad.tenant_id == tenant.id,
            HorarioDisponibilidad.entidad_tipo == "asesor",
            HorarioDisponibilidad.entidad_id == ut_id,
        )
    ).scalar_one_or_none()
    if h is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Horario no encontrado")

    svc.registrar_bitacora(
        db, tenant.id, "horario_disponibilidad", h.id, "eliminar",
        usuario_id=staff.usuario_id,
        detalles={"ut_id": ut_id, "h_id": h_id},
    )

    db.delete(h)
    db.commit()
    return OperacionOut(ok=True, mensaje="Horario eliminado", detalle={"h_id": h_id})


# ============================================================
# HORARIOS DEL SERVICIO (confirmación manual)
# ============================================================
# La franja general de un servicio con requiere_confirmacion=True define la
# ventana de propuesta del cliente (el calendario público genera sus slots
# desde aquí, con asesor=None). La disponibilidad REAL del asesor se valida
# al asignarlo en POST /admin/reservas/{reserva_id}/asignar-asesor.
# Solo aplica a servicios con confirmación manual: en el flujo automático
# la disponibilidad sale del horario de cada asesor, no de aquí.


@router.get("/admin/servicios/{servicio_id}/horarios", response_model=List[HorarioAsesorOut])
def listar_horarios_servicio(
    servicio_id: int = Path(..., gt=0),
    db: Session = Depends(get_db),
    tenant: Tenant = Depends(get_current_tenant),
    _: UsuarioTenant = Depends(requiere_admin),
):
    _servicio_admin(db, tenant.id, servicio_id)
    filas = db.execute(
        select(HorarioDisponibilidad).where(
            HorarioDisponibilidad.tenant_id == tenant.id,
            HorarioDisponibilidad.entidad_tipo == "servicio",
            HorarioDisponibilidad.entidad_id == servicio_id,
        )
    ).scalars().all()
    filas = sorted(filas, key=lambda h: (h.dia_semana, h.hora_inicio))
    return [HorarioAsesorOut.model_validate(h) for h in filas]


@router.post(
    "/admin/servicios/{servicio_id}/horarios",
    response_model=HorarioAsesorOut,
    status_code=status.HTTP_201_CREATED,
)
def crear_horario_servicio(
    servicio_id: int = Path(..., gt=0),
    dia_semana: int = Body(...),
    hora_inicio: time = Body(...),
    hora_fin: time = Body(...),
    db: Session = Depends(get_db),
    tenant: Tenant = Depends(get_current_tenant),
    staff: UsuarioTenant = Depends(requiere_admin),
):
    """Define la franja general del servicio (ventana de propuesta del cliente).

    Solo aplica a servicios con requiere_confirmacion=True: el cliente
    propone un horario dentro de esta franja y el staff valida la
    disponibilidad real del asesor al asignarlo. Para servicios con
    confirmación automática NO aplica: su disponibilidad sale del horario
    de cada asesor vinculado. Se responde 422 si el servicio no es de
    confirmación manual.
    """
    servicio = _servicio_admin(db, tenant.id, servicio_id)
    if not servicio.requiere_confirmacion:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "El horario de servicio solo aplica a servicios con requiere_confirmacion=True",
        )
    if not 0 <= dia_semana <= 6:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "dia_semana debe estar entre 0 y 6")
    if hora_fin <= hora_inicio:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "hora_fin debe ser mayor a hora_inicio")

    h = HorarioDisponibilidad(
        tenant_id=tenant.id,
        entidad_tipo="servicio",
        entidad_id=servicio_id,
        dia_semana=dia_semana,
        hora_inicio=hora_inicio,
        hora_fin=hora_fin,
        activo=True,
    )
    db.add(h)
    db.flush()

    svc.registrar_bitacora(
        db, tenant.id, "horario_disponibilidad", h.id, "crear",
        usuario_id=staff.usuario_id,
        detalles={"servicio_id": servicio_id, "dia_semana": dia_semana, "hora_inicio": str(hora_inicio), "hora_fin": str(hora_fin)},
    )

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "El horario no es válido")
    db.refresh(h)
    return HorarioAsesorOut.model_validate(h)


@router.delete("/admin/servicios/{servicio_id}/horarios/{h_id}", response_model=OperacionOut)
def eliminar_horario_servicio(
    servicio_id: int = Path(..., gt=0),
    h_id: int = Path(..., gt=0),
    db: Session = Depends(get_db),
    tenant: Tenant = Depends(get_current_tenant),
    staff: UsuarioTenant = Depends(requiere_admin),
):
    _servicio_admin(db, tenant.id, servicio_id)
    h = db.execute(
        select(HorarioDisponibilidad).where(
            HorarioDisponibilidad.id == h_id,
            HorarioDisponibilidad.tenant_id == tenant.id,
            HorarioDisponibilidad.entidad_tipo == "servicio",
            HorarioDisponibilidad.entidad_id == servicio_id,
        )
    ).scalar_one_or_none()
    if h is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Horario no encontrado")

    svc.registrar_bitacora(
        db, tenant.id, "horario_disponibilidad", h.id, "eliminar",
        usuario_id=staff.usuario_id,
        detalles={"servicio_id": servicio_id, "h_id": h_id},
    )

    db.delete(h)
    db.commit()
    return OperacionOut(ok=True, mensaje="Horario eliminado", detalle={"h_id": h_id})


@router.get("/admin/asesores/{ut_id}/servicios", response_model=List[AsesorServicioOut])
def listar_servicios_asesor(
    ut_id: int = Path(..., gt=0),
    db: Session = Depends(get_db),
    tenant: Tenant = Depends(get_current_tenant),
    _: UsuarioTenant = Depends(requiere_admin),
):
    _asesor_admin(db, tenant.id, ut_id)
    filas = db.execute(
        select(AsesorServicio)
        .where(AsesorServicio.usuario_tenant_id == ut_id)
        .options(joinedload(AsesorServicio.servicio))
    ).scalars().all()
    return [
        AsesorServicioOut(
            id=a.id,
            usuario_tenant_id=a.usuario_tenant_id,
            servicio_id=a.servicio_id,
            servicio_nombre=a.servicio.nombre,
            precio_custom=a.precio_custom,
            duracion_custom_min=a.duracion_custom_min,
            activo=a.activo,
        )
        for a in filas
    ]


@router.post(
    "/admin/asesores/{ut_id}/servicios",
    response_model=AsesorServicioOut,
    status_code=status.HTTP_201_CREATED,
)
def asignar_servicio_asesor(
    ut_id: int = Path(..., gt=0),
    servicio_id: int = Body(...),
    precio_custom: Optional[Decimal] = Body(None),
    duracion_custom_min: Optional[int] = Body(None),
    db: Session = Depends(get_db),
    tenant: Tenant = Depends(get_current_tenant),
    staff: UsuarioTenant = Depends(requiere_admin),
):
    _asesor_admin(db, tenant.id, ut_id)
    servicio = db.execute(
        select(Servicio).where(Servicio.id == servicio_id, Servicio.tenant_id == tenant.id)
    ).scalar_one_or_none()
    if servicio is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Servicio no encontrado")

    a = AsesorServicio(
        usuario_tenant_id=ut_id,
        servicio_id=servicio_id,
        precio_custom=precio_custom,
        duracion_custom_min=duracion_custom_min,
        activo=True,
    )
    db.add(a)
    db.flush()

    svc.registrar_bitacora(
        db, tenant.id, "asesor_servicio", a.id, "asignar",
        usuario_id=staff.usuario_id,
        detalles={"ut_id": ut_id, "servicio_id": servicio_id},
    )

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "El asesor ya tiene asignado este servicio")
    db.refresh(a)
    return AsesorServicioOut(
        id=a.id,
        usuario_tenant_id=a.usuario_tenant_id,
        servicio_id=a.servicio_id,
        servicio_nombre=servicio.nombre,
        precio_custom=a.precio_custom,
        duracion_custom_min=a.duracion_custom_min,
        activo=a.activo,
    )


@router.delete("/admin/asesores/{ut_id}/servicios/{s_id}", response_model=OperacionOut)
def desasignar_servicio_asesor(
    ut_id: int = Path(..., gt=0),
    s_id: int = Path(..., gt=0),
    db: Session = Depends(get_db),
    tenant: Tenant = Depends(get_current_tenant),
    staff: UsuarioTenant = Depends(requiere_admin),
):
    _asesor_admin(db, tenant.id, ut_id)
    a = db.execute(
        select(AsesorServicio).where(
            AsesorServicio.id == s_id,
            AsesorServicio.usuario_tenant_id == ut_id,
        )
    ).scalar_one_or_none()
    if a is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Asignación no encontrada")

    svc.registrar_bitacora(
        db, tenant.id, "asesor_servicio", a.id, "desasignar",
        usuario_id=staff.usuario_id,
        detalles={"ut_id": ut_id, "s_id": s_id, "servicio_id": a.servicio_id},
    )

    db.delete(a)
    db.commit()
    return OperacionOut(ok=True, mensaje="Servicio desasignado", detalle={"s_id": s_id})


# ============================================================
# BLOQUEOS
# ============================================================
_ENTIDADES_BLOQUEO = {"asesor", "recurso", "sede", "global"}


@router.get("/admin/bloqueos", response_model=List[BloqueoOut])
def listar_bloqueos_admin(
    asesor_id: Optional[int] = Query(None, gt=0),
    db: Session = Depends(get_db),
    tenant: Tenant = Depends(get_current_tenant),
    _: UsuarioTenant = Depends(requiere_admin),
):
    cond = [HorarioBloqueo.tenant_id == tenant.id]
    if asesor_id is not None:
        cond.append(HorarioBloqueo.entidad_tipo == "asesor")
        cond.append(HorarioBloqueo.entidad_id == asesor_id)
    filas = db.execute(select(HorarioBloqueo).where(*cond)).scalars().all()
    filas = sorted(filas, key=lambda b: b.fecha_inicio, reverse=True)
    return [BloqueoOut.model_validate(b) for b in filas]


@router.post("/admin/bloqueos", response_model=BloqueoOut, status_code=status.HTTP_201_CREATED)
def crear_bloqueo_admin(
    body: BloqueoCreate,
    db: Session = Depends(get_db),
    tenant: Tenant = Depends(get_current_tenant),
    staff: UsuarioTenant = Depends(requiere_admin),
):
    if body.entidad_tipo not in _ENTIDADES_BLOQUEO:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "entidad_tipo inválido")
    if body.entidad_tipo == "asesor":
        _asesor_admin(db, tenant.id, body.entidad_id)

    b = HorarioBloqueo(
        tenant_id=tenant.id,
        entidad_tipo=body.entidad_tipo,
        entidad_id=body.entidad_id,
        fecha_inicio=body.fecha_inicio,
        fecha_fin=body.fecha_fin,
        motivo=body.motivo,
        tipo=TipoBloqueo(body.tipo.value),
    )
    db.add(b)
    db.flush()

    svc.registrar_bitacora(
        db, tenant.id, "horario_bloqueo", b.id, "crear",
        usuario_id=staff.usuario_id,
        detalles={
            "entidad_tipo": body.entidad_tipo,
            "entidad_id": body.entidad_id,
            "fecha_inicio": body.fecha_inicio.isoformat(),
            "fecha_fin": body.fecha_fin.isoformat(),
        },
    )

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "El bloqueo no es válido")
    db.refresh(b)
    return BloqueoOut.model_validate(b)


@router.delete("/admin/bloqueos/{b_id}", response_model=OperacionOut)
def eliminar_bloqueo_admin(
    b_id: int = Path(..., gt=0),
    db: Session = Depends(get_db),
    tenant: Tenant = Depends(get_current_tenant),
    staff: UsuarioTenant = Depends(requiere_admin),
):
    b = db.execute(
        select(HorarioBloqueo).where(
            HorarioBloqueo.id == b_id,
            HorarioBloqueo.tenant_id == tenant.id,
        )
    ).scalar_one_or_none()
    if b is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Bloqueo no encontrado")

    svc.registrar_bitacora(
        db, tenant.id, "horario_bloqueo", b.id, "eliminar",
        usuario_id=staff.usuario_id,
        detalles={"b_id": b_id, "entidad_tipo": b.entidad_tipo, "entidad_id": b.entidad_id},
    )

    db.delete(b)
    db.commit()
    return OperacionOut(ok=True, mensaje="Bloqueo eliminado", detalle={"b_id": b_id})



# ============================================================
# CHECK-IN — NUEVO
# ============================================================
@router.post("/reservas/{folio}/checkin", response_model=OperacionOut)
def checkin_reserva(
    folio: str = Path(..., min_length=8, max_length=32),
    db: Session = Depends(get_db),
    tenant: Tenant = Depends(get_current_tenant),
    usuario: Usuario = Depends(get_current_user),
):
    r = db.execute(
        select(Reserva).where(Reserva.tenant_id == tenant.id, Reserva.folio == folio)
    ).scalar_one_or_none()

    if r is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Reserva no encontrada")

    if not _es_staff(db, tenant.id, usuario.id):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Requiere permisos de personal")

    if r.estado != EstadoReserva.CONFIRMADA:
        raise HTTPException(status.HTTP_409_CONFLICT, "Solo reservas confirmadas pueden hacer check-in")

    r.estado = EstadoReserva.COMPLETADA

    svc.registrar_bitacora(
        db, tenant.id, "reserva", r.id, "checkin",
        usuario_id=usuario.id,
        detalles={"folio": folio},
    )

    db.commit()
    return OperacionOut(ok=True, mensaje="Check-in registrado", detalle={"folio": folio})


# ============================================================
# CANCELAR
# ============================================================
@router.post("/reservas/{folio}/cancelar", response_model=OperacionOut)
def cancelar_reserva_endpoint(
    payload: CancelarReservaIn,
    folio: str = Path(..., min_length=8, max_length=32),
    db: Session = Depends(get_db),
    tenant: Tenant = Depends(get_current_tenant),
    usuario: Usuario = Depends(get_current_user),
):
    r = db.execute(
        select(Reserva).where(Reserva.tenant_id == tenant.id, Reserva.folio == folio)
    ).scalar_one_or_none()

    es_staff = _es_staff(db, tenant.id, usuario.id)
    if r is None or (
        not _es_propietario_reserva(db, tenant.id, r, usuario.id) and not es_staff
    ):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Reserva no encontrada")

    try:
        svc.cancelar_reserva(db, tenant, r, usuario.id, payload.motivo, forzar=es_staff)
        db.commit()
    except ReservaError as e:
        db.rollback()
        raise _http_de(e)
    except SQLAlchemyError:
        db.rollback()
        log.exception("Error DB al cancelar reserva %s", folio)
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "Error interno de base de datos")
    except Exception:
        db.rollback()
        raise

    return OperacionOut(ok=True, mensaje="Reserva cancelada", detalle={"folio": folio})


# ============================================================
# REAGENDAR — solo personal
# ============================================================
@router.post("/sesiones/{sesion_id}/reagendar", response_model=SesionListOut)
def reagendar_sesion_endpoint(
    payload: ReagendarSesionIn,
    sesion_id: int = Path(..., gt=0),
    db: Session = Depends(get_db),
    tenant: Tenant = Depends(get_current_tenant),
    staff: UsuarioTenant = Depends(requiere_staff),
):
    if not tenant.permitir_reagendar:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "El reagendamiento está deshabilitado")

    try:
        sesion = svc.reagendar_sesion(
            db, tenant, sesion_id,
            payload.nueva_fecha_hora_inicio,
            reagendado_por_usuario_id=staff.usuario_id,
            nuevo_asesor_id=payload.nuevo_asesor_id,
            nueva_sede_id=payload.nueva_sede_id,
            motivo=payload.motivo,
        )
        db.commit()
    except ReservaError as e:
        db.rollback()
        raise _http_de(e)
    except StaleDataError:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "La sesión fue modificada por otro usuario")
    except SQLAlchemyError:
        db.rollback()
        log.exception("Error DB al reagendar sesión %s", sesion_id)
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "Error interno de base de datos")
    except Exception:
        db.rollback()
        raise

    db.refresh(sesion)
    if sesion.asesor_id is not None:
        try:
            svc.sincronizar_calendario(tenant, sesion)
        except Exception:
            log.exception("Fallo al sincronizar calendario tras reagendar %s", sesion_id)

    return _sesion_list_out(sesion)


# ============================================================
# COMPLETAR SESIÓN — NUEVO
# ============================================================
@router.post("/sesiones/{sesion_id}/completar", response_model=OperacionOut)
def completar_sesion_endpoint(
    sesion_id: int = Path(..., gt=0),
    db: Session = Depends(get_db),
    tenant: Tenant = Depends(get_current_tenant),
    staff: UsuarioTenant = Depends(requiere_staff),
):
    sesion = svc._bloquear_sesion(db, tenant.id, sesion_id)
    if sesion is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Sesión no encontrada")
    if sesion.estado not in (EstadoSesion.CONFIRMADA, EstadoSesion.LLENA):
        raise HTTPException(status.HTTP_409_CONFLICT, "La sesión no está en estado completable")

    sesion.estado = EstadoSesion.COMPLETADA

    reservas = db.execute(
        select(Reserva).where(
            Reserva.sesion_id == sesion.id,
            Reserva.estado == EstadoReserva.CONFIRMADA,
        )
    ).scalars().all()

    completadas = 0
    no_shows = 0
    for r in reservas:
        if r.checked_in:
            r.estado = EstadoReserva.COMPLETADA
            completadas += 1
        else:
            r.estado = EstadoReserva.NO_SHOW
            no_shows += 1

    db.commit()

    svc.registrar_bitacora(
        db, tenant.id, "sesion", sesion.id, "completar",
        usuario_id=staff.usuario_id,
        detalles={"completadas": completadas, "no_shows": no_shows},
    )

    return OperacionOut(
        ok=True,
        mensaje="Sesión completada",
        detalle={"completadas": completadas, "no_shows": no_shows},
    )


# ============================================================
# SUPERADMIN — GESTIÓN DE TENANTS (sin {tenant_slug} en la ruta)
# ============================================================
superadmin_router = APIRouter(prefix="/api/v2/superadmin", tags=["Superadmin"])


def _tenant_admin_out(t: Tenant, total_usuarios: int = 0) -> TenantAdminOut:
    smtp = t.smtp_config if isinstance(t.smtp_config, dict) else {}
    smtp_salida = None
    if smtp:
        smtp_salida = {
            "host": smtp.get("host"),
            "port": smtp.get("port") or 587,
            "user": smtp.get("user"),
            "from_email": smtp.get("from_email"),
            "from_name": smtp.get("from_name"),
            "tls": smtp.get("tls", True),
            "ssl": smtp.get("ssl", False),
            "console": smtp.get("console", False),
        }
    return TenantAdminOut(
        id=t.id,
        slug=t.slug,
        nombre=t.nombre,
        activo=t.activo,
        plan=t.plan.value if hasattr(t.plan, "value") else t.plan,
        timezone=t.timezone,
        moneda=t.moneda,
        max_asesores=t.max_asesores,
        max_servicios=t.max_servicios,
        max_clientes=t.max_clientes,
        max_reservas_mes=t.max_reservas_mes,
        creado_en=t.creado_en,
        total_usuarios=total_usuarios,
        smtp_configurado=bool(smtp.get("host")),
        smtp_config=smtp_salida,
    )


@superadmin_router.get("/tenants", response_model=List[TenantAdminOut])
def listar_tenants(
    activo: Optional[bool] = Query(None, description="Filtrar por estado activo"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    _: UsuarioTenant = Depends(requiere_superadmin),
):
    cond = []
    if activo is not None:
        cond.append(Tenant.activo.is_(activo))

    filas = db.execute(
        select(
            Tenant,
            func.count(UsuarioTenant.id).label("total_usuarios"),
        )
        .outerjoin(UsuarioTenant, UsuarioTenant.tenant_id == Tenant.id)
        .where(*cond)
        .group_by(Tenant.id)
        .order_by(Tenant.creado_en.desc())
        .limit(limit).offset(offset)
    ).all()

    return [
        _tenant_admin_out(t, total)
        for t, total in filas
    ]


@superadmin_router.post("/tenants", response_model=TenantAdminOut, status_code=status.HTTP_201_CREATED)
def crear_tenant(
    body: TenantCreate,
    db: Session = Depends(get_db),
    _: UsuarioTenant = Depends(requiere_superadmin),
):
    existe = db.execute(
        select(Tenant).where(Tenant.slug == body.slug)
    ).scalar_one_or_none()
    if existe is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, f"Ya existe un tenant con slug '{body.slug}'")

    t = Tenant(
        slug=body.slug,
        nombre=body.nombre,
        plan=PlanTenant(body.plan),
        timezone=body.timezone,
        moneda=body.moneda,
        max_asesores=body.max_asesores,
        max_servicios=body.max_servicios,
        max_clientes=body.max_clientes,
        max_reservas_mes=body.max_reservas_mes,
    )
    db.add(t)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, f"Ya existe un tenant con slug '{body.slug}'")
    db.refresh(t)

    return _tenant_admin_out(t, 0)


@superadmin_router.patch("/tenants/{tenant_id}", response_model=TenantAdminOut)
def actualizar_tenant(
    tenant_id: int = Path(..., gt=0),
    body: TenantUpdate = Body(...),
    db: Session = Depends(get_db),
    _: UsuarioTenant = Depends(requiere_superadmin),
):
    t = db.get(Tenant, tenant_id)
    if t is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Tenant no encontrado")

    cambios = body.model_dump(exclude_unset=True)
    if not cambios:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "No se enviaron campos para actualizar")

    nuevo_slug = cambios.get("slug")
    if nuevo_slug is not None and nuevo_slug != t.slug:
        existe = db.execute(
            select(Tenant).where(Tenant.slug == nuevo_slug, Tenant.id != tenant_id)
        ).scalar_one_or_none()
        if existe is not None:
            raise HTTPException(status.HTTP_409_CONFLICT, f"Ya existe un tenant con slug '{nuevo_slug}'")

    if "plan" in cambios:
        cambios["plan"] = PlanTenant(cambios["plan"])

    if "smtp_config" in cambios:
        # smtp_config es write-only desde el frontend (el password nunca se
        # devuelve en GET/PATCH). Omitir campos en el payload (ej. "password")
        # debe conservar el valor actual, no pisarlo con vacío.
        if cambios["smtp_config"] is None:
            cambios["smtp_config"] = None
        else:
            actual = t.smtp_config if isinstance(t.smtp_config, dict) else {}
            cambios["smtp_config"] = {**actual, **cambios["smtp_config"]}

    for campo, valor in cambios.items():
        setattr(t, campo, valor)

    db.commit()
    db.refresh(t)

    return _tenant_admin_out(t)
