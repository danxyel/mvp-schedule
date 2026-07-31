"""
router_v2_2.py — FastAPI
v2.2.1: webhook Stripe, check-in, completar sesión, excepciones específicas.
"""

import logging
from datetime import date, datetime, time, timedelta, timezone
from typing import Optional, List

from fastapi import APIRouter, Body, Depends, HTTPException, Query, Path, Request, status
from sqlalchemy import select, func
from sqlalchemy.orm import Session, joinedload, selectinload
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm.exc import StaleDataError

from app.database import get_db
from app.dependencies import (
    get_current_tenant, get_current_user, get_current_user_optional,
)
from app.models_v2_2 import (
    Tenant, Usuario, UsuarioTenant, Sesion, Reserva, Servicio, Sede,
    RolUsuario, EstadoSesion, EstadoReserva, ESTADOS_SESION_ACTIVA, PlanTenant,
    TipoAgenda, Modalidad,
)
from app.schemas_v2_2 import (
    ReservaCreate, ReservaOut, ReservaCreateResponse, ReagendarSesionIn,
    CancelarReservaIn, DisponibilidadDiaOut, SlotDisponible,
    SesionListOut, SesionDetailOut, SesionAdminOut, SesionesPaginadasOut,
    PaginacionOut, CheckoutUrlOut, OperacionOut, AsesorPublicOut, SedeOut,
    ReservaAdminListOut, ReservasAdminPaginadasOut,
    TenantCreate, TenantAdminOut, TenantUpdate,
    ServicioAdminIn, ServicioAdminUpdate, ServicioAdminOut,
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
        r.creado_por_usuario_id != usuario.id and not _es_staff(db, tenant.id, usuario.id)
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
    cond = [Reserva.tenant_id == tenant.id, Reserva.creado_por_usuario_id == usuario.id]
    stmt = (
        select(Reserva)
        .join(Sesion, Sesion.id == Reserva.sesion_id)
        .options(
            joinedload(Reserva.sesion).joinedload(Sesion.sede),
            joinedload(Reserva.sesion).joinedload(Sesion.asesor).joinedload(UsuarioTenant.usuario),
            joinedload(Reserva.servicio),
        )
        .where(*cond)
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
# ADMIN — LISTADO DE RESERVAS
# ============================================================
@router.get("/admin/reservas", response_model=ReservasAdminPaginadasOut)
def listar_reservas_admin(
    fecha: Optional[date] = Query(None, description="Filtra por fecha de la sesión (default: hoy)"),
    estado: Optional[str] = Query(None, description="Filtra por estado de reserva (ej. confirmada)"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    tenant: Tenant = Depends(get_current_tenant),
    staff: UsuarioTenant = Depends(requiere_staff),
):
    if fecha is None:
        fecha = date.today()

    estado_enum = None
    if estado:
        try:
            estado_enum = EstadoReserva(estado)
        except ValueError:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY,
                f"Estado de reserva inválido: {estado}",
            )

    inicio = datetime.combine(fecha, time.min, tzinfo=timezone.utc)
    fin = inicio + timedelta(days=1)

    cond = [
        Reserva.tenant_id == tenant.id,
        Sesion.fecha_hora_inicio >= inicio,
        Sesion.fecha_hora_inicio < fin,
    ]
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
    if r is None or (r.creado_por_usuario_id != usuario.id and not es_staff):
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

    for campo, valor in cambios.items():
        setattr(t, campo, valor)

    db.commit()
    db.refresh(t)

    return _tenant_admin_out(t)
