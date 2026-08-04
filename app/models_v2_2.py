"""
models_v2_2.py — SQLAlchemy 2.0 · PostgreSQL
v2.2.1: checked_in, codigo_confirmacion UNIQUE, encriptación de secrets,
        EncryptedText/EncryptedJSON TypeDecorators.
"""

import os
import json
from datetime import datetime, date, time, timezone
from decimal import Decimal
from typing import Optional, List
from enum import Enum as PyEnum

from sqlalchemy import (
    String, Integer, Boolean, Text, DateTime, Date, Time, Numeric,
    JSON, ForeignKey, CheckConstraint, UniqueConstraint, Index, text,
    Enum as SQLEnum, func, TypeDecorator
)
from sqlalchemy.orm import (
    DeclarativeBase, Mapped, mapped_column, relationship, declared_attr
)


# ============================================================
# ENCRIPTACIÓN DE SECRETS
# ============================================================
class EncryptedText(TypeDecorator):
    impl = Text
    cache_ok = True

    def __init__(self, **kw):
        super().__init__(**kw)
        key = os.environ.get("TENANT_SECRETS_KEY")
        if not key:
            raise RuntimeError("Variable TENANT_SECRETS_KEY requerida en entorno")
        try:
            from cryptography.fernet import Fernet
            self._fernet = Fernet(key.encode() if isinstance(key, str) else key)
        except ImportError as exc:
            raise RuntimeError("Instalar cryptography para encriptación de secrets") from exc

    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        return self._fernet.encrypt(value.encode()).decode()

    def process_result_value(self, value, dialect):
        if value is None:
            return None
        return self._fernet.decrypt(value.encode()).decode()


class EncryptedJSON(TypeDecorator):
    impl = JSON
    cache_ok = True

    def __init__(self, **kw):
        super().__init__(**kw)
        key = os.environ.get("TENANT_SECRETS_KEY")
        if not key:
            raise RuntimeError("Variable TENANT_SECRETS_KEY requerida en entorno")
        try:
            from cryptography.fernet import Fernet
            self._fernet = Fernet(key.encode() if isinstance(key, str) else key)
        except ImportError as exc:
            raise RuntimeError("Instalar cryptography para encriptación de secrets") from exc

    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        return self._fernet.encrypt(json.dumps(value).encode()).decode()

    def process_result_value(self, value, dialect):
        if value is None:
            return None
        return json.loads(self._fernet.decrypt(value.encode()).decode())


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Base(DeclarativeBase):
    pass


# ============================================================
# ENUMS
# ============================================================
class PlanTenant(str, PyEnum):
    STARTER = "starter"; PRO = "pro"; ENTERPRISE = "enterprise"


class RolUsuario(str, PyEnum):
    CLIENTE = "cliente"; ASESOR = "asesor"; ADMIN = "admin"; SUPERADMIN = "superadmin"


class TipoAgenda(str, PyEnum):
    INDIVIDUAL = "individual"; GRUPAL = "grupal"; RECURRENTE = "recurrente"


class Modalidad(str, PyEnum):
    PRESENCIAL = "presencial"; VIRTUAL = "virtual"; HIBRIDA = "hibrida"


class EstadoReserva(str, PyEnum):
    PENDIENTE = "pendiente"
    EN_ESPERA = "en_espera"
    CONFIRMADA = "confirmada"
    CANCELADA = "cancelada"
    NO_SHOW = "no_show"
    COMPLETADA = "completada"


class EstadoSesion(str, PyEnum):
    ABIERTA = "abierta"; CONFIRMADA = "confirmada"; LLENA = "llena"
    CANCELADA = "cancelada"; COMPLETADA = "completada"


class TipoFlujo(str, PyEnum):
    AUTO = "auto"; MANUAL = "manual"


class Canal(str, PyEnum):
    WEB = "web"; ADMIN = "admin"; WHATSAPP = "whatsapp"; API = "api"


class MetodoPago(str, PyEnum):
    ONLINE = "online"; LOCAL = "local"; REGISTRO = "registro"


class EstadoPagoReserva(str, PyEnum):
    PENDIENTE = "pendiente"; COMPLETADO = "completado"
    REEMBOLSADO = "reembolsado"; EXENTO = "exento"


class MetodoPagoUsado(str, PyEnum):
    STRIPE = "stripe"; MERCADOPAGO = "mercadopago"; EFECTIVO = "efectivo"
    TRANSFERENCIA = "transferencia"; OXXO = "oxxo"; EXENTO = "exento"


class TipoBloqueo(str, PyEnum):
    VACACIONES = "vacaciones"; FERIADO = "feriado"; MANTENIMIENTO = "mantenimiento"
    PERSONAL = "personal"; OTRO = "otro"


class CreadoPorTipo(str, PyEnum):
    ADMIN = "admin"; ALUMNO = "alumno"; SISTEMA = "sistema"


class ModalidadCobro(str, PyEnum):
    SESION = "sesion"; PAQUETE = "paquete"


class EstadoSerie(str, PyEnum):
    ACTIVA = "activa"; COMPLETADA = "completada"; CANCELADA = "cancelada"


class EstadoSolicitud(str, PyEnum):
    PENDIENTE = "pendiente"
    ACEPTADA = "aceptada"
    RECHAZADA = "rechazada"
    CANCELADA = "cancelada"


class TipoCampoFormulario(str, PyEnum):
    TEXTO = "texto"; TEXTAREA = "textarea"; NUMERO = "numero"; EMAIL = "email"
    TELEFONO = "telefono"; FECHA = "fecha"; SELECT = "select"
    MULTISELECT = "multiselect"; CHECKBOX = "checkbox"; RADIO = "radio"
    ARCHIVO = "archivo"; RATING = "rating"


ESTADOS_OCUPAN_CUPO = (
    EstadoReserva.PENDIENTE.value,
    EstadoReserva.EN_ESPERA.value,
    EstadoReserva.CONFIRMADA.value,
)

