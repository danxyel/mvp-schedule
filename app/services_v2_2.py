"""
services_v2_2.py — Lógica de negocio · PostgreSQL
v2.2.1: hash determinista, buffers en disponibilidad, respuestas_formulario,
        confirmar_pago_por_folio, excepciones específicas.
"""

import hashlib
import hmac
import html
import re
import secrets
import uuid
import random
import string
import logging
import os
import smtplib
from datetime import datetime, timedelta, timezone, date, time
from decimal import Decimal
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Optional, List, Dict, Any, Tuple
from zoneinfo import ZoneInfo

from sqlalchemy import and_, or_, func, select, update, text
from sqlalchemy.orm import Session, selectinload, joinedload
from sqlalchemy.exc import IntegrityError, SQLAlchemyError

from app.models_v2_2 import (
    Tenant, Usuario, UsuarioTenant, Sede, Servicio, Sesion, Reserva,
    SolicitudReserva, EstadoSolicitud,
    SerieReserva, InscripcionSerie, ModalidadCobro, EstadoSerie, EstadoInscripcion,
    HorarioDisponibilidad, HorarioBloqueo, Bitacora, AsesorServicio,
    CampoFormulario, RespuestaFormulario,
    EstadoSesion, EstadoReserva, EstadoPagoReserva, MetodoPago, MetodoPagoUsado,
    TipoFlujo, CreadoPorTipo, RolUsuario, TipoAgenda, Modalidad, Canal,
    ESTADOS_OCUPAN_CUPO, ESTADOS_SESION_ACTIVA, utcnow,
)
from app.schemas_v2_2 import (
    ReservaCreate, SolicitudCreate, SerieReservaCreate, InscripcionSerieCreate,
    ConfirmarInscripcionIn, ModalidadCobroEnum, MetodoPagoEnum,
    SolicitudConfirmarSerieIn, validar_modalidad_cobro, CheckoutUrlOut,
)

log = logging.getLogger(__name__)


# ============================================================
# EXCEPCIONES
# ============================================================
class ReservaError(Exception):
    def __init__(self, mensaje: str, codigo: str = "reserva_invalida"):
        self.mensaje = mensaje
        self.codigo = codigo
        super().__init__(mensaje)


class CupoAgotadoError(ReservaError):
    def __init__(self, mensaje: str = "La sesión ya no tiene lugares disponibles"):
        super().__init__(mensaje, codigo="cupo_agotado")


class FranjaOcupadaError(ReservaError):
    def __init__(self, mensaje: str = "El horario ya no está disponible"):
        super().__init__(mensaje, codigo="franja_ocupada")


class PermisoDenegadoError(ReservaError):
    def __init__(self, mensaje: str = "No tiene permiso para esta operación"):
        super().__init__(mensaje, codigo="permiso_denegado")


# ============================================================
# CANDADOS — FIX: hash determinista
# ============================================================
_LOCK_NAMESPACE_FRANJA = 4210001


def _lock_key(tenant_id: int, servicio_id: int, ts: int) -> int:
    raw = f"{tenant_id}:{servicio_id}:{ts}".encode()
    return int(hashlib.md5(raw).hexdigest(), 16) % (2 ** 31)


def _lock_franja(db: Session, tenant_id: int, servicio_id: int, inicio: datetime) -> None:
    clave = _lock_key(tenant_id, servicio_id, int(inicio.timestamp()))
    db.execute(
        text("SELECT pg_advisory_xact_lock(:ns, :clave)"),
        {"ns": _LOCK_NAMESPACE_FRANJA, "clave": clave},
    )


def _bloquear_sesion(db: Session, tenant_id: int, sesion_id: int) -> Optional[Sesion]:
    return db.execute(
        select(Sesion)
        .where(Sesion.tenant_id == tenant_id, Sesion.id == sesion_id)
        .with_for_update()
    ).scalar_one_or_none()


