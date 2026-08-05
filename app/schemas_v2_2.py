"""
schemas_v2_2.py — Pydantic v2

Correcciones sobre v2.1:
  · Enums completos (faltaban NO_SHOW y COMPLETADA → ValidationError 500 en
    cualquier consulta a datos históricos).
  · Timezone: se exige o se asume tz-aware; se dejó de descartar el offset del
    cliente con .replace(tzinfo=None).
  · Separación pública/privada: SesionDetailOut ya no expone la lista de
    folios de otros clientes ni notas_internas.
  · sesion_id documentado como decisión explícita del cliente (no inferencia).
  · Un solo módulo de schemas. v2.1 tenía services importando app.schemas y el
    router importando app.schemas_v2_1 — clases distintas para el mismo dato.
"""

from datetime import datetime, time, timezone as dt_timezone
from decimal import Decimal
from typing import Optional, List, Dict, Any
from enum import Enum

from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator, ConfigDict


# ============================================================
# ENUMS — deben reflejar 1:1 los del modelo SQLAlchemy
# ============================================================
class EstadoReservaEnum(str, Enum):
    PENDIENTE = "pendiente"
    EN_ESPERA = "en_espera"
    CONFIRMADA = "confirmada"
    CANCELADA = "cancelada"
    NO_SHOW = "no_show"        # FALTABA en v2.1
    COMPLETADA = "completada"  # FALTABA en v2.1


class EstadoSesionEnum(str, Enum):
    ABIERTA = "abierta"
    CONFIRMADA = "confirmada"
    LLENA = "llena"
    CANCELADA = "cancelada"
    COMPLETADA = "completada"  # FALTABA en v2.1


class EstadoPagoEnum(str, Enum):
    PENDIENTE = "pendiente"
    COMPLETADO = "completado"
    REEMBOLSADO = "reembolsado"
    EXENTO = "exento"


class MetodoPagoEnum(str, Enum):
    ONLINE = "online"
    LOCAL = "local"
    REGISTRO = "registro"


class TipoAgendaEnum(str, Enum):
    INDIVIDUAL = "individual"
    GRUPAL = "grupal"
    RECURRENTE = "recurrente"


class ModalidadEnum(str, Enum):
    PRESENCIAL = "presencial"
    VIRTUAL = "virtual"
    HIBRIDA = "hibrida"


class CanalEnum(str, Enum):
    WEB = "web"
    ADMIN = "admin"
    WHATSAPP = "whatsapp"
    API = "api"


class EstadoSolicitudEnum(str, Enum):
    PENDIENTE = "pendiente"
    ACEPTADA = "aceptada"
    RECHAZADA = "rechazada"
    CANCELADA = "cancelada"


class ModalidadCobroEnum(str, Enum):
    SESION = "sesion"
    PAQUETE = "paquete"


class EstadoInscripcionEnum(str, Enum):
    INVITADA = "invitada"
    CONFIRMADA = "confirmada"
    CANCELADA = "cancelada"


def validar_modalidad_cobro(
    modalidad: ModalidadCobroEnum,
    precio_paquete: Optional[Decimal],
    cobro_por_sesion_habilitado: bool,
    cobro_por_paquete_habilitado: bool,
) -> None:
    """Valida coherencia entre modalidad elegida y modalidades habilitadas.

    Usado por los model_validators de entrada y por la lógica de negocio
    cuando la serie ya existe y las modalidades habilitadas viven en ella.
    """
    if not cobro_por_sesion_habilitado and not cobro_por_paquete_habilitado:
        raise ValueError("Debe habilitar al menos una modalidad de cobro")
    if (
        cobro_por_paquete_habilitado
        and modalidad == ModalidadCobroEnum.PAQUETE
        and precio_paquete is None
    ):
        raise ValueError("precio_paquete es obligatorio cuando la modalidad es 'paquete'")
    if modalidad == ModalidadCobroEnum.PAQUETE and not cobro_por_paquete_habilitado:
        raise ValueError("No puede seleccionar modalidad 'paquete' si no está habilitada")
    if modalidad == ModalidadCobroEnum.SESION and not cobro_por_sesion_habilitado:
        raise ValueError("No puede seleccionar modalidad 'sesion' si no está habilitada")


class EstadoSerieEnum(str, Enum):
    ACTIVA = "activa"
    COMPLETADA = "completada"
    CANCELADA = "cancelada"