ESTADOS_SESION_ACTIVA = (
    EstadoSesion.ABIERTA.value,
    EstadoSesion.CONFIRMADA.value,
    EstadoSesion.LLENA.value,
)


# ============================================================
# MIXIN
# ============================================================
class TenantScopedMixin:
    @declared_attr.directive
    def __tablename__(cls) -> str:
        return cls.__name__.lower() + "s"

    tenant_id: Mapped[int] = mapped_column(
        ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True
    )


# ============================================================
# 1. TENANT
# ============================================================
class Tenant(Base):
    __tablename__ = "tenants"
    id: Mapped[int] = mapped_column(primary_key=True)
    slug: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    nombre: Mapped[str] = mapped_column(String(255))
    descripcion: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    activo: Mapped[bool] = mapped_column(default=True)
    plan: Mapped[PlanTenant] = mapped_column(SQLEnum(PlanTenant), default=PlanTenant.STARTER)
    logo_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    color_primario: Mapped[str] = mapped_column(String(7), default="#2563eb")
    nombre_empresa: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    timezone: Mapped[str] = mapped_column(String(64), default="America/Mexico_City")
    locale: Mapped[str] = mapped_column(String(16), default="es_MX")
    moneda: Mapped[str] = mapped_column(String(3), default="MXN")
    asignacion_manual: Mapped[bool] = mapped_column(default=False)
    requiere_pago_previo: Mapped[bool] = mapped_column(default=False)
    metodo_pago_default: Mapped[MetodoPago] = mapped_column(SQLEnum(MetodoPago), default=MetodoPago.LOCAL)
    politica_cancelacion_hs: Mapped[int] = mapped_column(default=24)
    hold_minutos: Mapped[int] = mapped_column(default=15)
    permitir_reagendar: Mapped[bool] = mapped_column(default=True)
    mostrar_precios_web: Mapped[bool] = mapped_column(default=True)
    google_calendar_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    smtp_config: Mapped[Optional[dict]] = mapped_column(EncryptedJSON, nullable=True)
    remitente_correo: Mapped[Optional[str]] = mapped_column(EncryptedText, nullable=True)
    remitente_nombre: Mapped[Optional[str]] = mapped_column(EncryptedText, nullable=True)
    stripe_account_id: Mapped[Optional[str]] = mapped_column(EncryptedText, nullable=True)
    stripe_public_key: Mapped[Optional[str]] = mapped_column(EncryptedText, nullable=True)
    mp_access_token: Mapped[Optional[str]] = mapped_column(EncryptedText, nullable=True)
    mp_public_key: Mapped[Optional[str]] = mapped_column(EncryptedText, nullable=True)

    max_asesores: Mapped[int] = mapped_column(default=5)
    max_sedes: Mapped[int] = mapped_column(default=1)
    max_servicios: Mapped[int] = mapped_column(default=10)
    max_clientes: Mapped[int] = mapped_column(default=500)
    max_reservas_mes: Mapped[int] = mapped_column(default=1000)
    max_reservas_serie: Mapped[int] = mapped_column(default=20)
    config_json: Mapped[dict] = mapped_column(JSON, default=dict, server_default=text("'{}'::json"))
    creado_en: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    actualizado_en: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    __table_args__ = (
        CheckConstraint("politica_cancelacion_hs >= 0", name="ck_tenant_cancelacion_no_negativa"),
        CheckConstraint("hold_minutos > 0", name="ck_tenant_hold_positivo"),
    )

    sedes: Mapped[List["Sede"]] = relationship(back_populates="tenant", cascade="all, delete-orphan")
    servicios: Mapped[List["Servicio"]] = relationship(back_populates="tenant", cascade="all, delete-orphan")
    usuarios_tenant: Mapped[List["UsuarioTenant"]] = relationship(back_populates="tenant", cascade="all, delete-orphan")
    sesiones: Mapped[List["Sesion"]] = relationship(back_populates="tenant", cascade="all, delete-orphan")
    reservas: Mapped[List["Reserva"]] = relationship(back_populates="tenant", cascade="all, delete-orphan")
    beneficiarios: Mapped[List["Beneficiario"]] = relationship(back_populates="tenant", cascade="all, delete-orphan")
    formularios: Mapped[List["Formulario"]] = relationship(back_populates="tenant", cascade="all, delete-orphan")
    bitacoras: Mapped[List["Bitacora"]] = relationship(back_populates="tenant", cascade="all, delete-orphan")
    horarios_disponibilidad: Mapped[List["HorarioDisponibilidad"]] = relationship(back_populates="tenant", cascade="all, delete-orphan")
    horarios_bloqueos: Mapped[List["HorarioBloqueo"]] = relationship(back_populates="tenant", cascade="all, delete-orphan")
    recurso_tipos: Mapped[List["RecursoTipo"]] = relationship(back_populates="tenant", cascade="all, delete-orphan")
    recursos: Mapped[List["Recurso"]] = relationship(back_populates="tenant", cascade="all, delete-orphan")
    configuraciones: Mapped[List["ConfiguracionTenant"]] = relationship(back_populates="tenant", cascade="all, delete-orphan")


# ============================================================
# 2. USUARIO
# ============================================================
class Usuario(Base):
    __tablename__ = "usuarios"
    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    es_invitado: Mapped[bool] = mapped_column(default=False)
    nombre: Mapped[str] = mapped_column(String(100))
    apellido: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    telefono: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    avatar_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    email_verificado: Mapped[bool] = mapped_column(default=False)
    verificado_en: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    ultimo_login_en: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    activo: Mapped[bool] = mapped_column(default=True)
    desactivado_en: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    purgado_en: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    acceso_token_hash: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    acceso_token_expira_en: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    creado_en: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    actualizado_en: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    __table_args__ = (
        CheckConstraint(
            "(es_invitado = true) OR (password_hash IS NOT NULL AND length(password_hash) > 0)",
            name="ck_usuario_password_o_invitado",
        ),
    )

    tenants: Mapped[List["UsuarioTenant"]] = relationship(back_populates="usuario", cascade="all, delete-orphan")
    beneficiarios: Mapped[List["Beneficiario"]] = relationship(back_populates="usuario", cascade="all, delete-orphan")
    reservas_creadas: Mapped[List["Reserva"]] = relationship(foreign_keys="Reserva.creado_por_usuario_id", back_populates="creado_por")
    sesiones_creadas: Mapped[List["Sesion"]] = relationship(foreign_keys="Sesion.creado_por_usuario_id", back_populates="creado_por_usuario")