# ============================================================
# UTILIDADES DE TIEMPO
# ============================================================
def _a_utc(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        raise ReservaError(
            "Se recibió una fecha sin zona horaria. El sistema no infiere la zona.",
            codigo="fecha_ambigua",
        )
    return dt.astimezone(timezone.utc)


def _tz_del_contexto(tenant: Tenant, servicio: Servicio, sede: Optional[Sede]) -> str:
    if sede is not None and sede.timezone:
        return sede.timezone
    if tenant.timezone:
        return tenant.timezone
    return "America/Mexico_City"


def _dia_semana_local(dt_utc: datetime, tzname: str) -> int:
    return dt_utc.astimezone(ZoneInfo(tzname)).weekday()


def _fecha_local(dt_utc: datetime, tzname: str) -> date:
    return dt_utc.astimezone(ZoneInfo(tzname)).date()


# ============================================================
# FOLIOS Y CÓDIGOS
# ============================================================
_ALFABETO_CODIGO = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"


def generar_folio(tenant_id: int) -> str:
    marca = utcnow().strftime("%y%m%d")
    sufijo = uuid.uuid4().hex[:8].upper()
    return f"R{marca}-{sufijo}"


def generar_codigo_confirmacion() -> str:
    return "".join(random.choices(_ALFABETO_CODIGO, k=8))


# ============================================================
# BITÁCORA
# ============================================================
def registrar_bitacora(
    db: Session,
    tenant_id: int,
    entidad_tipo: str,
    entidad_id: int,
    accion: str,
    usuario_id: Optional[int] = None,
    detalles: Optional[Dict[str, Any]] = None,
    ip: Optional[str] = None,
    user_agent: Optional[str] = None,
) -> None:
    db.add(Bitacora(
        tenant_id=tenant_id,
        usuario_id=usuario_id,
        entidad_tipo=entidad_tipo,
        entidad_id=entidad_id,
        accion=accion,
        detalles_json=detalles or {},
        ip_address=ip,
        user_agent=user_agent,
    ))


# ============================================================
# TOKEN DE ACCESO — genérico, un solo uso
# Hoy solo lo usa activación de cuenta; el nombre no dice "activacion" a
# propósito para poder reusarlo el día que exista "olvidé mi contraseña".
# ============================================================
def generar_token_acceso(usuario: Usuario, horas_expira: int = 48) -> str:
    """Genera un token de un solo uso y lo asocia al usuario (solo el hash se persiste).

    Devuelve el valor en claro — es responsabilidad del caller mandarlo por
    email antes de que la sesión termine; no se puede recuperar después.
    """
    token = secrets.token_urlsafe(32)
    usuario.acceso_token_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()
    usuario.acceso_token_expira_en = utcnow() + timedelta(hours=horas_expira)
    return token


def validar_token_acceso(usuario: Optional[Usuario], token: str) -> bool:
    if usuario is None or not usuario.acceso_token_hash or not usuario.acceso_token_expira_en:
        return False
    if usuario.acceso_token_expira_en < utcnow():
        return False
    token_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()
    return hmac.compare_digest(usuario.acceso_token_hash, token_hash)


def limpiar_token_acceso(usuario: Usuario) -> None:
    usuario.acceso_token_hash = None
    usuario.acceso_token_expira_en = None


def buscar_usuario_por_token_acceso(db: Session, token: str) -> Optional[Usuario]:
    """Busca entre los usuarios con token vigente cuál corresponde a este token.

    No hay forma de indexar por el token en claro (solo se guarda el hash),
    así que se filtra primero por expiración (barato, indexable a futuro) y
    se compara el hash en memoria — el universo de usuarios con un token de
    acceso vigente en un momento dado es pequeño.
    """
    candidatos = db.execute(
        select(Usuario).where(
            Usuario.acceso_token_hash.is_not(None),
            Usuario.acceso_token_expira_en > utcnow(),
        )
    ).scalars().all()
    for usuario in candidatos:
        if validar_token_acceso(usuario, token):
            return usuario
    return None


# ============================================================
# DISPONIBILIDAD
# ============================================================
def validar_disponibilidad_franja(
    db: Session,
    tenant_id: int,
    servicio: Servicio,
    fecha_inicio: datetime,
    fecha_fin: datetime,
    asesor_id: Optional[int] = None,
    excluir_sesion_id: Optional[int] = None,
    tzname: str = "America/Mexico_City",
) -> None:
    fecha_inicio = _a_utc(fecha_inicio)
    fecha_fin = _a_utc(fecha_fin)

    if fecha_fin <= fecha_inicio:
        raise ReservaError("El rango de la sesión es inválido")
    if fecha_inicio <= utcnow():
        raise ReservaError("No se puede agendar en el pasado")

    cond_bloqueo = [
        HorarioBloqueo.tenant_id == tenant_id,
        HorarioBloqueo.fecha_inicio < fecha_fin,
        HorarioBloqueo.fecha_fin > fecha_inicio,
    ]
    filtros_entidad = [HorarioBloqueo.entidad_tipo == "global"]
    if asesor_id is not None:
        filtros_entidad.append(
            and_(HorarioBloqueo.entidad_tipo == "asesor",
                 HorarioBloqueo.entidad_id == asesor_id)
        )
    if servicio.sede_id is not None:
        filtros_entidad.append(
            and_(HorarioBloqueo.entidad_tipo == "sede",
                 HorarioBloqueo.entidad_id == servicio.sede_id)
        )
    cond_bloqueo.append(or_(*filtros_entidad))

    if db.execute(select(HorarioBloqueo.id).where(*cond_bloqueo).limit(1)).first():
        raise FranjaOcupadaError("El horario está bloqueado en la agenda")

    if asesor_id is not None:
        dia = _dia_semana_local(fecha_inicio, tzname)
        hora_ini = fecha_inicio.astimezone(ZoneInfo(tzname)).time()
        hora_fin = fecha_fin.astimezone(ZoneInfo(tzname)).time()

        dentro = db.execute(
            select(HorarioDisponibilidad.id).where(
                HorarioDisponibilidad.tenant_id == tenant_id,
                HorarioDisponibilidad.entidad_tipo == "asesor",
                HorarioDisponibilidad.entidad_id == asesor_id,
                HorarioDisponibilidad.dia_semana == dia,
                HorarioDisponibilidad.activo.is_(True),
                HorarioDisponibilidad.hora_inicio <= hora_ini,
                HorarioDisponibilidad.hora_fin >= hora_fin,
            ).limit(1)
        ).first()
        if not dentro:
            raise FranjaOcupadaError("El asesor no atiende en ese horario")

    if asesor_id is not None:
        ini_buf = fecha_inicio - timedelta(minutes=servicio.buffer_antes_min or 0)
        fin_buf = fecha_fin + timedelta(minutes=servicio.buffer_despues_min or 0)

        cond = [
            Sesion.tenant_id == tenant_id,
            Sesion.asesor_id == asesor_id,
            Sesion.estado.in_(ESTADOS_SESION_ACTIVA),
            Sesion.fecha_hora_inicio < fin_buf,
            Sesion.fecha_hora_fin > ini_buf,
        ]
        if excluir_sesion_id is not None:
            cond.append(Sesion.id != excluir_sesion_id)

        if db.execute(select(Sesion.id).where(*cond).limit(1)).first():
            raise FranjaOcupadaError("El asesor ya tiene una sesión en ese horario")


def buscar_sesion_abierta(
    db: Session,
    tenant_id: int,
    servicio_id: int,
    fecha_inicio: datetime,
    fecha_fin: datetime,
    asesor_id: Optional[int] = None,
    bloquear: bool = False,
) -> Optional[Sesion]:
    stmt = select(Sesion).where(
        Sesion.tenant_id == tenant_id,
        Sesion.servicio_id == servicio_id,
        Sesion.fecha_hora_inicio == _a_utc(fecha_inicio),
        Sesion.fecha_hora_fin == _a_utc(fecha_fin),
        Sesion.estado.in_([EstadoSesion.ABIERTA.value, EstadoSesion.CONFIRMADA.value]),
        Sesion.inscritos < Sesion.cupo_maximo,
    )
    if asesor_id is not None:
        stmt = stmt.where(Sesion.asesor_id == asesor_id)
    stmt = stmt.order_by(Sesion.id).limit(1)
    if bloquear:
        stmt = stmt.with_for_update()
    return db.execute(stmt).scalar_one_or_none()


def _asesores_del_servicio(db: Session, tenant_id: int, servicio_id: int) -> List[UsuarioTenant]:
    return list(db.execute(
        select(UsuarioTenant)
        .join(AsesorServicio, AsesorServicio.usuario_tenant_id == UsuarioTenant.id)
        .options(joinedload(UsuarioTenant.usuario))
        .where(
            UsuarioTenant.tenant_id == tenant_id,
            UsuarioTenant.activo.is_(True),
            UsuarioTenant.rol.in_([RolUsuario.ASESOR.value, RolUsuario.ADMIN.value]),
            AsesorServicio.servicio_id == servicio_id,
            AsesorServicio.activo.is_(True),
        )
        .order_by(UsuarioTenant.id)
    ).scalars().unique().all())


def asignar_asesor_disponible(
    db: Session,
    tenant_id: int,
    servicio: Servicio,
    fecha_inicio: datetime,
    fecha_fin: datetime,
    tzname: str,
    preferido_id: Optional[int] = None,
) -> Optional[int]:
    candidatos = _asesores_del_servicio(db, tenant_id, servicio.id)
    if not candidatos:
        return None

    if preferido_id is not None:
        candidatos = [a for a in candidatos if a.id == preferido_id]
        if not candidatos:
            raise ReservaError("El asesor solicitado no atiende este servicio")

    for asesor in candidatos:
        try:
            validar_disponibilidad_franja(
                db, tenant_id, servicio, fecha_inicio, fecha_fin,
                asesor_id=asesor.id, tzname=tzname,
            )
            return asesor.id
        except FranjaOcupadaError:
            continue

    raise FranjaOcupadaError("Ningún asesor tiene disponibilidad en ese horario")


# ============================================================
# SESIONES
# ============================================================
def crear_sesion(
    db: Session,
    tenant: Tenant,
    servicio: Servicio,
    fecha_inicio: datetime,
    fecha_fin: datetime,
    creado_por_usuario_id: int,
    creado_por_tipo: str = CreadoPorTipo.SISTEMA.value,
    asesor_id: Optional[int] = None,
    sede_id: Optional[int] = None,
    tzname: Optional[str] = None,
) -> Sesion:
    fecha_inicio = _a_utc(fecha_inicio)
    fecha_fin = _a_utc(fecha_fin)

    sede = None
    sede_final = sede_id or servicio.sede_id
    if sede_final:
        sede = db.get(Sede, sede_final)
        if sede is None or sede.tenant_id != tenant.id:
            raise ReservaError("Sede no válida para este tenant")

    tzname = tzname or _tz_del_contexto(tenant, servicio, sede)

    sesion = Sesion(
        tenant_id=tenant.id,
        servicio_id=servicio.id,
        sede_id=sede_final,
        asesor_id=asesor_id,
        fecha_hora_inicio=fecha_inicio,
        fecha_hora_fin=fecha_fin,
        timezone=tzname,
        cupo_minimo=servicio.cupo_minimo,
        cupo_maximo=servicio.cupo_maximo,
        inscritos=0,
        estado=EstadoSesion.ABIERTA,
        creado_por_usuario_id=creado_por_usuario_id,
        creado_por_tipo=creado_por_tipo,
        ics_uid=f"{uuid.uuid4()}@scheduler",
    )
    db.add(sesion)
    db.flush()
    return sesion


def _ocupar_lugar(db: Session, sesion_id: int, tenant_id: int) -> bool:
    resultado = db.execute(
        update(Sesion)
        .where(
            Sesion.id == sesion_id,
            Sesion.tenant_id == tenant_id,
            Sesion.inscritos < Sesion.cupo_maximo,
            Sesion.estado.in_([EstadoSesion.ABIERTA.value, EstadoSesion.CONFIRMADA.value]),
        )
        .values(inscritos=Sesion.inscritos + 1, actualizado_en=utcnow())
        .execution_options(synchronize_session=False)
    )
    return resultado.rowcount == 1


def _liberar_lugar(db: Session, sesion_id: int, tenant_id: int) -> None:
    db.execute(
        update(Sesion)
        .where(Sesion.id == sesion_id, Sesion.tenant_id == tenant_id, Sesion.inscritos > 0)
        .values(inscritos=Sesion.inscritos - 1, actualizado_en=utcnow())
        .execution_options(synchronize_session=False)
    )


def actualizar_estado_sesion(db: Session, sesion_id: int, tenant_id: int) -> None:
    sesion = _bloquear_sesion(db, tenant_id, sesion_id)
    if sesion is None or sesion.estado in (EstadoSesion.CANCELADA, EstadoSesion.COMPLETADA):
        return

    if sesion.inscritos >= sesion.cupo_maximo:
        sesion.estado = EstadoSesion.LLENA
    elif sesion.inscritos >= sesion.cupo_minimo:
        sesion.estado = EstadoSesion.CONFIRMADA
    else:
        sesion.estado = EstadoSesion.ABIERTA


def reconciliar_inscritos(db: Session, tenant_id: int, sesion_id: int) -> int:
    sesion = _bloquear_sesion(db, tenant_id, sesion_id)
    if sesion is None:
        return 0
    real = db.execute(
        select(func.count(Reserva.id)).where(
            Reserva.sesion_id == sesion_id,
            Reserva.tenant_id == tenant_id,
            Reserva.estado.in_(ESTADOS_OCUPAN_CUPO),
        )
    ).scalar_one()
    deriva = real - sesion.inscritos
    if deriva != 0:
        log.warning("Deriva de cupo en sesión %s: contador=%s real=%s",
                    sesion_id, sesion.inscritos, real)
        sesion.inscritos = real
    return deriva


# ============================================================
# LISTADO DE SLOTS — FIX: buffers incluidos en traslape
# ============================================================
def listar_slots_disponibles(
    db: Session,
    tenant: Tenant,
    servicio_id: int,
    fecha: datetime,
    asesor_id: Optional[int] = None,
) -> Dict[str, Any]:
    servicio = db.execute(
        select(Servicio)
        .options(joinedload(Servicio.sede))
        .where(
            Servicio.tenant_id == tenant.id,
            Servicio.id == servicio_id,
            Servicio.activo.is_(True),
            Servicio.visible_web.is_(True),
        )
    ).scalar_one_or_none()
    if servicio is None:
        raise ReservaError("Servicio no encontrado o no disponible")

    tzname = _tz_del_contexto(tenant, servicio, servicio.sede)
    tzinfo = ZoneInfo(tzname)

    dia_local = _fecha_local(_a_utc(fecha), tzname)
    inicio_dia = datetime.combine(dia_local, datetime.min.time(), tzinfo=tzinfo).astimezone(timezone.utc)
    fin_dia = inicio_dia + timedelta(days=1)
    dia_semana = dia_local.weekday()

    bloqueos = list(db.execute(
        select(HorarioBloqueo).where(
            HorarioBloqueo.tenant_id == tenant.id,
            HorarioBloqueo.fecha_inicio < fin_dia,
            HorarioBloqueo.fecha_fin > inicio_dia,
        )
    ).scalars().all())

    sesiones = list(db.execute(
        select(Sesion)
        .options(
            joinedload(Sesion.servicio),
            joinedload(Sesion.asesor).joinedload(UsuarioTenant.usuario),
        )
        .where(
            Sesion.tenant_id == tenant.id,
            Sesion.fecha_hora_inicio < fin_dia,
            Sesion.fecha_hora_fin > inicio_dia,
            Sesion.estado.in_(ESTADOS_SESION_ACTIVA),
        )
    ).scalars().unique().all())

    def _asesor_de_sesion(s: Optional[Sesion]) -> Optional[Dict[str, Any]]:
        if s is None or s.asesor is None:
            return None
        a = s.asesor
        return {
            "id": a.id,
            "nombre": a.usuario.nombre if a.usuario else "Asesor",
            "avatar_url": a.usuario.avatar_url if a.usuario else None,
            "bio": a.bio,
        }

    dur = timedelta(minutes=servicio.duracion_minutos)
    paso = timedelta(minutes=servicio.config_json.get("intervalo_slots_min", servicio.duracion_minutos))
    ahora = utcnow()

    def _bloqueado(ini: datetime, fin: datetime, aid: Optional[int]) -> bool:
        for b in bloqueos:
            if not (b.fecha_inicio < fin and b.fecha_fin > ini):
                continue
            if b.entidad_tipo == "global":
                return True
            if b.entidad_tipo == "asesor" and b.entidad_id == aid:
                return True
            if b.entidad_tipo == "sede" and b.entidad_id == servicio.sede_id:
                return True
        return False

    if servicio.requiere_confirmacion:
        # Confirmación manual: la ventana de propuesta la define el horario
        # del SERVICIO (entidad_tipo='servicio'), no el de cada asesor. Cada
        # slot sale con asesor=None porque aún no se sabe quién lo atenderá;
        # la disponibilidad real del asesor se valida al asignarlo
        # (POST /admin/reservas/{reserva_id}/asignar-asesor). Los bloqueos
        # global/sede se respetan igual que en el flujo normal.
        marcos = list(db.execute(
            select(HorarioDisponibilidad).where(
                HorarioDisponibilidad.tenant_id == tenant.id,
                HorarioDisponibilidad.entidad_tipo == "servicio",
                HorarioDisponibilidad.entidad_id == servicio.id,
                HorarioDisponibilidad.dia_semana == dia_semana,
                HorarioDisponibilidad.activo.is_(True),
            )
        ).scalars().all())
        marcos = sorted(marcos, key=lambda h: h.hora_inicio)
        sesiones_servicio = [s for s in sesiones if s.servicio_id == servicio.id]

        slots = []
        vistos = set()
        for h in marcos:
            cursor = datetime.combine(dia_local, h.hora_inicio, tzinfo=tzinfo).astimezone(timezone.utc)
            limite = datetime.combine(dia_local, h.hora_fin, tzinfo=tzinfo).astimezone(timezone.utc)

            while cursor + dur <= limite:
                ini, fin = cursor, cursor + dur
                cursor += paso

                if ini <= ahora:
                    continue

                if ini in vistos:
                    continue
                vistos.add(ini)

                sesion_existente = next(
                    (s for s in sesiones_servicio
                     if s.fecha_hora_inicio == ini and s.fecha_hora_fin == fin),
                    None,
                )
                traslape = any(
                    (s.fecha_hora_inicio - timedelta(minutes=s.servicio.buffer_antes_min or 0)) < fin and
                    (s.fecha_hora_fin + timedelta(minutes=s.servicio.buffer_despues_min or 0)) > ini
                    for s in sesiones_servicio
                    if s is not sesion_existente
                )

                if _bloqueado(ini, fin, None):
                    disponible, motivo, cupo = False, "bloqueado", None
                elif traslape:
                    disponible, motivo, cupo = False, "ocupado", None
                elif sesion_existente is not None:
                    cupo = sesion_existente.cupo_maximo - sesion_existente.inscritos
                    disponible = cupo > 0
                    motivo = None if disponible else "cupo_lleno"
                else:
                    disponible, motivo, cupo = True, None, servicio.cupo_maximo

                slots.append({
                    "fecha_hora_inicio": ini,
                    "fecha_hora_fin": fin,
                    "disponible": disponible,
                    "sesion_existente_id": sesion_existente.id if sesion_existente else None,
                    "cupo_disponible": cupo,
                    "motivo_no_disponible": motivo,
                    # Antes siempre None: una sesión ya existente (ej. de una
                    # serie recurrente ya confirmada por el admin, con
                    # asesor asignado desde su creación) se mostraba igual
                    # que un slot nuevo sin asignar, disparando el aviso de
                    # "se te asignará un asesor" aunque ya hubiera uno real.
                    "asesor": _asesor_de_sesion(sesion_existente),
                })

        slots.sort(key=lambda s: s["fecha_hora_inicio"])
        return {
            "fecha": inicio_dia,
            "servicio_id": servicio.id,
            "timezone": tzname,
            "slots": slots,
        }

    asesores = _asesores_del_servicio(db, tenant.id, servicio.id)
    if asesor_id is not None:
        asesores = [a for a in asesores if a.id == asesor_id]
    ids_asesores = [a.id for a in asesores] or [None]

    horarios = list(db.execute(
        select(HorarioDisponibilidad).where(
            HorarioDisponibilidad.tenant_id == tenant.id,
            HorarioDisponibilidad.entidad_tipo == "asesor",
            HorarioDisponibilidad.entidad_id.in_([i for i in ids_asesores if i]),
            HorarioDisponibilidad.dia_semana == dia_semana,
            HorarioDisponibilidad.activo.is_(True),
        )
    ).scalars().all())

    por_asesor: Dict[int, List[Sesion]] = {}
    for s in sesiones:
        if s.asesor_id is not None:
            por_asesor.setdefault(s.asesor_id, []).append(s)

    slots: List[Dict[str, Any]] = []
    vistos: set = set()

    for asesor in asesores:
        marcos = [h for h in horarios if h.entidad_id == asesor.id]
        for h in marcos:
            cursor = datetime.combine(dia_local, h.hora_inicio, tzinfo=tzinfo).astimezone(timezone.utc)
            limite = datetime.combine(dia_local, h.hora_fin, tzinfo=tzinfo).astimezone(timezone.utc)

            while cursor + dur <= limite:
                ini, fin = cursor, cursor + dur
                cursor += paso

                if ini <= ahora:
                    continue

                clave = (ini, asesor.id)
                if clave in vistos:
                    continue
                vistos.add(clave)

                sesion_existente = next(
                    (s for s in por_asesor.get(asesor.id, [])
                     if s.fecha_hora_inicio == ini and s.fecha_hora_fin == fin),
                    None,
                )
                traslape = any(
                    (s.fecha_hora_inicio - timedelta(minutes=s.servicio.buffer_antes_min or 0)) < fin and
                    (s.fecha_hora_fin + timedelta(minutes=s.servicio.buffer_despues_min or 0)) > ini
                    for s in por_asesor.get(asesor.id, [])
                    if s is not sesion_existente
                )

                if _bloqueado(ini, fin, asesor.id):
                    disponible, motivo, cupo = False, "bloqueado", None
                elif traslape:
                    disponible, motivo, cupo = False, "ocupado", None
                elif sesion_existente is not None:
                    cupo = sesion_existente.cupo_maximo - sesion_existente.inscritos
                    disponible = cupo > 0
                    motivo = None if disponible else "cupo_lleno"
                else:
                    disponible, motivo, cupo = True, None, servicio.cupo_maximo

                slots.append({
                    "fecha_hora_inicio": ini,
                    "fecha_hora_fin": fin,
                    "disponible": disponible,
                    "sesion_existente_id": sesion_existente.id if sesion_existente else None,
                    "cupo_disponible": cupo,
                    "motivo_no_disponible": motivo,
                    "asesor": {
                        "id": asesor.id,
                        "nombre": asesor.usuario.nombre if asesor.usuario else "Asesor",
                        "avatar_url": asesor.usuario.avatar_url if asesor.usuario else None,
                        "bio": asesor.bio,
                    },
                })

    slots.sort(key=lambda s: (s["fecha_hora_inicio"], s["asesor"]["id"]))
    return {
        "fecha": inicio_dia,
        "servicio_id": servicio.id,
        "timezone": tzname,
        "slots": slots,
    }


# ============================================================
# USUARIOS
# ============================================================
def obtener_o_crear_usuario_invitado(
    db: Session, email: str, nombre: str, telefono: Optional[str] = None
) -> Usuario:
    email = email.strip().lower()
    usuario = db.execute(select(Usuario).where(Usuario.email == email)).scalar_one_or_none()
    if usuario:
        return usuario

    usuario = Usuario(
        email=email,
        password_hash=None,
        es_invitado=True,
        nombre=nombre.strip()[:100],
        telefono=telefono,
        email_verificado=False,
    )
    db.add(usuario)
    db.flush()
    return usuario


def _vincular_a_tenant(db: Session, usuario_id: int, tenant_id: int) -> UsuarioTenant:
    vinculo = db.execute(
        select(UsuarioTenant).where(
            UsuarioTenant.usuario_id == usuario_id,
            UsuarioTenant.tenant_id == tenant_id,
        )
    ).scalar_one_or_none()
    if vinculo:
        if not vinculo.activo:
            vinculo.activo = True
            vinculo.desvinculado_en = None
        return vinculo

    vinculo = UsuarioTenant(
        usuario_id=usuario_id, tenant_id=tenant_id, rol=RolUsuario.CLIENTE, activo=True
    )
    db.add(vinculo)
    db.flush()
    return vinculo


# ============================================================
# FORMULARIOS — NUEVO
# ============================================================
def _persistir_respuestas_formulario(
    db: Session,
    tenant_id: int,
    reserva: Reserva,
    servicio: Servicio,
    respuestas: Dict[str, Any],
) -> None:
    if not servicio.formulario_id or not respuestas:
        return

    campos = list(db.execute(
        select(CampoFormulario).where(CampoFormulario.formulario_id == servicio.formulario_id)
    ).scalars().all())
    campos_dict = {str(c.id): c for c in campos}

    for campo_id_str, valor in respuestas.items():
        campo = campos_dict.get(str(campo_id_str))
        if campo is None:
            continue
        db.add(RespuestaFormulario(
            reserva_id=reserva.id,
            campo_id=campo.id,
            valor=str(valor)[:2000] if valor is not None else None,
        ))


# ============================================================
# CREAR RESERVA — camino crítico
# ============================================================
def crear_reserva(
    db: Session,
    tenant: Tenant,
    payload: ReservaCreate,
    usuario_actual: Optional[Usuario] = None,
    ip: Optional[str] = None,
    user_agent: Optional[str] = None,
    generar_token_activacion: bool = True,
) -> Dict[str, Any]:
    tenant_id = tenant.id

    servicio = db.execute(
        select(Servicio)
        .options(joinedload(Servicio.sede))
        .where(
            Servicio.tenant_id == tenant_id,
            Servicio.id == payload.servicio_id,
            Servicio.activo.is_(True),
            Servicio.visible_web.is_(True),
        )
    ).scalar_one_or_none()
    if servicio is None:
        raise ReservaError("Servicio no encontrado o no disponible")

    inicio = _a_utc(payload.fecha_hora_inicio)
    fin = inicio + timedelta(minutes=servicio.duracion_minutos)
    tzname = _tz_del_contexto(tenant, servicio, servicio.sede)

    if usuario_actual is not None:
        usuario = usuario_actual
    else:
        if not payload.email_invitado or not payload.nombre_invitado:
            raise ReservaError(
                "Se requiere iniciar sesión o proporcionar nombre y correo",
                codigo="identidad_requerida",
            )
        usuario = obtener_o_crear_usuario_invitado(
            db, payload.email_invitado, payload.nombre_invitado, payload.telefono_invitado
        )
    _vincular_a_tenant(db, usuario.id, tenant_id)

    acceso_token_plano = None
    if generar_token_activacion and usuario.password_hash is None:
        acceso_token_plano = generar_token_acceso(usuario)

    _lock_franja(db, tenant_id, servicio.id, inicio)

    sesion_creada = False

    if payload.sesion_id is not None:
        sesion = _bloquear_sesion(db, tenant_id, payload.sesion_id)
        if sesion is None:
            raise ReservaError("La sesión indicada no existe", codigo="sesion_no_encontrada")
        if sesion.servicio_id != servicio.id:
            raise ReservaError("La sesión no corresponde al servicio indicado")
        if sesion.estado not in (EstadoSesion.ABIERTA, EstadoSesion.CONFIRMADA):
            raise ReservaError("La sesión ya no admite inscripciones", codigo="sesion_cerrada")
        if sesion.fecha_hora_inicio != inicio:
            raise ReservaError(
                "El horario enviado no coincide con el de la sesión seleccionada",
                codigo="horario_incongruente",
            )
    else:
        sesion = buscar_sesion_abierta(
            db, tenant_id, servicio.id, inicio, fin,
            asesor_id=payload.asesor_id, bloquear=True,
        )
        if sesion is None:
            if servicio.tipo_agenda == TipoAgenda.GRUPAL and not servicio.creacion_por_alumno:
                raise ReservaError(
                    "No hay sesiones programadas en ese horario",
                    codigo="sin_sesion_disponible",
                )
            if servicio.requiere_confirmacion:
                # Asignación manual de asesor: la sesión se crea SIN asesor y la
                # reserva queda PENDIENTE. El staff asigna asesor al confirmar
                # vía POST /admin/reservas/{reserva_id}/asignar-asesor. Aquí solo
                # se validan bloqueos tipo "global"/"sede" (con asesor_id=None,
                # validar_disponibilidad_franja no depende de disponibilidad de
                # asesor) — sin corrimiento de concurrencia ni manejo de cupo.
                validar_disponibilidad_franja(
                    db, tenant_id, servicio, inicio, fin, asesor_id=None, tzname=tzname
                )
                sesion = crear_sesion(
                    db, tenant, servicio, inicio, fin,
                    creado_por_usuario_id=usuario.id,
                    creado_por_tipo=CreadoPorTipo.ALUMNO.value if usuario_actual else CreadoPorTipo.SISTEMA.value,
                    asesor_id=None,
                    sede_id=payload.sede_id,
                    tzname=tzname,
                )
                sesion_creada = True
            else:
                asesor_id = asignar_asesor_disponible(
                    db, tenant_id, servicio, inicio, fin, tzname, preferido_id=payload.asesor_id
                )
                validar_disponibilidad_franja(
                    db, tenant_id, servicio, inicio, fin, asesor_id=asesor_id, tzname=tzname
                )
                sesion = crear_sesion(
                    db, tenant, servicio, inicio, fin,
                    creado_por_usuario_id=usuario.id,
                    creado_por_tipo=CreadoPorTipo.ALUMNO.value if usuario_actual else CreadoPorTipo.SISTEMA.value,
                    asesor_id=asesor_id,
                    sede_id=payload.sede_id,
                    tzname=tzname,
                )
                sesion_creada = True

    if not _ocupar_lugar(db, sesion.id, tenant_id):
        raise CupoAgotadoError()

    metodo = payload.metodo_pago.value if payload.metodo_pago else (
        servicio.metodo_pago.value if servicio.metodo_pago else tenant.metodo_pago_default.value
    )
    precio = servicio.precio or Decimal("0.00")
    requiere_pago = servicio.pago_requerido and precio > 0

    if servicio.requiere_confirmacion:
        estado = EstadoReserva.PENDIENTE
        estado_pago = EstadoPagoReserva.PENDIENTE
        hold_expira = None
    elif not requiere_pago:
        estado = EstadoReserva.CONFIRMADA
        estado_pago = EstadoPagoReserva.EXENTO
        hold_expira = None
    elif metodo == MetodoPago.ONLINE.value:
        estado = EstadoReserva.EN_ESPERA
        estado_pago = EstadoPagoReserva.PENDIENTE
        hold_expira = utcnow() + timedelta(minutes=tenant.hold_minutos)
    else:
        estado = EstadoReserva.CONFIRMADA
        estado_pago = EstadoPagoReserva.PENDIENTE
        hold_expira = None

    reserva = Reserva(
        tenant_id=tenant_id,
        sesion_id=sesion.id,
        servicio_id=servicio.id,
        creado_por_usuario_id=usuario.id,
        beneficiario_id=payload.beneficiario_id,
        estado=estado,
        estado_pago=estado_pago,
        tipo_flujo=TipoFlujo.MANUAL if servicio.requiere_confirmacion else TipoFlujo.AUTO,
        hold_expira_en=hold_expira,
        folio=generar_folio(tenant_id),
        codigo_confirmacion=generar_codigo_confirmacion(),
        notas_cliente=payload.notas_cliente,
        precio_final=precio,
        moneda=servicio.moneda or tenant.moneda,
        canal=payload.canal.value,
    )
    db.add(reserva)

    try:
        db.flush()
    except IntegrityError as exc:
        db.rollback()
        if "uq_reserva_activa_por_usuario_sesion" in str(exc.orig):
            raise ReservaError(
                "Ya tiene una reserva activa en esta sesión",
                codigo="reserva_duplicada",
            ) from exc
        if "ck_sesion_inscritos_cupo" in str(exc.orig):
            raise CupoAgotadoError() from exc
        raise

    if payload.respuestas_formulario:
        _persistir_respuestas_formulario(db, tenant_id, reserva, servicio, payload.respuestas_formulario)

    actualizar_estado_sesion(db, sesion.id, tenant_id)

    registrar_bitacora(
        db, tenant_id, "reserva", reserva.id, "crear",
        usuario_id=usuario.id,
        detalles={
            "folio": reserva.folio,
            "sesion_id": sesion.id,
            "sesion_creada": sesion_creada,
            "sesion_elegida_por_cliente": payload.sesion_id is not None,
            "metodo_pago": metodo,
        },
        ip=ip, user_agent=user_agent,
    )

    if servicio.requiere_confirmacion:
        # Nada se dispara post-commit: el email y el calendario se disparan
        # hasta que el staff confirma (asigna asesor) en
        # POST /admin/reservas/{reserva_id}/asignar-asesor.
        tareas = {
            "checkout": False,
            "sincronizar_calendario": False,
            "enviar_confirmacion": False,
        }
    else:
        tareas = {
            "checkout": metodo == MetodoPago.ONLINE.value and requiere_pago,
            "sincronizar_calendario": sesion_creada,
            "enviar_confirmacion": True,
        }

    return {
        "reserva": reserva,
        "sesion": sesion,
        "servicio": servicio,
        "usuario": usuario,
        "sesion_creada": sesion_creada,
        "tareas_post_commit": tareas,
        "acceso_token_plano": acceso_token_plano,
        "mensaje": (
            "Reserva pendiente de confirmación" if estado == EstadoReserva.PENDIENTE
            else "Reserva confirmada" if estado == EstadoReserva.CONFIRMADA
            else "Reserva en espera de pago"
        ),
    }


# ============================================================
# SOLICITUDES DE RESERVA — confirmación manual (Tarea 2)
# El cliente propone una fecha/hora para un servicio con
# requiere_confirmacion=True. No reserva nada todavía.
# ============================================================
def crear_solicitud_reserva(
    db: Session,
    tenant: Tenant,
    payload: SolicitudCreate,
    usuario: Usuario,
    ip: Optional[str] = None,
    user_agent: Optional[str] = None,
) -> SolicitudReserva:
    tenant_id = tenant.id

    servicio = db.execute(
        select(Servicio).where(
            Servicio.tenant_id == tenant_id,
            Servicio.id == payload.servicio_id,
            Servicio.activo.is_(True),
            Servicio.visible_web.is_(True),
        )
    ).scalar_one_or_none()
    if servicio is None:
        raise ReservaError("Servicio no encontrado o no disponible", codigo="servicio_no_encontrado")
    if not servicio.requiere_confirmacion:
        raise ReservaError(
            "Este servicio no requiere confirmación; reserva directamente.",
            codigo="no_requiere_confirmacion",
        )

    propuesta = _a_utc(payload.fecha_hora_propuesta)
    if propuesta <= utcnow():
        raise ReservaError("La fecha propuesta debe ser futura", codigo="fecha_ambigua")

    _vincular_a_tenant(db, usuario.id, tenant_id)

    pendientes_previos = db.execute(
        select(func.count()).select_from(SolicitudReserva).where(
            SolicitudReserva.tenant_id == tenant_id,
            SolicitudReserva.cliente_usuario_id == usuario.id,
            SolicitudReserva.servicio_id == servicio.id,
            SolicitudReserva.estado == EstadoSolicitud.PENDIENTE.value,
        )
    ).scalar_one()

    solicitud = SolicitudReserva(
        tenant_id=tenant_id,
        servicio_id=servicio.id,
        cliente_usuario_id=usuario.id,
        fecha_hora_propuesta=propuesta,
        duracion_minutos=servicio.duracion_minutos,
        notas_cliente=payload.notas_cliente,
    )
    db.add(solicitud)
    db.flush()

    registrar_bitacora(
        db, tenant_id, "solicitud_reserva", solicitud.id, "solicitud_reserva_creada",
        usuario_id=usuario.id,
        detalles={
            "servicio_id": servicio.id,
            "fecha_hora_propuesta": propuesta.isoformat(),
            "pendientes_previos": pendientes_previos,
        },
        ip=ip, user_agent=user_agent,
    )
    return solicitud


# ============================================================
# SERIES DE RESERVAS — reservas recurrentes (Sprint 2 #11)
# ============================================================
def generar_fechas_recurrencia(
    fecha_inicio: date,
    dia_semana: Optional[int],
    frecuencia: str,
    num_repeticiones: int,
) -> List[date]:
    """Genera lista de fechas según patrón de recurrencia.
    
    Args:
        fecha_inicio: Fecha de inicio de la serie
        dia_semana: Día de la semana (0=lunes, 6=domingo). Si es None, usa fecha_inicio
        frecuencia: "semanal", "quincenal", o "mensual"
        num_repeticiones: Número de fechas a generar
    
    Returns:
        Lista de fechas ordenadas
    """
    from datetime import timedelta

    fechas = []
    
    # Si dia_semana está definido, ajustar fecha_inicio a ese día
    if dia_semana is not None:
        dias_hasta = (dia_semana - fecha_inicio.weekday()) % 7
        # Si la fecha_inicio ya es el día correcto, usarla; sino avanzar al siguiente
        if dias_hasta > 0 or fecha_inicio.weekday() != dia_semana:
            fecha_inicio = fecha_inicio + timedelta(days=dias_hasta)
    
    fecha_actual = fecha_inicio

    for _ in range(num_repeticiones):
        fechas.append(fecha_actual)

        # Avanzar según frecuencia
        if frecuencia == "semanal":
            fecha_actual = fecha_actual + timedelta(weeks=1)
        elif frecuencia == "quincenal":
            fecha_actual = fecha_actual + timedelta(weeks=2)
        elif frecuencia == "mensual":
            # Avanzar un mes (manejar cambio de mes)
            mes_siguiente = fecha_actual.month + 1
            anio = fecha_actual.year
            if mes_siguiente > 12:
                mes_siguiente = 1
                anio += 1
            try:
                fecha_actual = fecha_actual.replace(year=anio, month=mes_siguiente)
            except ValueError:
                # Si el día no existe en el mes siguiente (ej. 31 -> febrero)
                # usar el último día del mes
                import calendar
                ultimo_dia = calendar.monthrange(anio, mes_siguiente)[1]
                fecha_actual = fecha_actual.replace(year=anio, month=mes_siguiente, day=ultimo_dia)

    return fechas


def crear_serie(
    db: Session,
    tenant: Tenant,
    payload: SerieReservaCreate,
    registrado_por: Optional[Usuario] = None,
    ip: Optional[str] = None,
    user_agent: Optional[str] = None,
) -> SerieReserva:
    """Crea el patrón de horario de una serie recurrente.

    No genera reservas ni inscripciones; eso se hace en
    inscribir_cliente_en_serie().
    """
    from datetime import datetime as dt

    tenant_id = tenant.id

    if payload.num_repeticiones > tenant.max_reservas_serie:
        raise ReservaError(
            f"El número de repeticiones ({payload.num_repeticiones}) excede el máximo permitido ({tenant.max_reservas_serie})",
            codigo="serie_demasiado_larga",
        )

    servicio = db.execute(
        select(Servicio).where(
            Servicio.tenant_id == tenant_id,
            Servicio.id == payload.servicio_id,
            Servicio.activo.is_(True),
        )
    ).scalar_one_or_none()
    if servicio is None:
        raise ReservaError("Servicio no encontrado o no disponible", codigo="servicio_no_encontrado")

    if payload.asesor_id:
        asesor = db.execute(
            select(UsuarioTenant).where(
                UsuarioTenant.tenant_id == tenant_id,
                UsuarioTenant.id == payload.asesor_id,
                UsuarioTenant.activo.is_(True),
                UsuarioTenant.rol.in_([RolUsuario.ASESOR, RolUsuario.ADMIN]),
            )
        ).scalar_one_or_none()
        if asesor is None:
            raise ReservaError("Asesor no encontrado o inactivo", codigo="asesor_no_encontrado")

    fecha_inicio_date = payload.fecha_inicio.date() if isinstance(payload.fecha_inicio, dt) else payload.fecha_inicio

    serie = SerieReserva(
        tenant_id=tenant_id,
        servicio_id=payload.servicio_id,
        asesor_id=payload.asesor_id,
        frecuencia=payload.frecuencia,
        dia_semana=payload.dia_semana,
        hora_inicio=payload.hora_inicio,
        duracion_minutos=payload.duracion_minutos,
        num_repeticiones=payload.num_repeticiones,
        fecha_inicio=fecha_inicio_date,
        cobro_por_sesion_habilitado=payload.cobro_por_sesion_habilitado,
        cobro_por_paquete_habilitado=payload.cobro_por_paquete_habilitado,
        precio_paquete=payload.precio_paquete,
    )
    db.add(serie)
    db.flush()

    registrar_bitacora(
        db, tenant_id, "serie_reserva", serie.id, "serie_reserva_creada",
        usuario_id=registrado_por.id if registrado_por is not None else None,
        detalles={
            "servicio_id": servicio.id,
            "num_repeticiones": payload.num_repeticiones,
            "asesor_id": payload.asesor_id,
            "cobro_por_sesion_habilitado": payload.cobro_por_sesion_habilitado,
            "cobro_por_paquete_habilitado": payload.cobro_por_paquete_habilitado,
            "precio_paquete": str(payload.precio_paquete) if payload.precio_paquete is not None else None,
        },
        ip=ip, user_agent=user_agent,
    )

    return serie


def inscribir_cliente_en_serie(
    db: Session,
    tenant: Tenant,
    serie_id: int,
    payload: InscripcionSerieCreate,
    registrado_por: Optional[Usuario] = None,
    ip: Optional[str] = None,
    user_agent: Optional[str] = None,
) -> Dict[str, Any]:
    """Invita a un cliente a una serie existente — NO genera reservas.

    El cliente elige modalidad_cobro/metodo_pago desde su portal
    (confirmar_inscripcion_serie()), que es lo que de verdad genera las N
    reservas. Si el cliente ya tenía una invitación CANCELADA para esta
    misma serie, se reactiva en vez de bloquear (mismo criterio que ya se
    aplicó para re-vincular un UsuarioTenant desvinculado — ver HANDOFF
    2026-08-03 — evita el mismo tipo de bug: una fila vieja bloqueando un
    reintento legítimo para siempre).

    Devuelve {"inscripcion", "cliente", "acceso_token_plano"} — el caller
    (router) manda el correo de invitación/activación post-commit.
    """
    tenant_id = tenant.id

    serie = db.execute(
        select(SerieReserva).where(
            SerieReserva.tenant_id == tenant_id,
            SerieReserva.id == serie_id,
        )
    ).scalar_one_or_none()
    if serie is None:
        raise ReservaError("Serie no encontrada", codigo="serie_no_encontrada")
    if serie.estado == EstadoSerie.CANCELADA:
        raise ReservaError("La serie está cancelada", codigo="serie_cancelada")

    cliente = db.get(Usuario, payload.cliente_usuario_id)
    if cliente is None:
        raise ReservaError("Cliente no encontrado", codigo="cliente_no_encontrado")

    # Validar que el cliente pertenezca al tenant (rol cliente)
    ut_cliente = db.execute(
        select(UsuarioTenant).where(
            UsuarioTenant.tenant_id == tenant_id,
            UsuarioTenant.usuario_id == payload.cliente_usuario_id,
            UsuarioTenant.activo.is_(True),
        )
    ).scalar_one_or_none()
    if ut_cliente is None:
        raise ReservaError("El cliente no está vinculado a este tenant", codigo="cliente_no_vinculado")

    inscripcion_existente = db.execute(
        select(InscripcionSerie).where(
            InscripcionSerie.serie_id == serie_id,
            InscripcionSerie.cliente_usuario_id == payload.cliente_usuario_id,
        )
    ).scalar_one_or_none()

    if inscripcion_existente is not None:
        if inscripcion_existente.estado != EstadoInscripcion.CANCELADA:
            raise ReservaError("El cliente ya está inscrito en esta serie", codigo="cliente_ya_inscrito")
        inscripcion = inscripcion_existente
        inscripcion.estado = EstadoInscripcion.INVITADA
        inscripcion.modalidad_cobro = None
        accion_bitacora = "inscripcion_serie_reinvitada"
    else:
        inscripcion = InscripcionSerie(
            tenant_id=tenant_id,
            serie_id=serie_id,
            cliente_usuario_id=payload.cliente_usuario_id,
            estado=EstadoInscripcion.INVITADA,
        )
        db.add(inscripcion)
        accion_bitacora = "inscripcion_serie_invitada"
    db.flush()

    registrar_bitacora(
        db, tenant_id, "inscripcion_serie", inscripcion.id, accion_bitacora,
        usuario_id=registrado_por.id if registrado_por is not None else None,
        detalles={"serie_id": serie.id, "cliente_usuario_id": payload.cliente_usuario_id},
        ip=ip, user_agent=user_agent,
    )

    acceso_token_plano = None
    if cliente.password_hash is None:
        acceso_token_plano = generar_token_acceso(cliente)

    return {"inscripcion": inscripcion, "cliente": cliente, "acceso_token_plano": acceso_token_plano}


def _generar_reservas_de_inscripcion(
    db: Session,
    tenant: Tenant,
    serie: SerieReserva,
    inscripcion: InscripcionSerie,
    cliente: Usuario,
    metodo_pago: MetodoPagoEnum,
    ip: Optional[str] = None,
    user_agent: Optional[str] = None,
) -> Tuple[List[Reserva], List[Dict[str, Any]]]:
    """Genera las N reservas de una inscripción ya confirmada (una por
    fecha del patrón de la serie). Asume `inscripcion.modalidad_cobro` ya
    fue asignado por el caller. Reutiliza crear_reserva() con
    generar_token_activacion=False — el token de activación, si aplica, ya
    se resolvió al invitar, no aquí. Si una fecha falla, se salta y
    continúa (éxito parcial reportado). No hace commit.
    """
    from datetime import datetime as dt
    from app.schemas_v2_2 import ReservaCreate

    servicio = db.get(Servicio, serie.servicio_id)
    tzname = _tz_del_contexto(tenant, servicio, servicio.sede if servicio else None)

    fechas = generar_fechas_recurrencia(
        fecha_inicio=serie.fecha_inicio,
        dia_semana=serie.dia_semana,
        frecuencia=serie.frecuencia,
        num_repeticiones=serie.num_repeticiones,
    )

    reservas_creadas: List[Reserva] = []
    fechas_omitidas: List[Dict[str, Any]] = []

    precio_por_reserva = None
    if inscripcion.modalidad_cobro == ModalidadCobro.PAQUETE and serie.precio_paquete is not None and fechas:
        precio_por_reserva = serie.precio_paquete / Decimal(len(fechas))

    for fecha in fechas:
        try:
            fecha_hora = dt.combine(fecha, serie.hora_inicio, tzinfo=ZoneInfo(tzname))

            reserva_payload = ReservaCreate(
                servicio_id=serie.servicio_id,
                fecha_hora_inicio=fecha_hora,
                asesor_id=serie.asesor_id,
                metodo_pago=MetodoPago(metodo_pago.value),
                canal=Canal.ADMIN,
            )

            resultado = crear_reserva(
                db, tenant, reserva_payload, cliente, ip=ip, user_agent=user_agent,
                generar_token_activacion=False,
            )
            reserva = resultado["reserva"]

            reserva.serie_id = serie.id
            reserva.inscripcion_id = inscripcion.id
            reserva.modalidad_cobro = inscripcion.modalidad_cobro.value
            if precio_por_reserva is not None:
                reserva.precio_final = precio_por_reserva

            reservas_creadas.append(reserva)

        except ReservaError as e:
            fechas_omitidas.append({
                "fecha": fecha.isoformat(),
                "razon": e.mensaje,
                "codigo": e.codigo,
            })
            continue
        except IntegrityError:
            fechas_omitidas.append({
                "fecha": fecha.isoformat(),
                "razon": "Conflicto de base de datos",
                "codigo": "conflicto_db",
            })
            continue
        except StaleDataError:
            fechas_omitidas.append({
                "fecha": fecha.isoformat(),
                "razon": "Conflicto de concurrencia",
                "codigo": "conflicto_concurrencia",
            })
            continue

    return reservas_creadas, fechas_omitidas


def confirmar_inscripcion_serie(
    db: Session,
    tenant: Tenant,
    inscripcion_id: int,
    cliente: Usuario,
    payload: ConfirmarInscripcionIn,
    ip: Optional[str] = None,
    user_agent: Optional[str] = None,
) -> Dict[str, Any]:
    """El cliente confirma su invitación: elige modalidad + método de pago,
    lo que genera las N reservas y pasa la inscripción a CONFIRMADA.
    """
    tenant_id = tenant.id

    inscripcion = db.execute(
        select(InscripcionSerie)
        .where(InscripcionSerie.tenant_id == tenant_id, InscripcionSerie.id == inscripcion_id)
        .with_for_update()
    ).scalar_one_or_none()
    if inscripcion is None:
        raise ReservaError("Invitación no encontrada", codigo="inscripcion_no_encontrada")
    if inscripcion.cliente_usuario_id != cliente.id:
        raise ReservaError("Esta invitación no te pertenece", codigo="permiso_denegado")
    if inscripcion.estado != EstadoInscripcion.INVITADA:
        raise ReservaError("Esta invitación ya fue resuelta", codigo="inscripcion_no_pendiente")

    serie = db.execute(
        select(SerieReserva).where(SerieReserva.tenant_id == tenant_id, SerieReserva.id == inscripcion.serie_id)
    ).scalar_one_or_none()
    if serie is None or serie.estado == EstadoSerie.CANCELADA:
        raise ReservaError("La serie está cancelada", codigo="serie_cancelada")

    if payload.metodo_pago == MetodoPagoEnum.ONLINE:
        raise ReservaError(
            "El pago en línea todavía no está disponible para este tenant",
            codigo="pago_en_linea_no_disponible",
        )

    # Estado inconsistente de la serie (no un error del cliente):
    # cobro_por_paquete_habilitado=True pero la serie nunca tuvo precio
    # (posible en series creadas antes de que precio_paquete existiera).
    if payload.modalidad_cobro == ModalidadCobroEnum.PAQUETE and serie.precio_paquete is None:
        raise ReservaError(
            "La serie no tiene un precio de paquete configurado",
            codigo="serie_sin_precio_paquete",
        )

    try:
        validar_modalidad_cobro(
            payload.modalidad_cobro,
            serie.precio_paquete,
            serie.cobro_por_sesion_habilitado,
            serie.cobro_por_paquete_habilitado,
        )
    except ValueError as e:
        raise ReservaError(str(e), codigo="modalidad_no_permitida")

    inscripcion.modalidad_cobro = payload.modalidad_cobro

    reservas_creadas, fechas_omitidas = _generar_reservas_de_inscripcion(
        db, tenant, serie, inscripcion, cliente, payload.metodo_pago, ip=ip, user_agent=user_agent,
    )

    inscripcion.estado = EstadoInscripcion.CONFIRMADA

    registrar_bitacora(
        db, tenant_id, "inscripcion_serie", inscripcion.id, "inscripcion_serie_confirmada",
        usuario_id=cliente.id,
        detalles={
            "serie_id": serie.id,
            "modalidad_cobro": payload.modalidad_cobro.value,
            "metodo_pago": payload.metodo_pago.value,
            "num_reservas_creadas": len(reservas_creadas),
            "num_reservas_omitidas": len(fechas_omitidas),
            "fechas_omitidas": fechas_omitidas,
        },
        ip=ip, user_agent=user_agent,
    )

    return {
        "inscripcion": inscripcion,
        "num_reservas_creadas": len(reservas_creadas),
        "num_reservas_omitidas": len(fechas_omitidas),
        "fechas_omitidas": fechas_omitidas,
    }


def cancelar_invitacion_serie(
    db: Session,
    tenant: Tenant,
    serie_id: int,
    inscripcion_id: int,
    staff: UsuarioTenant,
    ip: Optional[str] = None,
    user_agent: Optional[str] = None,
) -> InscripcionSerie:
    """El staff retira una invitación que sigue pendiente (INVITADA).

    No aplica a invitaciones ya CONFIRMADA — esas ya generaron reservas
    reales; para deshacerlas se cancelan las reservas, no la inscripción.
    """
    inscripcion = db.execute(
        select(InscripcionSerie).where(
            InscripcionSerie.tenant_id == tenant.id,
            InscripcionSerie.serie_id == serie_id,
            InscripcionSerie.id == inscripcion_id,
        )
    ).scalar_one_or_none()
    if inscripcion is None:
        raise ReservaError("Invitación no encontrada", codigo="inscripcion_no_encontrada")
    if inscripcion.estado != EstadoInscripcion.INVITADA:
        raise ReservaError(
            "Solo se puede cancelar una invitación pendiente",
            codigo="inscripcion_no_pendiente",
        )

    inscripcion.estado = EstadoInscripcion.CANCELADA

    registrar_bitacora(
        db, tenant.id, "inscripcion_serie", inscripcion.id, "inscripcion_serie_invitacion_cancelada",
        usuario_id=staff.usuario_id,
        detalles={"serie_id": serie_id},
        ip=ip, user_agent=user_agent,
    )

    return inscripcion


def confirmar_solicitud_como_serie(
    db: Session,
    tenant: Tenant,
    solicitud_id: int,
    payload: SolicitudConfirmarSerieIn,
    staff: UsuarioTenant,
    ip: Optional[str] = None,
    user_agent: Optional[str] = None,
) -> Dict[str, Any]:
    """Convierte una SolicitudReserva pendiente en una SerieReserva + una
    invitación (INVITADA) para el cliente de la solicitud — no genera
    reservas todavía. La fecha de inicio, servicio y cliente se toman de
    la solicitud; el staff define el patrón y las modalidades de cobro,
    pero NO elige la modalidad ni el método de pago del cliente — eso lo
    hace el cliente desde su portal (confirmar_inscripcion_serie()), igual
    que en el camino de inscribir_cliente_en_serie().

    Devuelve {"serie", "cliente", "acceso_token_plano"} — reexporta el
    token de activación de inscribir_cliente_en_serie() para que el caller
    mande el correo post-commit si aplica.
    """
    solicitud = db.execute(
        select(SolicitudReserva)
        .where(
            SolicitudReserva.tenant_id == tenant.id,
            SolicitudReserva.id == solicitud_id,
        )
        .with_for_update()
    ).scalar_one_or_none()

    if solicitud is None:
        raise ReservaError("Solicitud no encontrada", codigo="solicitud_no_encontrada")
    if solicitud.estado != EstadoSolicitud.PENDIENTE:
        raise ReservaError("La solicitud ya fue resuelta", codigo="solicitud_no_pendiente")
    if solicitud.fecha_hora_propuesta <= utcnow():
        raise ReservaError(
            "La fecha propuesta ya pasó; ya no se puede confirmar",
            codigo="fecha_ambigua",
        )

    servicio = db.execute(
        select(Servicio)
        .options(joinedload(Servicio.sede))
        .where(
            Servicio.tenant_id == tenant.id,
            Servicio.id == solicitud.servicio_id,
            Servicio.activo.is_(True),
        )
    ).scalar_one_or_none()
    if servicio is None:
        raise ReservaError("Servicio no encontrado o no disponible", codigo="servicio_no_encontrado")

    cliente = db.get(Usuario, solicitud.cliente_usuario_id)
    if cliente is None:
        raise ReservaError("Cliente no encontrado", codigo="cliente_no_encontrado")

    tzname = _tz_del_contexto(tenant, servicio, servicio.sede)
    fecha_inicio_local = solicitud.fecha_hora_propuesta.astimezone(ZoneInfo(tzname)).date()

    serie_payload = SerieReservaCreate(
        servicio_id=solicitud.servicio_id,
        asesor_id=payload.asesor_id,
        frecuencia=payload.frecuencia,
        dia_semana=payload.dia_semana,
        hora_inicio=payload.hora_inicio,
        duracion_minutos=payload.duracion_minutos,
        num_repeticiones=payload.num_repeticiones,
        fecha_inicio=datetime.combine(fecha_inicio_local, time.min, tzinfo=ZoneInfo(tzname)),
        cobro_por_sesion_habilitado=payload.cobro_por_sesion_habilitado,
        cobro_por_paquete_habilitado=payload.cobro_por_paquete_habilitado,
        precio_paquete=payload.precio_paquete,
    )

    serie = crear_serie(
        db, tenant, serie_payload,
        registrado_por=staff.usuario,
        ip=ip, user_agent=user_agent,
    )

    inscripcion_payload = InscripcionSerieCreate(cliente_usuario_id=solicitud.cliente_usuario_id)

    resultado_inscripcion = inscribir_cliente_en_serie(
        db, tenant, serie.id, inscripcion_payload,
        registrado_por=staff.usuario,
        ip=ip, user_agent=user_agent,
    )

    solicitud.estado = EstadoSolicitud.ACEPTADA
    solicitud.serie_id = serie.id
    solicitud.resuelto_por_id = staff.id
    solicitud.resuelto_en = utcnow()

    registrar_bitacora(
        db, tenant.id, "solicitud_reserva", solicitud.id, "solicitud_reserva_confirmada_serie",
        usuario_id=staff.usuario_id,
        detalles={
            "serie_id": serie.id,
            "servicio_id": servicio.id,
            "num_repeticiones": payload.num_repeticiones,
            "cliente_usuario_id": solicitud.cliente_usuario_id,
        },
        ip=ip, user_agent=user_agent,
    )

    return {
        "serie": serie,
        "cliente": resultado_inscripcion["cliente"],
        "acceso_token_plano": resultado_inscripcion["acceso_token_plano"],
    }


# ============================================================
# CONFIRMAR PAGO — NUEVO
# ============================================================
def confirmar_pago_por_folio(
    db: Session,
    folio: str,
    monto: Decimal,
    metodo: str = "stripe",
) -> Reserva:
    reserva = db.execute(
        select(Reserva).where(Reserva.folio == folio)
    ).scalar_one_or_none()
    if not reserva:
        raise ReservaError("Reserva no encontrada", codigo="not_found")
    if reserva.estado != EstadoReserva.EN_ESPERA:
        raise ReservaError("La reserva no está en espera de pago", codigo="estado_invalido")

    reserva.estado = EstadoReserva.CONFIRMADA
    reserva.estado_pago = EstadoPagoReserva.COMPLETADO
    reserva.pagado_en = utcnow()
    reserva.metodo_pago_usado = MetodoPagoUsado(metodo)
    reserva.hold_expira_en = None
    reserva.precio_final = Decimal(str(monto))

    actualizar_estado_sesion(db, reserva.sesion_id, reserva.tenant_id)

    registrar_bitacora(
        db, reserva.tenant_id, "reserva", reserva.id, "pago_confirmado",
        detalles={"folio": folio, "monto": str(monto), "metodo": metodo},
    )
    return reserva


# ============================================================
# CANCELACIÓN
# ============================================================
def cancelar_reserva(
    db: Session,
    tenant: Tenant,
    reserva: Reserva,
    cancelado_por_usuario_id: int,
    motivo: Optional[str] = None,
    forzar: bool = False,
) -> Reserva:
    if reserva.estado in (EstadoReserva.CANCELADA, EstadoReserva.COMPLETADA, EstadoReserva.NO_SHOW):
        raise ReservaError(
            f"La reserva ya está en estado {reserva.estado.value}",
            codigo="estado_no_cancelable",
        )

    sesion = _bloquear_sesion(db, tenant.id, reserva.sesion_id)
    if sesion is None:
        raise ReservaError("Sesión no encontrada")

    if not forzar:
        horas = servicio_politica_cancelacion(db, tenant, reserva.servicio_id)
        limite = sesion.fecha_hora_inicio - timedelta(hours=horas)
        if utcnow() > limite:
            raise ReservaError(
                f"La cancelación requiere {horas} horas de anticipación",
                codigo="fuera_de_politica",
            )

    reserva.estado = EstadoReserva.CANCELADA
    reserva.cancelado_por = cancelado_por_usuario_id
    reserva.cancelado_en = utcnow()
    reserva.motivo_cancelacion = motivo
    reserva.hold_expira_en = None

    _liberar_lugar(db, sesion.id, tenant.id)
    actualizar_estado_sesion(db, sesion.id, tenant.id)

    registrar_bitacora(
        db, tenant.id, "reserva", reserva.id, "cancelar",
        usuario_id=cancelado_por_usuario_id,
        detalles={"folio": reserva.folio, "motivo": motivo, "forzada": forzar},
    )
    return reserva


def servicio_politica_cancelacion(db: Session, tenant: Tenant, servicio_id: int) -> int:
    servicio = db.get(Servicio, servicio_id)
    if servicio and servicio.politica_cancelacion_hs is not None:
        return servicio.politica_cancelacion_hs
    return tenant.politica_cancelacion_hs


# ============================================================
# REAGENDAMIENTO
# ============================================================
def reagendar_sesion(
    db: Session,
    tenant: Tenant,
    sesion_id: int,
    nueva_fecha_inicio: datetime,
    reagendado_por_usuario_id: int,
    nuevo_asesor_id: Optional[int] = None,
    nueva_sede_id: Optional[int] = None,
    motivo: Optional[str] = None,
) -> Sesion:
    sesion = _bloquear_sesion(db, tenant.id, sesion_id)
    if sesion is None:
        raise ReservaError("Sesión no encontrada")
    if sesion.estado in (EstadoSesion.CANCELADA, EstadoSesion.COMPLETADA):
        raise ReservaError("No se puede reagendar una sesión cerrada")

    servicio = db.get(Servicio, sesion.servicio_id)
    nueva_inicio = _a_utc(nueva_fecha_inicio)
    nueva_fin = nueva_inicio + timedelta(minutes=servicio.duracion_minutos)

    _lock_franja(db, tenant.id, servicio.id, nueva_inicio)

    asesor_final = nuevo_asesor_id if nuevo_asesor_id is not None else sesion.asesor_id
    tzname = sesion.timezone

    validar_disponibilidad_franja(
        db, tenant.id, servicio, nueva_inicio, nueva_fin,
        asesor_id=asesor_final,
        excluir_sesion_id=sesion.id,
        tzname=tzname,
    )

    anterior = {
        "inicio": sesion.fecha_hora_inicio.isoformat(),
        "asesor_id": sesion.asesor_id,
        "sede_id": sesion.sede_id,
    }

    sesion.fecha_hora_inicio = nueva_inicio
    sesion.fecha_hora_fin = nueva_fin
    sesion.asesor_id = asesor_final
    if nueva_sede_id is not None:
        sede = db.get(Sede, nueva_sede_id)
        if sede is None or sede.tenant_id != tenant.id:
            raise ReservaError("Sede no válida para este tenant")
        sesion.sede_id = nueva_sede_id

    registrar_bitacora(
        db, tenant.id, "sesion", sesion.id, "reagendar",
        usuario_id=reagendado_por_usuario_id,
        detalles={"anterior": anterior, "nuevo_inicio": nueva_inicio.isoformat(), "motivo": motivo},
    )
    return sesion


# ============================================================
# JOB: HOLDS EXPIRADOS
# ============================================================
def limpiar_holds_expirados(db: Session, lote: int = 200) -> int:
    ahora = utcnow()
    liberadas = 0

    filas = db.execute(
        select(Reserva)
        .where(
            Reserva.estado == EstadoReserva.EN_ESPERA.value,
            Reserva.hold_expira_en.is_not(None),
            Reserva.hold_expira_en < ahora,
        )
        .order_by(Reserva.hold_expira_en)
        .limit(lote)
        .with_for_update(skip_locked=True)
    ).scalars().all()

    for reserva in filas:
        reserva.estado = EstadoReserva.CANCELADA
        reserva.cancelado_en = ahora
        reserva.motivo_cancelacion = "Hold de pago expirado"
        reserva.hold_expira_en = None
        _liberar_lugar(db, reserva.sesion_id, reserva.tenant_id)
        actualizar_estado_sesion(db, reserva.sesion_id, reserva.tenant_id)
        registrar_bitacora(
            db, reserva.tenant_id, "reserva", reserva.id, "expirar_hold",
            detalles={"folio": reserva.folio},
        )
        liberadas += 1

    db.commit()
    return liberadas


# ============================================================
# INTEGRACIONES EXTERNAS — post-commit (stubs)
# ============================================================
def iniciar_checkout(tenant: Tenant, reserva: Reserva, usuario: Usuario) -> Optional[CheckoutUrlOut]:
    raise NotImplementedError("Integrar Stripe/MercadoPago con clave de idempotencia = folio")


def sincronizar_calendario(tenant: Tenant, sesion: Sesion) -> Optional[str]:
    raise NotImplementedError("Integrar Google Calendar")


def _smtp_cfg(tenant: Tenant) -> dict:
    cfg = tenant.smtp_config
    return cfg if isinstance(cfg, dict) else {}


def _fecha_email(dt_utc: Optional[datetime], tzname: str) -> str:
    if dt_utc is None:
        return ""
    local = dt_utc.astimezone(ZoneInfo(tzname))
    return local.strftime("%A %d de %B de %Y, %I:%M %p")


def _asesor_email(asesor: Optional[UsuarioTenant]) -> Optional[str]:
    if asesor is None:
        return None
    return (asesor.usuario.nombre if asesor.usuario else None) or f"Asesor #{asesor.id}"


def _link_activacion(tenant: Tenant, acceso_token_plano: str) -> str:
    base = os.environ.get("FRONTEND_URL", "http://localhost:5173").rstrip("/")
    return f"{base}/t/{tenant.slug}/activar?token={acceso_token_plano}"


def _email_shell(tenant: Tenant, cuerpo_interior_html: str) -> str:
    """Envuelve el cuerpo de un correo transaccional con la identidad del
    tenant (logo si tiene, si no su nombre) y su `color_primario` en la
    barra superior, en vez de un azul fijo genérico. Todos los correos
    salientes del tenant pasan por aquí.
    """
    color = tenant.color_primario or "#1e3a5f"
    tenant_nombre_html = html.escape(tenant.nombre or "")
    if tenant.logo_url:
        header_html = (
            f'<img src="{html.escape(tenant.logo_url)}" alt="{tenant_nombre_html}" '
            f'style="max-height:36px;max-width:220px;display:block;border:0;">'
        )
    else:
        header_html = (
            f'<h1 style="margin:0;color:#ffffff;font-size:18px;font-family:Arial,sans-serif;">'
            f'{tenant_nombre_html}</h1>'
        )
    return f"""\
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f3f4f6;">
  <tr>
    <td style="padding:24px 16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background-color:#ffffff;border-radius:12px;overflow:hidden;">
        <tr>
          <td style="background-color:{color};padding:20px 24px;">
            {header_html}
          </td>
        </tr>
        <tr>
          <td style="padding:24px;font-family:Arial,sans-serif;">
            {cuerpo_interior_html}
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>"""


def _enviar_smtp(tenant: Tenant, destinatario_email: str, asunto: str, texto_plano: str, cuerpo_html: str) -> None:
    """Manda un correo transaccional por el SMTP del tenant.

    La config vive en `tenant.smtp_config` (EncryptedJSON):
      { "host", "port", "user", "password", "from_email", "from_name",
        "tls" (bool, default True), "ssl" (bool, default False),
        "console" (bool, imprime en vez de enviar) }
    Si no hay host, se omite (log) y nunca se lanza excepción: el email es
    un efecto externo que no debe romper la operación que lo disparó.
    """
    cfg = _smtp_cfg(tenant)
    host = cfg.get("host")
    if not host:
        log.info("SMTP no configurado para tenant '%s' — correo omitido (%s)", tenant.slug, asunto)
        return

    if cfg.get("console") or os.environ.get("SMTP_CONSOLE", "").lower() == "1":
        log.info("EMAIL (console) → %s | asunto: %s", destinatario_email, asunto)
        log.info("Contenido: %s", texto_plano.replace("\n", " | "))
        return

    msg = MIMEMultipart("alternative")
    msg["Subject"] = asunto
    msg["From"] = f'{cfg.get("from_name") or tenant.nombre} <{cfg.get("from_email")}>'
    msg["To"] = destinatario_email
    msg.attach(MIMEText(texto_plano, "plain", "utf-8"))
    msg.attach(MIMEText(cuerpo_html, "html", "utf-8"))

    port = int(cfg.get("port") or (465 if cfg.get("ssl") else 587))
    user = cfg.get("user")
    password = cfg.get("password")
    from_email = cfg.get("from_email")

    if cfg.get("ssl"):
        server = smtplib.SMTP_SSL(host, port, timeout=15)
    else:
        server = smtplib.SMTP(host, port, timeout=15)
        if cfg.get("tls", True):
            server.starttls()
    try:
        if user:
            server.login(user, password or "")
        server.sendmail(from_email, [destinatario_email], msg.as_string())
    finally:
        server.quit()
    log.info("Correo enviado a %s (%s)", destinatario_email, asunto)


def enviar_email_confirmacion(
    tenant: Tenant,
    reserva: Reserva,
    usuario: Optional[Usuario],
    sesion: Sesion,
    acceso_token_plano: Optional[str] = None,
) -> None:
    """Envía la confirmación de reserva por SMTP, con el branding del tenant.

    Si `acceso_token_plano` viene (el usuario que reservó es invitado nuevo,
    sin contraseña), agrega un bloque de activación de cuenta dentro de este
    mismo correo — nunca se manda un segundo correo aparte para eso.
    """
    if usuario is None or not usuario.email:
        log.info("Sin destinatario para la confirmación (folio %s)", reserva.folio)
        return

    servicio = reserva.servicio
    asesor = _asesor_email(sesion.asesor) if sesion.asesor is not None else None
    sede = sesion.sede
    fecha = _fecha_email(sesion.fecha_hora_inicio, sesion.timezone)
    fin = _fecha_email(sesion.fecha_hora_fin, sesion.timezone)

    # Escapar todo lo que puede venir de un campo editable por el usuario
    # (nombre de cliente, servicio, sede, asesor) antes de meterlo en el
    # HTML del correo — si no, un nombre tipo "<img src=x onerror=...>" se
    # interpreta como markup dentro del email.
    usuario_nombre_html = html.escape(usuario.nombre or "")
    servicio_nombre_html = html.escape(servicio.nombre or "")
    asesor_html = html.escape(asesor) if asesor else None
    sede_nombre_html = html.escape(sede.nombre) if sede is not None else None
    meet_url_html = html.escape(sesion.meet_url) if sesion.meet_url else None

    fila_precio = ""
    if reserva.precio_final is not None:
        fila_precio = (
            f'<tr><td style="padding:6px 0;color:#6b7280;">Total</td>'
            f'<td style="padding:6px 0;text-align:right;font-weight:600;color:#111827;">'
            f'{reserva.precio_final:.2f} {reserva.moneda}</td></tr>'
        )

    meet_html = ""
    if sesion.meet_url and servicio.modalidad.value in ("virtual", "hibrida"):
        meet_html = (
            f'<p style="margin:12px 0 0;font-size:14px;color:#111827;">'
            f'Tu sesión es en línea. Únete con este enlace:</p>'
            f'<p style="margin:4px 0 0;"><a href="{meet_url_html}" '
            f'style="color:#2563eb;font-weight:600;">{meet_url_html}</a></p>'
        )

    sede_html = ""
    if sede is not None:
        sede_html = (
            f'<tr><td style="padding:6px 0;color:#6b7280;">Lugar</td>'
            f'<td style="padding:6px 0;text-align:right;color:#111827;">{sede_nombre_html}</td></tr>'
        )

    activacion_html = ""
    activacion_texto = ""
    if acceso_token_plano:
        link_activacion = _link_activacion(tenant, acceso_token_plano)
        link_html = html.escape(link_activacion)
        activacion_html = f"""
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:20px;background-color:#eff6ff;border-radius:8px;">
              <tr><td style="padding:16px;">
                <p style="margin:0 0 8px;font-size:14px;font-weight:600;color:#111827;">Crea tu contraseña</p>
                <p style="margin:0 0 12px;font-size:13px;color:#4b5563;">
                  Así puedes ver y administrar tus reservas la próxima vez sin volver a dar tus datos.
                </p>
                <a href="{link_html}" style="display:inline-block;background-color:#2563eb;color:#ffffff;padding:10px 18px;border-radius:6px;font-size:14px;font-weight:600;text-decoration:none;">
                  Crear contraseña
                </a>
              </td></tr>
            </table>"""
        activacion_texto = f"\n\nCrea tu contraseña para administrar tus reservas: {link_activacion}"

    cuerpo_interior = f"""\
            <p style="margin:0 0 16px;font-size:15px;color:#111827;">
              Hola {usuario_nombre_html}, tu reserva está confirmada:
            </p>
            <p style="margin:0;font-size:20px;font-weight:700;color:#111827;">{servicio_nombre_html}</p>
            <p style="margin:4px 0 16px;font-size:15px;color:#4b5563;">
              {fecha}{' — ' + fin if fin and fin != fecha else ''}
            </p>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;">
              <tr><td style="padding:6px 0;color:#6b7280;">Asesor</td>
                  <td style="padding:6px 0;text-align:right;color:#111827;">{asesor_html or 'Por asignar'}</td></tr>
              <tr><td style="padding:6px 0;color:#6b7280;">Modalidad</td>
                  <td style="padding:6px 0;text-align:right;color:#111827;">{servicio.modalidad.value}</td></tr>
              {sede_html}
              {fila_precio}
              <tr><td style="padding:6px 0;color:#6b7280;">Folio</td>
                  <td style="padding:6px 0;text-align:right;color:#111827;">{reserva.folio}</td></tr>
              <tr><td style="padding:6px 0;color:#6b7280;">Código</td>
                  <td style="padding:6px 0;text-align:right;color:#111827;">{reserva.codigo_confirmacion}</td></tr>
            </table>
            {meet_html}
            {activacion_html}
            <p style="margin:20px 0 0;font-size:12px;color:#9ca3af;">
              Si necesitas cambiar o cancelar esta reserva, contacta a tu proveedor.
            </p>"""

    cuerpo_html = _email_shell(tenant, cuerpo_interior)

    texto_plano = (
        f"{tenant.nombre} — Reserva confirmada\n\n"
        f"Hola {usuario.nombre}, tu reserva está confirmada:\n\n"
        f"{servicio.nombre}\n{fecha}"
        + (f" — {fin}" if fin and fin != fecha else "")
        + f"\nAsesor: {asesor or 'Por asignar'}"
        + (f"\nLugar: {sede.nombre}" if sede else "")
        + (f"\nTotal: {reserva.precio_final:.2f} {reserva.moneda}" if reserva.precio_final is not None else "")
        + f"\nFolio: {reserva.folio}\nCódigo: {reserva.codigo_confirmacion}"
        + (f"\n\nEnlace de la sesión: {sesion.meet_url}" if sesion.meet_url else "")
        + activacion_texto
    )

    _enviar_smtp(tenant, usuario.email, f"Confirmación de reserva — {servicio.nombre}", texto_plano, cuerpo_html)


def enviar_email_activacion(tenant: Tenant, usuario: Usuario, acceso_token_plano: str) -> None:
    """Correo standalone de activación de cuenta — lo dispara
    _vincular_usuario_a_tenant(). La reserva de un invitado nuevo y la
    invitación a serie NO usan esta función directamente: esos casos
    integran el CTA de activación dentro de su propio correo
    (enviar_email_confirmacion(), enviar_email_invitacion_serie()) en vez
    de mandar un segundo correo aparte.
    """
    if not usuario.email:
        log.info("Sin destinatario para el correo de activación (usuario %s)", usuario.id)
        return

    usuario_nombre_html = html.escape(usuario.nombre or "")
    tenant_nombre_html = html.escape(tenant.nombre or "")
    link = _link_activacion(tenant, acceso_token_plano)
    link_html = html.escape(link)

    cuerpo_interior = f"""\
            <p style="margin:0 0 16px;font-size:15px;color:#111827;">
              Hola {usuario_nombre_html}, {tenant_nombre_html} te dio acceso a tu cuenta.
            </p>
            <p style="margin:0 0 20px;font-size:14px;color:#4b5563;">
              Crea tu contraseña para entrar y administrar tus reservas.
            </p>
            <a href="{link_html}" style="display:inline-block;background-color:#2563eb;color:#ffffff;padding:10px 18px;border-radius:6px;font-size:14px;font-weight:600;text-decoration:none;">
              Crear contraseña
            </a>
            <p style="margin:20px 0 0;font-size:12px;color:#9ca3af;">
              Este enlace expira en 48 horas. Si no esperabas este correo, ignóralo.
            </p>"""

    cuerpo_html = _email_shell(tenant, cuerpo_interior)
    texto_plano = (
        f"{tenant.nombre} te dio acceso a tu cuenta.\n\n"
        f"Hola {usuario.nombre}, crea tu contraseña para entrar y administrar tus reservas:\n"
        f"{link}\n\nEste enlace expira en 48 horas. Si no esperabas este correo, ignóralo."
    )
    _enviar_smtp(tenant, usuario.email, f"{tenant.nombre} — Activa tu cuenta", texto_plano, cuerpo_html)


def _link_mis_series(tenant: Tenant) -> str:
    base = os.environ.get("FRONTEND_URL", "http://localhost:5173").rstrip("/")
    return f"{base}/mis-series"


def enviar_email_invitacion_serie(
    tenant: Tenant,
    cliente: Usuario,
    servicio_nombre: str,
    acceso_token_plano: Optional[str] = None,
) -> None:
    """Avisa al cliente que tiene una invitación pendiente a una serie
    recurrente (inscribir_cliente_en_serie() / confirmar_solicitud_como_serie()).

    Si el cliente no tiene contraseña, el CTA es el link de activación en
    vez del link a "Mis series" — mismo criterio que
    enviar_email_confirmacion() para invitados nuevos: un solo correo, no
    dos.
    """
    if not cliente.email:
        log.info("Sin destinatario para el correo de invitación a serie (usuario %s)", cliente.id)
        return

    cliente_nombre_html = html.escape(cliente.nombre or "")
    tenant_nombre_html = html.escape(tenant.nombre or "")
    servicio_nombre_html = html.escape(servicio_nombre or "")

    if acceso_token_plano:
        link = _link_activacion(tenant, acceso_token_plano)
        cta_texto = "Crear contraseña y ver invitación"
        nota = 'Primero crea tu contraseña; después la verás en "Mis series".'
    else:
        link = _link_mis_series(tenant)
        cta_texto = "Ver mi invitación"
        nota = 'Inicia sesión y ve a "Mis series" para elegir cómo pagar.'
    link_html = html.escape(link)
    nota_html = html.escape(nota)

    cuerpo_interior = f"""\
            <p style="margin:0 0 16px;font-size:15px;color:#111827;">
              Hola {cliente_nombre_html}, {tenant_nombre_html} te invitó a una serie de sesiones recurrentes de
              <strong>{servicio_nombre_html}</strong>.
            </p>
            <p style="margin:0 0 20px;font-size:14px;color:#4b5563;">
              {nota_html}
            </p>
            <a href="{link_html}" style="display:inline-block;background-color:#2563eb;color:#ffffff;padding:10px 18px;border-radius:6px;font-size:14px;font-weight:600;text-decoration:none;">
              {html.escape(cta_texto)}
            </a>"""

    cuerpo_html = _email_shell(tenant, cuerpo_interior)
    texto_plano = (
        f"{tenant.nombre} te invitó a una serie de sesiones recurrentes de {servicio_nombre}.\n\n"
        f"{nota}\n{link}"
    )
    _enviar_smtp(tenant, cliente.email, f"{tenant.nombre} — Invitación a serie de sesiones", texto_plano, cuerpo_html)


def generar_mapa_url(sede: Optional[Sede]) -> Optional[str]:
    if sede is None or sede.coordenadas_lat is None or sede.coordenadas_lng is None:
        return None
    return f"https://www.google.com/maps/search/?api=1&query={sede.coordenadas_lat},{sede.coordenadas_lng}"