# ============================================================
# HELPERS DE TIMEZONE
# ============================================================
def exigir_aware(v: datetime, campo: str) -> datetime:
    """Normaliza a UTC aware.

    v2.1 hacía `v.replace(tzinfo=None) < datetime.utcnow()`, lo que descartaba
    el offset enviado por el cliente: un usuario en Madrid pidiendo las
    10:00+02:00 quedaba agendado a las 10:00 UTC (dos horas antes de lo que
    creía). Aquí el offset se respeta y se convierte, y un datetime sin
    offset se rechaza en vez de adivinarle la zona.
    """
    if v.tzinfo is None or v.tzinfo.utcoffset(v) is None:
        raise ValueError(
            f"{campo} debe incluir zona horaria (ej. 2026-08-01T10:00:00-06:00). "
            "Un valor sin offset es ambiguo y no se interpreta."
        )
    return v.astimezone(dt_timezone.utc)


# ============================================================
# ENTRADA
# ============================================================
class ReservaCreate(BaseModel):
    servicio_id: int
    fecha_hora_inicio: datetime

    # Decisión EXPLÍCITA del cliente sobre a qué sesión unirse.
    # En v2.1 este campo existía y el servicio nunca lo leía: siempre resolvía
    # por búsqueda de horario, así que con dos asesores a la misma hora el
    # usuario acababa asignado al que no eligió. Ahora, si viene, manda; si no
    # viene, el backend resuelve y lo informa en la respuesta.
    sesion_id: Optional[int] = Field(
        default=None,
        description="ID de la sesión existente a la que el cliente eligió unirse. "
                    "Si se omite, el sistema busca o crea una sesión.",
    )

    asesor_id: Optional[int] = Field(
        default=None,
        description="Solo aplica cuando sesion_id es nulo y el tenant permite elegir asesor.",
    )
    sede_id: Optional[int] = None
    beneficiario_id: Optional[int] = None
    notas_cliente: Optional[str] = Field(default=None, max_length=2000)
    metodo_pago: Optional[MetodoPagoEnum] = None
    canal: CanalEnum = CanalEnum.WEB

    # Datos de invitado (checkout sin cuenta)
    email_invitado: Optional[EmailStr] = None
    nombre_invitado: Optional[str] = Field(default=None, max_length=100)
    telefono_invitado: Optional[str] = Field(default=None, max_length=32)

    respuestas_formulario: Optional[Dict[str, Any]] = None

    model_config = ConfigDict(extra="forbid")

    @field_validator("fecha_hora_inicio")
    @classmethod
    def _validar_fecha(cls, v: datetime) -> datetime:
        v = exigir_aware(v, "fecha_hora_inicio")
        if v <= datetime.now(dt_timezone.utc):
            raise ValueError("La fecha de inicio debe ser futura")
        return v

    @field_validator("sesion_id", "asesor_id", "sede_id", "beneficiario_id", "servicio_id")
    @classmethod
    def _ids_positivos(cls, v: Optional[int]) -> Optional[int]:
        if v is not None and v <= 0:
            raise ValueError("El identificador debe ser un entero positivo")
        return v


class ReagendarSesionIn(BaseModel):
    nueva_fecha_hora_inicio: datetime
    nuevo_asesor_id: Optional[int] = None
    nueva_sede_id: Optional[int] = None
    motivo: Optional[str] = Field(default=None, max_length=500)

    model_config = ConfigDict(extra="forbid")

    @field_validator("nueva_fecha_hora_inicio")
    @classmethod
    def _validar_fecha(cls, v: datetime) -> datetime:
        v = exigir_aware(v, "nueva_fecha_hora_inicio")
        if v <= datetime.now(dt_timezone.utc):
            raise ValueError("La nueva fecha debe ser futura")
        return v


class CancelarReservaIn(BaseModel):
    motivo: Optional[str] = Field(default=None, max_length=500)
    model_config = ConfigDict(extra="forbid")


class PagoLocalIn(BaseModel):
    metodo: str = Field(
        "efectivo",
        pattern=r"^(efectivo|transferencia)$",
        description="Método de cobro presencial del staff",
    )
    monto: Optional[Decimal] = Field(
        default=None,
        ge=0,
        description="Monto cobrado. Si se omite se usa el precio de la reserva.",
    )
    referencia: Optional[str] = Field(default=None, max_length=255)
    model_config = ConfigDict(extra="forbid")


class AsignarAsesorIn(BaseModel):
    asesor_id: int = Field(..., gt=0, description="UsuarioTenant (rol asesor/admin) a asignar a la sesión")
    model_config = ConfigDict(extra="forbid")


# ============================================================
# SALIDA — PÚBLICA
# ============================================================
class SedeOut(BaseModel):
    id: int
    nombre: str
    direccion: Optional[str] = None
    direccion_completa: Optional[str] = None
    mapa_url: Optional[str] = None
    telefono: Optional[str] = None
    timezone: str
    model_config = ConfigDict(from_attributes=True)


class AsesorPublicOut(BaseModel):
    """Datos de asesor visibles al público. Sin email, sin comisión, sin metadata."""
    id: int
    nombre: str
    avatar_url: Optional[str] = None
    bio: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)