# ============================================================
# 3. USUARIO_TENANT
# ============================================================
class UsuarioTenant(Base, TenantScopedMixin):
    __tablename__ = "usuario_tenants"
    id: Mapped[int] = mapped_column(primary_key=True)
    usuario_id: Mapped[int] = mapped_column(ForeignKey("usuarios.id", ondelete="CASCADE"))
    rol: Mapped[RolUsuario] = mapped_column(SQLEnum(RolUsuario), default=RolUsuario.CLIENTE)
    activo: Mapped[bool] = mapped_column(default=True)
    horario_asignado: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    comision_porcentaje: Mapped[Optional[Decimal]] = mapped_column(Numeric(5, 2), nullable=True)
    bio: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    metadata_json: Mapped[dict] = mapped_column(JSON, default=dict)
    fecha_vinculacion: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    desvinculado_en: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        UniqueConstraint("usuario_id", "tenant_id", name="uq_usuario_tenant"),
        CheckConstraint(
            "comision_porcentaje IS NULL OR (comision_porcentaje >= 0 AND comision_porcentaje <= 100)",
            name="ck_comision_rango",
        ),
        Index("idx_ut_rol", "tenant_id", "rol"),
    )

    usuario: Mapped["Usuario"] = relationship(back_populates="tenants")
    tenant: Mapped["Tenant"] = relationship(back_populates="usuarios_tenant")
    asesor_servicios: Mapped[List["AsesorServicio"]] = relationship(back_populates="asesor", cascade="all, delete-orphan")
    sesiones_impartidas: Mapped[List["Sesion"]] = relationship(foreign_keys="Sesion.asesor_id", back_populates="asesor")


# ============================================================
# 4. SEDE
# ============================================================
class Sede(Base, TenantScopedMixin):
    __tablename__ = "sedes"
    id: Mapped[int] = mapped_column(primary_key=True)
    nombre: Mapped[str] = mapped_column(String(255))
    direccion: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    direccion_completa: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    coordenadas_lat: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 8), nullable=True)
    coordenadas_lng: Mapped[Optional[Decimal]] = mapped_column(Numeric(11, 8), nullable=True)
    mapa_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    telefono: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    timezone: Mapped[str] = mapped_column(String(64), default="America/Mexico_City")
    activo: Mapped[bool] = mapped_column(default=True)
    creado_en: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    actualizado_en: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    __table_args__ = (
        CheckConstraint(
            "coordenadas_lat IS NULL OR (coordenadas_lat >= -90 AND coordenadas_lat <= 90)",
            name="ck_sede_lat_rango",
        ),
        CheckConstraint(
            "coordenadas_lng IS NULL OR (coordenadas_lng >= -180 AND coordenadas_lng <= 180)",
            name="ck_sede_lng_rango",
        ),
        CheckConstraint(
            "(coordenadas_lat IS NULL) = (coordenadas_lng IS NULL)",
            name="ck_sede_coordenadas_par",
        ),
    )

    tenant: Mapped["Tenant"] = relationship(back_populates="sedes")
    servicios: Mapped[List["Servicio"]] = relationship(back_populates="sede")
    sesiones: Mapped[List["Sesion"]] = relationship(back_populates="sede")
    recursos: Mapped[List["Recurso"]] = relationship(back_populates="sede")


# ============================================================
# 5. SERVICIO
# ============================================================
class Servicio(Base, TenantScopedMixin):
    __tablename__ = "servicios"
    id: Mapped[int] = mapped_column(primary_key=True)
    sede_id: Mapped[Optional[int]] = mapped_column(ForeignKey("sedes.id", ondelete="SET NULL"), nullable=True)
    nombre: Mapped[str] = mapped_column(String(255))
    descripcion: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    categoria: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    color: Mapped[str] = mapped_column(String(7), default="#3b82f6")
    slug: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    tipo_agenda: Mapped[TipoAgenda] = mapped_column(SQLEnum(TipoAgenda), default=TipoAgenda.INDIVIDUAL)
    modalidad: Mapped[Modalidad] = mapped_column(SQLEnum(Modalidad), default=Modalidad.VIRTUAL)
    duracion_minutos: Mapped[int] = mapped_column(default=60)
    buffer_antes_min: Mapped[int] = mapped_column(default=0)
    buffer_despues_min: Mapped[int] = mapped_column(default=0)
    cupo_minimo: Mapped[int] = mapped_column(default=1)
    cupo_maximo: Mapped[int] = mapped_column(default=1)
    precio: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 2), nullable=True)
    moneda: Mapped[str] = mapped_column(String(3), default="MXN")
    politica_cancelacion_hs: Mapped[Optional[int]] = mapped_column(nullable=True)
    requiere_confirmacion: Mapped[bool] = mapped_column(default=False)
    permitir_reagendar: Mapped[bool] = mapped_column(default=True)
    visible_web: Mapped[bool] = mapped_column(default=True)
    imagen_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    metodo_pago: Mapped[Optional[MetodoPago]] = mapped_column(SQLEnum(MetodoPago), nullable=True)
    pago_requerido: Mapped[bool] = mapped_column(default=True)
    creacion_por_alumno: Mapped[bool] = mapped_column(default=False)
    formulario_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("formularios.id", ondelete="SET NULL"), nullable=True
    )
    config_json: Mapped[dict] = mapped_column(JSON, default=dict)
    activo: Mapped[bool] = mapped_column(default=True)
    creado_en: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    actualizado_en: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    __table_args__ = (
        UniqueConstraint("tenant_id", "slug", name="uq_servicio_slug_tenant"),
        CheckConstraint("duracion_minutos > 0", name="ck_servicio_duracion_positiva"),
        CheckConstraint("cupo_minimo >= 1", name="ck_servicio_cupo_min"),
        CheckConstraint("cupo_maximo >= cupo_minimo", name="ck_servicio_cupo_coherente"),
        CheckConstraint("precio IS NULL OR precio >= 0", name="ck_servicio_precio_no_negativo"),
        CheckConstraint("buffer_antes_min >= 0 AND buffer_despues_min >= 0", name="ck_servicio_buffers"),
        CheckConstraint(
            "tipo_agenda <> 'INDIVIDUAL' OR cupo_maximo = 1",
            name="ck_servicio_individual_cupo_uno",
        ),
        Index("idx_servicios_categoria", "categoria"),
        Index("idx_servicios_visible", "tenant_id", "visible_web", "activo"),
    )

    tenant: Mapped["Tenant"] = relationship(back_populates="servicios")
    sede: Mapped[Optional["Sede"]] = relationship(back_populates="servicios")
    sesiones: Mapped[List["Sesion"]] = relationship(back_populates="servicio", cascade="all, delete-orphan")
    variantes: Mapped[List["ServicioVariante"]] = relationship(back_populates="servicio", cascade="all, delete-orphan")
    asesor_servicios: Mapped[List["AsesorServicio"]] = relationship(back_populates="servicio", cascade="all, delete-orphan")


