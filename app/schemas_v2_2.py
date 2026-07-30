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

from datetime import datetime, timezone as dt_timezone
from decimal import Decimal
from typing import Optional, List, Dict, Any
from enum import Enum

from pydantic import BaseModel, EmailStr, Field, field_validator, ConfigDict


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
    creado_en: datetime
    model_config = ConfigDict(from_attributes=True)


class CheckoutUrlOut(BaseModel):
    url: str
    proveedor: str
    expira_en: Optional[datetime] = None


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


class OperacionOut(BaseModel):
    ok: bool
    mensaje: str
    detalle: Optional[Dict[str, Any]] = None


class PaginacionOut(BaseModel):
    total: int
    limit: int
    offset: int


class SesionesPaginadasOut(BaseModel):
    items: List[SesionListOut]
    paginacion: PaginacionOut