class SlotDisponible(BaseModel):
    fecha_hora_inicio: datetime
    fecha_hora_fin: datetime
    disponible: bool
    sesion_existente_id: Optional[int] = None
    cupo_disponible: Optional[int] = None
    asesor: Optional[AsesorPublicOut] = None
    motivo_no_disponible: Optional[str] = None


class DisponibilidadDiaOut(BaseModel):
    fecha: datetime
    servicio_id: int
    timezone: str
    requiere_confirmacion: bool
    permite_solicitudes: bool
    slots: List[SlotDisponible]


class SesionListOut(BaseModel):
    """Vista de listado. Sin datos de otros clientes."""
    id: int
    servicio_id: int
    fecha_hora_inicio: datetime
    fecha_hora_fin: datetime
    timezone: str
    estado: EstadoSesionEnum
    cupo_maximo: int
    inscritos: int
    lugares_disponibles: int
    asesor: Optional[AsesorPublicOut] = None
    sede: Optional[SedeOut] = None
    model_config = ConfigDict(from_attributes=True)


class SesionDetailOut(SesionListOut):
    """Detalle público de una sesión.

    ELIMINADO respecto de v2.1: la lista `reservas` con folio y estado de cada
    inscrito, y `notas_internas`. El endpoint era anónimo y sesion_id es
    autoincremental, así que cualquiera podía iterar IDs, cosechar folios y
    consultar el historial de pago ajeno. Para la vista completa existe
    SesionAdminOut, detrás de autenticación con rol.
    """
    modalidad: Optional[ModalidadEnum] = None
    servicio_nombre: Optional[str] = None
    duracion_minutos: Optional[int] = None
    precio: Optional[Decimal] = None
    moneda: Optional[str] = None
    # meet_url solo se entrega a inscritos confirmados; el router lo puebla.
    meet_url: Optional[str] = None


# ============================================================
# SALIDA — ADMIN
# ============================================================
class ReservaResumenAdminOut(BaseModel):
    id: int
    folio: str
    estado: EstadoReservaEnum
    estado_pago: EstadoPagoEnum
    nombre_cliente: Optional[str] = None
    email_cliente: Optional[str] = None
    creado_en: datetime
    model_config = ConfigDict(from_attributes=True)


class SesionAdminOut(SesionDetailOut):
    notas_internas: Optional[str] = None
    google_event_id: Optional[str] = None
    creado_por_tipo: Optional[str] = None
    creado_en: Optional[datetime] = None
    version_id: Optional[int] = None
    reservas: List[ReservaResumenAdminOut] = Field(default_factory=list)


class ReservaAdminListOut(BaseModel):
    id: int
    folio: str
    estado: EstadoReservaEnum
    estado_pago: EstadoPagoEnum
    nombre_cliente: Optional[str] = None
    email_cliente: Optional[str] = None
    servicio_id: int
    sesion_id: int
    servicio_nombre: Optional[str] = None
    fecha_hora_inicio: datetime
    fecha_hora_fin: datetime
    timezone: str
    precio_final: Optional[Decimal] = None
    moneda: str = "MXN"
    asesor: Optional[AsesorPublicOut] = None


# ============================================================
# SALIDA — RESERVA
# ============================================================
class ReservaOut(BaseModel):
    id: int
    folio: str
    codigo_confirmacion: str
    estado: EstadoReservaEnum
    estado_pago: EstadoPagoEnum
    sesion_id: int
    servicio_id: int
    servicio_nombre: Optional[str] = None
    fecha_hora_inicio: datetime
    fecha_hora_fin: datetime
    timezone: str
    modalidad: Optional[ModalidadEnum] = None
    precio_final: Optional[Decimal] = None
    moneda: str = "MXN"
    meet_url: Optional[str] = None
    sede: Optional[SedeOut] = None
    asesor: Optional[AsesorPublicOut] = None
    hold_expira_en: Optional[datetime] = None
    notas_cliente: Optional[str] = None
    serie_id: Optional[int] = None
    inscripcion_id: Optional[int] = None
    modalidad_cobro: Optional[ModalidadCobroEnum] = None
    creado_en: datetime
    model_config = ConfigDict(from_attributes=True)


class ReservaPublicaOut(BaseModel):
    """Vista pública de reserva (solo lectura, sin datos sensibles).
    
    Accesible sin autenticación mediante folio + codigo_confirmacion.
    No incluye: meet_url, notas_cliente, sede, asesor (privados).
    """
    folio: str
    codigo_confirmacion: str
    estado: EstadoReservaEnum
    estado_pago: EstadoPagoEnum
    servicio_nombre: Optional[str] = None
    fecha_hora_inicio: datetime
    fecha_hora_fin: datetime
    timezone: str
    modalidad: Optional[ModalidadEnum] = None
    precio_final: Optional[Decimal] = None
    moneda: str = "MXN"
    creado_en: datetime
    model_config = ConfigDict(from_attributes=True)