# ============================================================
# 6. SESIÓN
# ============================================================
class Sesion(Base, TenantScopedMixin):
    __tablename__ = "sesiones"
    id: Mapped[int] = mapped_column(primary_key=True)
    servicio_id: Mapped[int] = mapped_column(ForeignKey("servicios.id", ondelete="CASCADE"))
    sede_id: Mapped[Optional[int]] = mapped_column(ForeignKey("sedes.id", ondelete="SET NULL"), nullable=True)
    asesor_id: Mapped[Optional[int]] = mapped_column(ForeignKey("usuario_tenants.id", ondelete="RESTRICT"), nullable=True)
    fecha_hora_inicio: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    fecha_hora_fin: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    timezone: Mapped[str] = mapped_column(String(64), default="America/Mexico_City")
    cupo_minimo: Mapped[int] = mapped_column(default=1)
    cupo_maximo: Mapped[int] = mapped_column(default=1)
    inscritos: Mapped[int] = mapped_column(default=0)
    estado: Mapped[EstadoSesion] = mapped_column(SQLEnum(EstadoSesion), default=EstadoSesion.ABIERTA)
    creado_por_usuario_id: Mapped[int] = mapped_column(ForeignKey("usuarios.id", ondelete="RESTRICT"))
    creado_por_tipo: Mapped[CreadoPorTipo] = mapped_column(SQLEnum(CreadoPorTipo), default=CreadoPorTipo.ADMIN)
    meet_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    meet_generado_auto: Mapped[bool] = mapped_column(default=False)
    google_event_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    ics_uid: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    notas_internas: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    metadata_json: Mapped[dict] = mapped_column(JSON, default=dict)
    version_id: Mapped[int] = mapped_column(default=1, nullable=False)
    creado_en: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    actualizado_en: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    __mapper_args__ = {"version_id_col": version_id}

    __table_args__ = (
        CheckConstraint("fecha_hora_fin > fecha_hora_inicio", name="ck_sesion_rango_valido"),
        CheckConstraint("cupo_minimo >= 1", name="ck_sesion_cupo_min"),
        CheckConstraint("cupo_maximo >= cupo_minimo", name="ck_sesion_cupo_coherente"),
        CheckConstraint("inscritos >= 0 AND inscritos <= cupo_maximo", name="ck_sesion_inscritos_cupo"),
        Index("idx_sesiones_servicio", "servicio_id"),
        Index("idx_sesiones_fecha", "tenant_id", "fecha_hora_inicio"),
        Index("idx_sesiones_estado", "tenant_id", "estado"),
        Index("idx_sesiones_asesor", "tenant_id", "asesor_id", "fecha_hora_inicio"),
    )

    tenant: Mapped["Tenant"] = relationship(back_populates="sesiones")
    servicio: Mapped["Servicio"] = relationship(back_populates="sesiones")
    sede: Mapped[Optional["Sede"]] = relationship(back_populates="sesiones")
    asesor: Mapped[Optional["UsuarioTenant"]] = relationship(foreign_keys=[asesor_id], back_populates="sesiones_impartidas")
    creado_por_usuario: Mapped["Usuario"] = relationship(foreign_keys=[creado_por_usuario_id], back_populates="sesiones_creadas")
    reservas: Mapped[List["Reserva"]] = relationship(back_populates="sesion", cascade="all, delete-orphan")