class CheckoutUrlOut(BaseModel):
    url: str
    proveedor: str
    expira_en: Optional[datetime] = None


class MercadoPagoEstadoOut(BaseModel):
    conectado: bool
    mp_user_id: Optional[str] = None
    tenant_id: int
    metodo_pago_default: str = "local"


class MercadoPagoConectarIn(BaseModel):
    access_token: str = Field(..., min_length=10)
    public_key: Optional[str] = None


class GoogleMeetEstadoOut(BaseModel):
    conectado: bool
    impersonar_email: Optional[str] = None
    tenant_id: int


class GoogleMeetConectarIn(BaseModel):
    impersonar_email: EmailStr


class ReservaCreateResponse(BaseModel):
    """Respuesta del POST /reservas.

    v2.1 devolvía `SesionOut`, un nombre que nunca se importó en el router: el
    endpoint lanzaba NameError DESPUÉS de haber creado la reserva y cobrado.
    """
    reserva: ReservaOut
    checkout: Optional[CheckoutUrlOut] = None
    mensaje: str
    sesion_asignada_id: int
    sesion_creada: bool = Field(
        description="True si se creó una sesión nueva; False si el cliente se unió a una existente."
    )
    activacion_url: Optional[str] = None


class OperacionOut(BaseModel):
    ok: bool
    mensaje: str
    detalle: Optional[Dict[str, Any]] = None


class PaginacionOut(BaseModel):
    total: int
    limit: int
    offset: int


class ReservasAdminPaginadasOut(BaseModel):
    items: List[ReservaAdminListOut]
    paginacion: PaginacionOut


class SesionesPaginadasOut(BaseModel):
    items: List[SesionListOut]
    paginacion: PaginacionOut


# ============================================================
# SOLICITUDES DE RESERVA — confirmación manual (Sprint 2 #10)
# ============================================================
class SolicitudCreate(BaseModel):
    """El cliente propone una fecha/hora libre para un servicio con
    `requiere_confirmacion=True`. No reserva nada todavía."""
    servicio_id: int = Field(..., gt=0)
    fecha_hora_propuesta: datetime
    notas_cliente: Optional[str] = Field(default=None, max_length=2000)
    model_config = ConfigDict(extra="forbid")

    @field_validator("fecha_hora_propuesta")
    @classmethod
    def _validar_fecha(cls, v: datetime) -> datetime:
        v = exigir_aware(v, "fecha_hora_propuesta")
        if v <= datetime.now(dt_timezone.utc):
            raise ValueError("La fecha propuesta debe ser futura")
        return v


class SolicitudAlternativaOut(BaseModel):
    id: int
    fecha_hora: datetime
    model_config = ConfigDict(from_attributes=True)


class SolicitudOut(BaseModel):
    """Vista del cliente: sin datos de resolución internos."""
    id: int
    servicio_id: int
    servicio_nombre: Optional[str] = None
    fecha_hora_propuesta: datetime
    duracion_minutos: int
    notas_cliente: Optional[str] = None
    estado: EstadoSolicitudEnum
    asesor_id: Optional[int] = None
    motivo_rechazo: Optional[str] = None
    reserva_id: Optional[int] = None
    alternativas: List[SolicitudAlternativaOut] = Field(default_factory=list)
    alternativa_aceptada_id: Optional[int] = None
    creado_en: datetime
    model_config = ConfigDict(from_attributes=True)


class SolicitudAdminOut(SolicitudOut):
    """Vista del staff: agrega datos del cliente y de resolución."""
    cliente_usuario_id: int
    nombre_cliente: Optional[str] = None
    email_cliente: Optional[str] = None
    resuelto_por_id: Optional[int] = None
    resuelto_en: Optional[datetime] = None
    serie_id: Optional[int] = None


class SolicitudConfirmarOut(SolicitudAdminOut):
    """El staff confirmó la solicitud: la Reserva PENDIENTE ya existe y el
    staff la termina de confirmar vía POST /admin/reservas/{id}/asignar-asesor."""
    folio_reserva: Optional[str] = None
    sesion_id: Optional[int] = None


class SolicitudConfirmarSerieIn(BaseModel):
    """Parámetros para convertir una solicitud en una serie recurrente.

    La fecha de inicio, servicio y cliente se toman de la solicitud. El
    staff define el patrón de recurrencia — las modalidades de cobro y el
    precio de paquete se heredan del servicio. NO elige la modalidad ni el
    método de pago del cliente: eso lo hace el cliente desde su portal
    (POST /mis-series/{id}/confirmar), igual que en el camino de inscribir
    directamente. Confirmar una solicitud como serie solo crea la serie +
    una invitación (estado=invitada) para el cliente.
    """
    frecuencia: str = Field(..., pattern=r"^(semanal|quincenal|mensual)$")
    dia_semana: Optional[int] = Field(default=None, ge=0, le=6)
    hora_inicio: time
    duracion_minutos: int = Field(default=60, gt=0)
    num_repeticiones: int = Field(default=1, ge=1, le=50)
    asesor_id: Optional[int] = Field(default=None, gt=0)

    model_config = ConfigDict(extra="forbid")