# ============================================================
# 7. RESERVA
# ============================================================
class Reserva(Base, TenantScopedMixin):
    __tablename__ = "reservas"
    id: Mapped[int] = mapped_column(primary_key=True)
    sesion_id: Mapped[int] = mapped_column(ForeignKey("sesiones.id", ondelete="CASCADE"))
    servicio_id: Mapped[int] = mapped_column(ForeignKey("servicios.id", ondelete="RESTRICT"))
    creado_por_usuario_id: Mapped[int] = mapped_column(ForeignKey("usuarios.id", ondelete="RESTRICT"))
    beneficiario_id: Mapped[Optional[int]] = mapped_column(ForeignKey("beneficiarios.id", ondelete="SET NULL"), nullable=True)
    estado: Mapped[EstadoReserva] = mapped_column(SQLEnum(EstadoReserva), default=EstadoReserva.PENDIENTE)
    tipo_flujo: Mapped[TipoFlujo] = mapped_column(SQLEnum(TipoFlujo), default=TipoFlujo.AUTO)
    hold_expira_en: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    codigo_confirmacion: Mapped[str] = mapped_column(String(16))
    folio: Mapped[str] = mapped_column(String(32))
    notas_cliente: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    precio_final: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 2), nullable=True)
    descuento_aplicado: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=Decimal("0.00"))
    moneda: Mapped[str] = mapped_column(String(3), default="MXN")
    estado_pago: Mapped[EstadoPagoReserva] = mapped_column(SQLEnum(EstadoPagoReserva), default=EstadoPagoReserva.PENDIENTE)
    metodo_pago_usado: Mapped[Optional[MetodoPagoUsado]] = mapped_column(SQLEnum(MetodoPagoUsado), nullable=True)
    referencia_pago: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    comprobante_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    pagado_en: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    canal: Mapped[Canal] = mapped_column(SQLEnum(Canal), default=Canal.WEB)
    cancelado_por: Mapped[Optional[int]] = mapped_column(ForeignKey("usuarios.id", ondelete="SET NULL"), nullable=True)
    cancelado_en: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    motivo_cancelacion: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    checked_in: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    metadata_json: Mapped[dict] = mapped_column(JSON, default=dict)
    serie_id: Mapped[Optional[int]] = mapped_column(ForeignKey("series_reservas.id", ondelete="SET NULL"), nullable=True)
    inscripcion_id: Mapped[Optional[int]] = mapped_column(ForeignKey("inscripciones_serie.id", ondelete="SET NULL"), nullable=True)
    modalidad_cobro: Mapped[Optional[ModalidadCobro]] = mapped_column(SQLEnum(ModalidadCobro), nullable=True)
    creado_en: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    actualizado_en: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    __table_args__ = (
        UniqueConstraint("tenant_id", "folio", name="uq_folio_por_tenant"),
        UniqueConstraint("tenant_id", "codigo_confirmacion", name="uq_codigo_confirmacion_tenant"),
        CheckConstraint("precio_final IS NULL OR precio_final >= 0", name="ck_reserva_precio_no_negativo"),
        CheckConstraint("descuento_aplicado >= 0", name="ck_reserva_descuento_no_negativo"),
        CheckConstraint(
            "estado_pago <> 'COMPLETADO' OR (pagado_en IS NOT NULL AND metodo_pago_usado IS NOT NULL)",
            name="ck_reserva_pago_coherente",
        ),
        CheckConstraint(
            "estado <> 'CANCELADA' OR cancelado_en IS NOT NULL",
            name="ck_reserva_cancelacion_coherente",
        ),
        CheckConstraint(
            "hold_expira_en IS NULL OR estado = 'EN_ESPERA'",
            name="ck_reserva_hold_solo_en_espera",
        ),
        Index("idx_reservas_sesion", "sesion_id"),
        Index("idx_reservas_inscripcion", "inscripcion_id"),
        Index("idx_reservas_estado", "tenant_id", "estado"),
        Index("idx_reservas_folio", "tenant_id", "folio"),
        Index("idx_reservas_cliente", "tenant_id", "creado_por_usuario_id"),
        Index("idx_reservas_pago", "tenant_id", "estado_pago"),
        Index("idx_reservas_hold", "hold_expira_en"),
        Index(
            "uq_reserva_activa_por_usuario_sesion",
            "sesion_id", "creado_por_usuario_id",
            unique=True,
            postgresql_where=text("estado IN ('PENDIENTE','EN_ESPERA','CONFIRMADA')"),
        ),
    )

    tenant: Mapped["Tenant"] = relationship(back_populates="reservas")
    sesion: Mapped["Sesion"] = relationship(back_populates="reservas")
    servicio: Mapped["Servicio"] = relationship()
    creado_por: Mapped["Usuario"] = relationship(foreign_keys=[creado_por_usuario_id], back_populates="reservas_creadas")
    beneficiario: Mapped[Optional["Beneficiario"]] = relationship(back_populates="reservas")
    serie: Mapped[Optional["SerieReserva"]] = relationship(back_populates="reservas")
    inscripcion: Mapped[Optional["InscripcionSerie"]] = relationship(back_populates="reservas")
    respuestas_formulario: Mapped[List["RespuestaFormulario"]] = relationship(back_populates="reserva", cascade="all, delete-orphan")
    integrantes: Mapped[List["ReservaIntegrante"]] = relationship(back_populates="reserva", cascade="all, delete-orphan")


# ============================================================
# 7b. SOLICITUD DE RESERVA — confirmación manual (Sprint 2 #10)
# Tabla NUEVA, separada de Reserva/Sesion (decisión con Daniel).
# Se convierte en Reserva/Sesion real solo al aceptarla.
# ============================================================
class SolicitudReserva(Base, TenantScopedMixin):
    __tablename__ = "solicitudes_reserva"
    id: Mapped[int] = mapped_column(primary_key=True)
    servicio_id: Mapped[int] = mapped_column(ForeignKey("servicios.id", ondelete="RESTRICT"))
    cliente_usuario_id: Mapped[int] = mapped_column(ForeignKey("usuarios.id", ondelete="RESTRICT"))
    fecha_hora_propuesta: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    duracion_minutos: Mapped[int]
    notas_cliente: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    estado: Mapped[EstadoSolicitud] = mapped_column(SQLEnum(EstadoSolicitud), default=EstadoSolicitud.PENDIENTE)
    asesor_id: Mapped[Optional[int]] = mapped_column(ForeignKey("usuario_tenants.id", ondelete="SET NULL"), nullable=True)
    motivo_rechazo: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    reserva_id: Mapped[Optional[int]] = mapped_column(ForeignKey("reservas.id", ondelete="SET NULL"), nullable=True)
    serie_id: Mapped[Optional[int]] = mapped_column(ForeignKey("series_reservas.id", ondelete="SET NULL"), nullable=True)
    resuelto_por_id: Mapped[Optional[int]] = mapped_column(ForeignKey("usuario_tenants.id", ondelete="SET NULL"), nullable=True)
    resuelto_en: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    creado_en: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    __table_args__ = (
        Index("idx_solicitudes_estado", "tenant_id", "estado"),
        Index("idx_solicitudes_cliente", "tenant_id", "cliente_usuario_id", "creado_en"),
    )


# ============================================================
# 7c. INSCRIPCIÓN A SERIE — cliente inscrito a un patrón recurrente
# Cada inscripción genera N reservas independientes para ese cliente.
# ============================================================
class InscripcionSerie(Base):
    __tablename__ = "inscripciones_serie"
    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[int] = mapped_column(ForeignKey("tenants.id", ondelete="CASCADE"))
    serie_id: Mapped[int] = mapped_column(ForeignKey("series_reservas.id", ondelete="CASCADE"))
    cliente_usuario_id: Mapped[int] = mapped_column(ForeignKey("usuarios.id", ondelete="RESTRICT"))
    modalidad_cobro: Mapped[ModalidadCobro] = mapped_column(SQLEnum(ModalidadCobro), nullable=False)
    creado_en: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    __table_args__ = (
        UniqueConstraint("serie_id", "cliente_usuario_id", name="uq_inscripcion_serie_cliente"),
        CheckConstraint("modalidad_cobro IN ('SESION', 'PAQUETE')", name="ck_inscripcion_modalidad"),
        Index("idx_inscripciones_serie_serie", "serie_id"),
        Index("idx_inscripciones_serie_cliente", "tenant_id", "cliente_usuario_id"),
    )

    tenant: Mapped["Tenant"] = relationship()
    serie: Mapped["SerieReserva"] = relationship(back_populates="inscripciones")
    cliente: Mapped["Usuario"] = relationship()
    reservas: Mapped[List["Reserva"]] = relationship(back_populates="inscripcion")


# ============================================================
# 7d. SERIE DE RESERVAS — patrón de horario recurrente (Sprint 2 #11)
# Ya no guarda cliente ni precio: eso vive en InscripcionSerie.
# Cada reserva mantiene su ciclo de vida individual.
# ============================================================
class SerieReserva(Base, TenantScopedMixin):
    __tablename__ = "series_reservas"
    id: Mapped[int] = mapped_column(primary_key=True)
    servicio_id: Mapped[int] = mapped_column(ForeignKey("servicios.id", ondelete="RESTRICT"))
    asesor_id: Mapped[Optional[int]] = mapped_column(ForeignKey("usuario_tenants.id", ondelete="SET NULL"), nullable=True)

    # Patrón de recurrencia
    frecuencia: Mapped[str] = mapped_column(String(20))  # "semanal", "quincenal", "mensual"
    dia_semana: Mapped[Optional[int]] = mapped_column(nullable=True)  # 0=lunes, 6=domingo
    hora_inicio: Mapped[time] = mapped_column(Time)
    duracion_minutos: Mapped[int] = mapped_column(default=60)
    num_repeticiones: Mapped[int] = mapped_column(default=1)
    fecha_inicio: Mapped[date] = mapped_column(Date)

    # Modalidades de cobro habilitadas por admin
    cobro_por_sesion_habilitado: Mapped[bool] = mapped_column(default=True)
    cobro_por_paquete_habilitado: Mapped[bool] = mapped_column(default=False)
    precio_paquete: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 2), nullable=True)

    # Estado
    estado: Mapped[EstadoSerie] = mapped_column(SQLEnum(EstadoSerie), default=EstadoSerie.ACTIVA)
    creado_en: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    actualizado_en: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    __table_args__ = (
        CheckConstraint("num_repeticiones >= 1", name="ck_serie_repeticiones_minimo"),
        CheckConstraint("num_repeticiones <= 50", name="ck_serie_repeticiones_maximo"),
        CheckConstraint("dia_semana IS NULL OR (dia_semana >= 0 AND dia_semana <= 6)", name="ck_serie_dia_semana_rango"),
        CheckConstraint("duracion_minutos > 0", name="ck_serie_duracion_positiva"),
        CheckConstraint("precio_paquete IS NULL OR precio_paquete >= 0", name="ck_serie_precio_no_negativo"),
        Index("idx_series_estado", "tenant_id", "estado"),
    )

    tenant: Mapped["Tenant"] = relationship()
    servicio: Mapped["Servicio"] = relationship()
    asesor: Mapped[Optional["UsuarioTenant"]] = relationship()
    reservas: Mapped[List["Reserva"]] = relationship(back_populates="serie")
    inscripciones: Mapped[List["InscripcionSerie"]] = relationship(back_populates="serie")


# ============================================================
# 8. BENEFICIARIO
# ============================================================
class Beneficiario(Base, TenantScopedMixin):
    __tablename__ = "beneficiarios"
    id: Mapped[int] = mapped_column(primary_key=True)
    usuario_id: Mapped[int] = mapped_column(ForeignKey("usuarios.id", ondelete="CASCADE"))
    tipo: Mapped[str] = mapped_column(String(32), default="self")
    nombre: Mapped[str] = mapped_column(String(255))
    metadata_json: Mapped[dict] = mapped_column(JSON, default=dict)
    activo: Mapped[bool] = mapped_column(default=True)
    creado_en: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    __table_args__ = (
        CheckConstraint("tipo IN ('self','tercero','otro')", name="ck_beneficiario_tipo"),
    )

    tenant: Mapped["Tenant"] = relationship(back_populates="beneficiarios")
    usuario: Mapped["Usuario"] = relationship(back_populates="beneficiarios")
    reservas: Mapped[List["Reserva"]] = relationship(back_populates="beneficiario")