class SolicitudRechazarIn(BaseModel):
    """El staff rechaza una solicitud pendiente."""
    motivo: Optional[str] = Field(default=None, max_length=500)
    alternativas: Optional[List[datetime]] = Field(default=None, max_length=10)
    model_config = ConfigDict(extra="forbid")

    @field_validator("alternativas")
    @classmethod
    def _validar_alternativas(cls, v: Optional[List[datetime]]) -> Optional[List[datetime]]:
        if not v:
            return v
        for i, dt in enumerate(v):
            dt = exigir_aware(dt, f"alternativas[{i}]")
            if dt <= datetime.now(dt_timezone.utc):
                raise ValueError(f"La alternativa {i + 1} debe ser una fecha futura")
        return v


class SolicitudAceptarAlternativaOut(SolicitudOut):
    """El cliente aceptó una fecha alternativa; la reserva ya fue creada."""
    folio_reserva: Optional[str] = None
    sesion_id: Optional[int] = None


# ============================================================
# SERIES DE RESERVAS — reservas recurrentes
# ============================================================
class SerieReservaCreate(BaseModel):
    """Crear el patrón de horario de una serie recurrente.

    Las modalidades de cobro y el precio de paquete se heredan del servicio.
    La inscripción de clientes es un paso posterior.
    """
    servicio_id: int = Field(..., gt=0)
    asesor_id: Optional[int] = Field(default=None, gt=0)

    # Patrón de recurrencia
    frecuencia: str = Field(..., pattern=r"^(semanal|quincenal|mensual)$")
    dia_semana: Optional[int] = Field(default=None, ge=0, le=6)
    hora_inicio: time
    duracion_minutos: int = Field(default=60, gt=0)
    num_repeticiones: int = Field(default=1, ge=1, le=50)
    fecha_inicio: datetime

    @field_validator("fecha_inicio")
    @classmethod
    def validar_fecha_inicio(cls, v: datetime) -> datetime:
        v = exigir_aware(v, "fecha_inicio")
        return v

    model_config = ConfigDict(extra="forbid")


class InscripcionSerieCreate(BaseModel):
    """Invita a un cliente a una serie recurrente existente.

    Ya no se captura modalidad de cobro ni método de pago aquí — eso lo
    elige el cliente desde su portal (POST /mis-series/{id}/confirmar).
    Esto solo crea la invitación (estado=invitada); no genera reservas.
    """
    cliente_usuario_id: int = Field(..., gt=0)

    model_config = ConfigDict(extra="forbid")


class ConfirmarInscripcionIn(BaseModel):
    """El cliente confirma su invitación: elige modalidad y método de pago."""
    modalidad_cobro: ModalidadCobroEnum
    metodo_pago: MetodoPagoEnum = Field(default=MetodoPagoEnum.LOCAL)

    model_config = ConfigDict(extra="forbid")


class InscripcionSerieOut(BaseModel):
    """Vista de una inscripción a serie (admin)."""
    id: int
    serie_id: int
    cliente_usuario_id: int
    nombre_cliente: Optional[str] = None
    email_cliente: Optional[str] = None
    estado: EstadoInscripcionEnum
    modalidad_cobro: Optional[ModalidadCobroEnum] = None
    num_reservas_creadas: int = 0
    num_reservas_omitidas: int = 0
    fechas_omitidas: Optional[List[Dict[str, Any]]] = None
    estado_pago: str  # pendiente | completo | parcial | exento
    creado_en: datetime


class InscripcionSerieClienteOut(BaseModel):
    """Vista de una inscripción a serie para el cliente dueño (GET /mis-series).

    Trae lo que el cliente necesita para decidir cómo confirmar: el
    servicio, el patrón de horario, las modalidades habilitadas y sus
    precios (sesión = servicio.precio, paquete = servicio.precio_paquete).
    """
    id: int
    serie_id: int
    estado: EstadoInscripcionEnum
    modalidad_cobro: Optional[ModalidadCobroEnum] = None
    servicio_id: int
    servicio_nombre: Optional[str] = None
    frecuencia: str
    dia_semana: Optional[int] = None
    hora_inicio: time
    num_repeticiones: int
    fecha_inicio: datetime
    cobro_por_sesion_habilitado: bool
    cobro_por_paquete_habilitado: bool
    precio_sesion: Optional[Decimal] = None
    precio_paquete: Optional[Decimal] = None
    num_reservas_creadas: int = 0
    estado_pago: str = "pendiente"  # pendiente | completo | parcial | exento
    creado_en: datetime

    model_config = ConfigDict(from_attributes=True)


class SerieReservaOut(BaseModel):
    """Vista de una serie de reservas."""
    id: int
    servicio_id: int
    servicio_nombre: Optional[str] = None
    asesor_id: Optional[int] = None
    nombre_asesor: Optional[str] = None

    # Patrón de recurrencia
    frecuencia: str
    dia_semana: Optional[int] = None
    hora_inicio: time
    duracion_minutos: int
    num_repeticiones: int
    fecha_inicio: datetime

    # Modalidades de cobro habilitadas por admin
    cobro_por_sesion_habilitado: bool
    cobro_por_paquete_habilitado: bool
    precio_paquete: Optional[Decimal] = None

    # Estado
    estado: EstadoSerieEnum
    num_inscripciones: int = 0
    num_reservas_creadas_total: int = 0

    # Detalle completo; se incluye solo en GET /admin/series/{serie_id}
    inscripciones: Optional[List[InscripcionSerieOut]] = None

    creado_en: datetime
    actualizado_en: datetime

    model_config = ConfigDict(from_attributes=True)


# ============================================================
# SUPERADMIN — TENANTS
# ============================================================
class TenantCreate(BaseModel):
    slug: str = Field(..., min_length=2, max_length=64, pattern=r"^[a-z0-9-]+$")
    nombre: str = Field(..., min_length=2, max_length=255)
    plan: str = Field("starter", pattern=r"^(starter|pro|enterprise)$")
    timezone: str = Field("America/Mexico_City", min_length=1, max_length=64)
    moneda: str = Field("MXN", min_length=3, max_length=3)
    max_asesores: int = Field(5, ge=0)
    max_servicios: int = Field(10, ge=1)
    max_clientes: int = Field(500, ge=1)
    max_reservas_mes: int = Field(1000, ge=1)
    max_reservas_serie: int = Field(20, ge=1, le=50)


class TenantAdminOut(BaseModel):
    id: int
    slug: str
    nombre: str
    activo: bool
    plan: str
    timezone: str
    moneda: str
    max_asesores: int
    max_servicios: int
    max_clientes: int
    max_reservas_mes: int
    max_reservas_serie: int = 20
    creado_en: datetime
    total_usuarios: int = 0
    smtp_configurado: bool = False
    # Campos NO sensibles de smtp_config, para que el frontend pueda precargar
    # el formulario al reabrir el modal. `password` NUNCA sale por aquí.
    smtp_config: Optional[dict] = None
    pago_configurado: bool = False
    metodo_pago_default: str = "local"


class TenantUpdate(BaseModel):
    activo: Optional[bool] = None
    nombre: Optional[str] = Field(None, min_length=2, max_length=255)
    slug: Optional[str] = Field(None, min_length=2, max_length=64, pattern=r"^[a-z0-9-]+$")
    plan: Optional[str] = Field(None, pattern=r"^(starter|pro|enterprise)$")
    timezone: Optional[str] = Field(None, min_length=1, max_length=64)
    moneda: Optional[str] = Field(None, min_length=3, max_length=3)
    max_asesores: Optional[int] = Field(None, ge=0)
    max_servicios: Optional[int] = Field(None, ge=1)
    max_clientes: Optional[int] = Field(None, ge=1)
    max_reservas_mes: Optional[int] = Field(None, ge=1)
    max_reservas_serie: Optional[int] = Field(None, ge=1, le=50)
    smtp_config: Optional[dict] = None
    metodo_pago_default: Optional[str] = Field(None, pattern=r"^(online|local|registro)$")


class MetodoPagoDefaultIn(BaseModel):
    metodo_pago_default: str = Field(..., pattern=r"^(online|local|registro)$")


# ============================================================
# ADMIN — SERVICIOS
# ============================================================
class UsuarioAdminOut(BaseModel):
    id: int
    usuario_id: int
    email: str
    nombre: str
    apellido: Optional[str] = None
    telefono: Optional[str] = None
    rol: str
    activo: bool
    fecha_vinculacion: datetime


# ============================================================
# SUPERADMIN — USUARIOS GLOBALES
# ============================================================
class UsuarioGlobalOut(BaseModel):
    id: int
    email: str
    nombre: str
    apellido: Optional[str] = None
    telefono: Optional[str] = None
    activo: bool
    desactivado_en: Optional[datetime] = None
    purgado_en: Optional[datetime] = None
    creado_en: datetime
    total_tenants: int = 0


class UsuariosGlobalPaginadosOut(BaseModel):
    items: List[UsuarioGlobalOut]
    paginacion: PaginacionOut