# ============================================================
# 9. HORARIOS
# ============================================================
class HorarioDisponibilidad(Base, TenantScopedMixin):
    __tablename__ = "horario_disponibilidad"
    id: Mapped[int] = mapped_column(primary_key=True)
    entidad_tipo: Mapped[str] = mapped_column(String(32))
    entidad_id: Mapped[int]
    dia_semana: Mapped[int] = mapped_column(default=0)
    hora_inicio: Mapped[time] = mapped_column(Time)
    hora_fin: Mapped[time] = mapped_column(Time)
    fecha_especifica: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    activo: Mapped[bool] = mapped_column(default=True)
    creado_en: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    __table_args__ = (
        CheckConstraint("dia_semana BETWEEN 0 AND 6", name="ck_dia_semana"),
        CheckConstraint("hora_fin > hora_inicio", name="ck_hd_rango_valido"),
        CheckConstraint("entidad_tipo IN ('asesor','recurso','servicio')", name="ck_hd_entidad_tipo"),
        Index("idx_hd_entidad", "tenant_id", "entidad_tipo", "entidad_id", "dia_semana"),
        Index("idx_hd_dia", "dia_semana", "activo"),
    )
    tenant: Mapped["Tenant"] = relationship(back_populates="horarios_disponibilidad")


class HorarioBloqueo(Base, TenantScopedMixin):
    __tablename__ = "horario_bloqueos"
    id: Mapped[int] = mapped_column(primary_key=True)
    entidad_tipo: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    entidad_id: Mapped[Optional[int]] = mapped_column(nullable=True)
    fecha_inicio: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    fecha_fin: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    motivo: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    tipo: Mapped[TipoBloqueo] = mapped_column(SQLEnum(TipoBloqueo), default=TipoBloqueo.VACACIONES)
    creado_en: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    __table_args__ = (
        CheckConstraint("fecha_fin > fecha_inicio", name="ck_hb_rango_valido"),
        CheckConstraint(
            "entidad_tipo IS NULL OR entidad_tipo IN ('asesor','recurso','sede','global')",
            name="ck_hb_entidad_tipo",
        ),
        CheckConstraint(
            "(entidad_tipo = 'global' AND entidad_id IS NULL) OR "
            "(entidad_tipo <> 'global' AND entidad_id IS NOT NULL)",
            name="ck_hb_entidad_explicita",
        ),
        Index("idx_hb_rango", "tenant_id", "fecha_inicio", "fecha_fin"),
    )
    tenant: Mapped["Tenant"] = relationship(back_populates="horarios_bloqueos")


# ============================================================
# 10. FORMULARIOS
# ============================================================
class Formulario(Base, TenantScopedMixin):
    __tablename__ = "formularios"
    id: Mapped[int] = mapped_column(primary_key=True)
    servicio_id: Mapped[Optional[int]] = mapped_column(ForeignKey("servicios.id", ondelete="CASCADE"), nullable=True)
    nombre: Mapped[str] = mapped_column(String(255))
    activo: Mapped[bool] = mapped_column(default=True)
    creado_en: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    tenant: Mapped["Tenant"] = relationship(back_populates="formularios")
    campos: Mapped[List["CampoFormulario"]] = relationship(back_populates="formulario", cascade="all, delete-orphan")


class CampoFormulario(Base):
    __tablename__ = "campo_formularios"
    id: Mapped[int] = mapped_column(primary_key=True)
    formulario_id: Mapped[int] = mapped_column(ForeignKey("formularios.id", ondelete="CASCADE"))
    orden: Mapped[int] = mapped_column(default=0)
    tipo: Mapped[TipoCampoFormulario] = mapped_column(SQLEnum(TipoCampoFormulario))
    label: Mapped[str] = mapped_column(String(255))
    placeholder: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    requerido: Mapped[bool] = mapped_column(default=False)
    opciones: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    validacion_regex: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    ayuda: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    activo: Mapped[bool] = mapped_column(default=True)
    creado_en: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    __table_args__ = (Index("idx_cf_formulario", "formulario_id", "orden"),)
    formulario: Mapped["Formulario"] = relationship(back_populates="campos")
    respuestas: Mapped[List["RespuestaFormulario"]] = relationship(back_populates="campo", cascade="all, delete-orphan")


class RespuestaFormulario(Base):
    __tablename__ = "respuesta_formularios"
    id: Mapped[int] = mapped_column(primary_key=True)
    reserva_id: Mapped[int] = mapped_column(ForeignKey("reservas.id", ondelete="CASCADE"))
    campo_id: Mapped[int] = mapped_column(ForeignKey("campo_formularios.id", ondelete="RESTRICT"))
    valor: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    archivo_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    creado_en: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    __table_args__ = (UniqueConstraint("reserva_id", "campo_id", name="uq_respuesta_campo"),)
    reserva: Mapped["Reserva"] = relationship(back_populates="respuestas_formulario")
    campo: Mapped["CampoFormulario"] = relationship(back_populates="respuestas")


# ============================================================
# 11. BITÁCORA
# ============================================================
class Bitacora(Base, TenantScopedMixin):
    __tablename__ = "bitacoras"
    id: Mapped[int] = mapped_column(primary_key=True)
    usuario_id: Mapped[Optional[int]] = mapped_column(ForeignKey("usuarios.id", ondelete="SET NULL"), nullable=True)
    entidad_tipo: Mapped[str] = mapped_column(String(64))
    entidad_id: Mapped[int]
    accion: Mapped[str] = mapped_column(String(64))
    detalles_json: Mapped[dict] = mapped_column(JSON, default=dict)
    ip_address: Mapped[Optional[str]] = mapped_column(String(45), nullable=True)
    user_agent: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    creado_en: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    __table_args__ = (
        Index("idx_bitacoras_entidad", "tenant_id", "entidad_tipo", "entidad_id"),
        Index("idx_bitacoras_fecha", "tenant_id", "creado_en"),
    )
    tenant: Mapped["Tenant"] = relationship(back_populates="bitacoras")


# ============================================================
# 12. PUENTE Y AUXILIARES
# ============================================================
class RecursoTipo(Base, TenantScopedMixin):
    __tablename__ = "recurso_tipos"
    id: Mapped[int] = mapped_column(primary_key=True)
    nombre: Mapped[str] = mapped_column(String(100))
    descripcion: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    icono: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    creado_en: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    tenant: Mapped["Tenant"] = relationship(back_populates="recurso_tipos")
    recursos: Mapped[List["Recurso"]] = relationship(back_populates="tipo", cascade="all, delete-orphan")