class MembresiaGlobalOut(BaseModel):
    ut_id: int
    tenant_id: int
    tenant_nombre: str
    tenant_slug: str
    rol: str
    activo: bool
    fecha_vinculacion: datetime


class UsuarioGlobalDetalleOut(UsuarioGlobalOut):
    tenants: List[MembresiaGlobalOut] = []


class ServicioAdminIn(BaseModel):
    nombre: str = Field(..., min_length=2, max_length=255)
    descripcion: Optional[str] = Field(None, max_length=2000)
    categoria: Optional[str] = Field(None, max_length=64)
    color: str = Field("#3b82f6", pattern=r"^#[0-9a-fA-F]{6}$")
    slug: Optional[str] = Field(None, max_length=128)
    tipo_agenda: TipoAgendaEnum = TipoAgendaEnum.INDIVIDUAL
    modalidad: ModalidadEnum = ModalidadEnum.VIRTUAL
    duracion_minutos: int = Field(60, ge=1)
    buffer_antes_min: int = Field(0, ge=0)
    buffer_despues_min: int = Field(0, ge=0)
    cupo_minimo: int = Field(1, ge=1)
    cupo_maximo: int = Field(1, ge=1)
    precio: Optional[Decimal] = Field(None, ge=0)
    moneda: str = Field("MXN", min_length=3, max_length=3)
    pago_requerido: bool = True
    cobro_por_sesion_habilitado: bool = True
    cobro_por_paquete_habilitado: bool = False
    precio_paquete: Optional[Decimal] = Field(None, ge=0)
    visible_web: bool = True
    requiere_confirmacion: bool = False
    permite_solicitudes: bool = False
    encuesta_satisfaccion_formulario_id: Optional[int] = None
    model_config = ConfigDict(extra="forbid")

    @model_validator(mode="after")
    def _validar_cupos(self):
        if self.cupo_maximo < self.cupo_minimo:
            raise ValueError("cupo_maximo no puede ser menor que cupo_minimo")
        if self.tipo_agenda == TipoAgendaEnum.INDIVIDUAL and self.cupo_maximo != 1:
            raise ValueError("Un servicio individual solo admite cupo_maximo = 1")
        return self

    @model_validator(mode="after")
    def _validar_modalidades_cobro(self):
        if not self.cobro_por_sesion_habilitado and not self.cobro_por_paquete_habilitado:
            raise ValueError("Debe habilitar al menos una modalidad de cobro")
        if self.cobro_por_paquete_habilitado:
            if self.tipo_agenda != TipoAgendaEnum.RECURRENTE:
                raise ValueError("El cobro por paquete solo está disponible para servicios recurrentes")
            if self.precio_paquete is None:
                raise ValueError("precio_paquete es obligatorio cuando el cobro por paquete está habilitado")
        return self


class ServicioAdminUpdate(BaseModel):
    """PATCH parcial. `activo` NO se edita aquí: se usa activar/desactivar."""
    nombre: Optional[str] = Field(None, min_length=2, max_length=255)
    descripcion: Optional[str] = Field(None, max_length=2000)
    categoria: Optional[str] = Field(None, max_length=64)
    color: Optional[str] = Field(None, pattern=r"^#[0-9a-fA-F]{6}$")
    slug: Optional[str] = Field(None, max_length=128)
    tipo_agenda: Optional[TipoAgendaEnum] = None
    modalidad: Optional[ModalidadEnum] = None
    duracion_minutos: Optional[int] = Field(None, ge=1)
    buffer_antes_min: Optional[int] = Field(None, ge=0)
    buffer_despues_min: Optional[int] = Field(None, ge=0)
    cupo_minimo: Optional[int] = Field(None, ge=1)
    cupo_maximo: Optional[int] = Field(None, ge=1)
    precio: Optional[Decimal] = Field(None, ge=0)
    moneda: Optional[str] = Field(None, min_length=3, max_length=3)
    pago_requerido: Optional[bool] = None
    cobro_por_sesion_habilitado: Optional[bool] = None
    cobro_por_paquete_habilitado: Optional[bool] = None
    precio_paquete: Optional[Decimal] = Field(None, ge=0)
    visible_web: Optional[bool] = None
    requiere_confirmacion: Optional[bool] = None
    permite_solicitudes: Optional[bool] = None
    encuesta_satisfaccion_formulario_id: Optional[int] = None
    model_config = ConfigDict(extra="forbid")

    @model_validator(mode="after")
    def _validar_cupos(self):
        if self.cupo_maximo is not None and self.cupo_minimo is not None:
            if self.cupo_maximo < self.cupo_minimo:
                raise ValueError("cupo_maximo no puede ser menor que cupo_minimo")
        if self.tipo_agenda == TipoAgendaEnum.INDIVIDUAL and self.cupo_maximo is not None:
            if self.cupo_maximo != 1:
                raise ValueError("Un servicio individual solo admite cupo_maximo = 1")
        return self

    @model_validator(mode="after")
    def _validar_modalidades_cobro(self):
        if self.cobro_por_paquete_habilitado:
            if self.tipo_agenda is not None and self.tipo_agenda != TipoAgendaEnum.RECURRENTE:
                raise ValueError("El cobro por paquete solo está disponible para servicios recurrentes")
            if self.precio_paquete is None and self.cobro_por_sesion_habilitado is not False:
                # precio_paquete es obligatorio si paquete queda habilitado;
                # si sesión también está habilitada, el campo no es obligatorio
                # en el payload, pero no podemos validar sin leer el modelo.
                # Para PATCH parcial aceptamos NULL y el endpoint debe validar
                # el estado final si paquete queda habilitado sin precio.
                pass
        if self.cobro_por_sesion_habilitado is False and self.cobro_por_paquete_habilitado is False:
            raise ValueError("Debe habilitar al menos una modalidad de cobro")
        return self


class ServicioPublicOut(BaseModel):
    id: int
    nombre: str
    descripcion: Optional[str] = None
    tipo_agenda: TipoAgendaEnum
    modalidad: ModalidadEnum
    duracion_minutos: int
    cupo_maximo: int
    precio: Optional[Decimal] = None
    moneda: str
    imagen_url: Optional[str] = None
    tiene_sesiones_abiertas: bool = False
    model_config = ConfigDict(from_attributes=True)


class TenantPublicOut(BaseModel):
    id: int
    slug: str
    nombre: str
    logo_url: Optional[str] = None
    color_primario: str
    model_config = ConfigDict(from_attributes=True)


class ServicioAdminOut(BaseModel):
    id: int
    sede_id: Optional[int] = None
    nombre: str
    descripcion: Optional[str] = None
    categoria: Optional[str] = None
    color: str
    slug: Optional[str] = None
    tipo_agenda: TipoAgendaEnum
    modalidad: ModalidadEnum
    duracion_minutos: int
    buffer_antes_min: int
    buffer_despues_min: int
    cupo_minimo: int
    cupo_maximo: int
    precio: Optional[Decimal] = None
    moneda: str
    pago_requerido: bool
    cobro_por_sesion_habilitado: bool = True
    cobro_por_paquete_habilitado: bool = False
    precio_paquete: Optional[Decimal] = None
    requiere_confirmacion: bool = False
    permite_solicitudes: bool = False
    encuesta_satisfaccion_formulario_id: Optional[int] = None
    visible_web: bool
    activo: bool
    creado_en: datetime
    actualizado_en: datetime
    model_config = ConfigDict(from_attributes=True)


class HorarioAsesorOut(BaseModel):
    id: int
    dia_semana: int
    hora_inicio: time
    hora_fin: time
    activo: bool
    creado_en: datetime
    model_config = ConfigDict(from_attributes=True)


class AsesorServicioOut(BaseModel):
    id: int
    usuario_tenant_id: int
    servicio_id: int
    servicio_nombre: str
    precio_custom: Optional[Decimal] = None
    duracion_custom_min: Optional[int] = None
    activo: bool
    model_config = ConfigDict(from_attributes=True)


class TipoBloqueoEnum(str, Enum):
    VACACIONES = "vacaciones"
    FERIADO = "feriado"
    MANTENIMIENTO = "mantenimiento"
    PERSONAL = "personal"
    OTRO = "otro"


class BloqueoCreate(BaseModel):
    entidad_tipo: str = "asesor"
    entidad_id: Optional[int] = Field(None, gt=0)
    fecha_inicio: datetime
    fecha_fin: datetime
    motivo: Optional[str] = Field(None, max_length=255)
    tipo: TipoBloqueoEnum = TipoBloqueoEnum.PERSONAL
    model_config = ConfigDict(extra="forbid")

    @field_validator("fecha_inicio", "fecha_fin")
    @classmethod
    def _exigir_aware(cls, v: datetime, info):
        return exigir_aware(v, info.field_name)

    @model_validator(mode="after")
    def _validar(self):
        if self.entidad_tipo == "global":
            if self.entidad_id is not None:
                raise ValueError("Un bloqueo global no lleva entidad_id")
        elif self.entidad_id is None:
            raise ValueError("entidad_id es obligatorio para este entidad_tipo")
        if self.fecha_fin <= self.fecha_inicio:
            raise ValueError("fecha_fin debe ser posterior a fecha_inicio")
        return self


class BloqueoOut(BaseModel):
    id: int
    entidad_tipo: Optional[str] = None
    entidad_id: Optional[int] = None
    fecha_inicio: datetime
    fecha_fin: datetime
    motivo: Optional[str] = None
    tipo: str
    creado_en: datetime
    model_config = ConfigDict(from_attributes=True)