class Recurso(Base, TenantScopedMixin):
    __tablename__ = "recursos"
    id: Mapped[int] = mapped_column(primary_key=True)
    recurso_tipo_id: Mapped[int] = mapped_column(ForeignKey("recurso_tipos.id", ondelete="RESTRICT"))
    sede_id: Mapped[Optional[int]] = mapped_column(ForeignKey("sedes.id", ondelete="SET NULL"), nullable=True)
    nombre: Mapped[str] = mapped_column(String(255))
    ubicacion_detalle: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    estado: Mapped[str] = mapped_column(String(32), default="disponible")
    capacidad: Mapped[int] = mapped_column(default=1)
    metadata_json: Mapped[dict] = mapped_column(JSON, default=dict)
    creado_en: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    __table_args__ = (CheckConstraint("capacidad >= 1", name="ck_recurso_capacidad"),)
    tenant: Mapped["Tenant"] = relationship(back_populates="recursos")
    tipo: Mapped["RecursoTipo"] = relationship(back_populates="recursos")
    sede: Mapped[Optional["Sede"]] = relationship(back_populates="recursos")


class ServicioVariante(Base):
    __tablename__ = "servicio_variantes"
    id: Mapped[int] = mapped_column(primary_key=True)
    servicio_id: Mapped[int] = mapped_column(ForeignKey("servicios.id", ondelete="CASCADE"))
    nombre_variante: Mapped[str] = mapped_column(String(100))
    duracion_minutos: Mapped[int]
    precio: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 2), nullable=True)
    activo: Mapped[bool] = mapped_column(default=True)
    creado_en: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    __table_args__ = (
        CheckConstraint("duracion_minutos > 0", name="ck_variante_duracion"),
        CheckConstraint("precio IS NULL OR precio >= 0", name="ck_variante_precio"),
    )
    servicio: Mapped["Servicio"] = relationship(back_populates="variantes")


class AsesorServicio(Base):
    __tablename__ = "asesor_servicios"
    id: Mapped[int] = mapped_column(primary_key=True)
    usuario_tenant_id: Mapped[int] = mapped_column(ForeignKey("usuario_tenants.id", ondelete="CASCADE"))
    servicio_id: Mapped[int] = mapped_column(ForeignKey("servicios.id", ondelete="CASCADE"))
    precio_custom: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 2), nullable=True)
    duracion_custom_min: Mapped[Optional[int]] = mapped_column(nullable=True)
    activo: Mapped[bool] = mapped_column(default=True)
    __table_args__ = (
        UniqueConstraint("usuario_tenant_id", "servicio_id", name="uq_asesor_servicio"),
        CheckConstraint("precio_custom IS NULL OR precio_custom >= 0", name="ck_as_precio"),
        CheckConstraint("duracion_custom_min IS NULL OR duracion_custom_min > 0", name="ck_as_duracion"),
    )
    asesor: Mapped["UsuarioTenant"] = relationship(back_populates="asesor_servicios")
    servicio: Mapped["Servicio"] = relationship(back_populates="asesor_servicios")


class ServicioRecurso(Base):
    __tablename__ = "servicio_recursos"
    id: Mapped[int] = mapped_column(primary_key=True)
    servicio_id: Mapped[int] = mapped_column(ForeignKey("servicios.id", ondelete="CASCADE"))
    recurso_tipo_id: Mapped[int] = mapped_column(ForeignKey("recurso_tipos.id", ondelete="CASCADE"))
    cantidad_requerida: Mapped[int] = mapped_column(default=1)
    __table_args__ = (
        UniqueConstraint("servicio_id", "recurso_tipo_id", name="uq_servicio_recurso"),
        CheckConstraint("cantidad_requerida >= 1", name="ck_sr_cantidad"),
    )


class ReservaIntegrante(Base):
    __tablename__ = "reserva_integrantes"
    id: Mapped[int] = mapped_column(primary_key=True)
    reserva_id: Mapped[int] = mapped_column(ForeignKey("reservas.id", ondelete="CASCADE"))
    usuario_id: Mapped[Optional[int]] = mapped_column(ForeignKey("usuarios.id", ondelete="SET NULL"), nullable=True)
    nombre_externo: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    email_externo: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    telefono_externo: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    confirmado: Mapped[bool] = mapped_column(default=False)
    asistio: Mapped[Optional[bool]] = mapped_column(nullable=True)
    respuestas_json: Mapped[dict] = mapped_column(JSON, default=dict)
    creado_en: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    __table_args__ = (
        CheckConstraint(
            "usuario_id IS NOT NULL OR (nombre_externo IS NOT NULL AND email_externo IS NOT NULL)",
            name="ck_integrante_identificado",
        ),
    )
    reserva: Mapped["Reserva"] = relationship(back_populates="integrantes")


class ReservaRecurso(Base):
    __tablename__ = "reserva_recursos"
    id: Mapped[int] = mapped_column(primary_key=True)
    reserva_id: Mapped[int] = mapped_column(ForeignKey("reservas.id", ondelete="CASCADE"))
    recurso_id: Mapped[int] = mapped_column(ForeignKey("recursos.id", ondelete="RESTRICT"))
    __table_args__ = (UniqueConstraint("reserva_id", "recurso_id", name="uq_reserva_recurso"),)


class ConfiguracionTenant(Base, TenantScopedMixin):
    __tablename__ = "configuracion_tenants"
    id: Mapped[int] = mapped_column(primary_key=True)
    categoria: Mapped[str] = mapped_column(String(64))
    clave: Mapped[str] = mapped_column(String(128))
    valor: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    tipo_dato: Mapped[str] = mapped_column(String(32), default="string")
    __table_args__ = (UniqueConstraint("tenant_id", "categoria", "clave", name="uq_config_tenant"),)
    tenant: Mapped["Tenant"] = relationship(back_populates="configuraciones")
