import { useState, useEffect, useCallback } from 'react'
import client from '../../api/client'
import Modal from '../common/Modal'
import HorarioServicio from './HorarioServicio'
import CrearSerieModal from './CrearSerieModal'
import { errorMensaje } from '../../utils/errores'
const TIPO_BADGE = {
  individual: 'border-blue-200 bg-blue-100 text-blue-700',
  grupal: 'border-purple-200 bg-purple-100 text-purple-700',
  recurrente: 'border-orange-200 bg-orange-100 text-orange-700',
}

const TIPO_LABEL = {
  individual: 'Individual',
  grupal: 'Grupal',
  recurrente: 'Recurrente',
}

const TIPOS = [
  { value: 'individual', label: 'Individual' },
  { value: 'grupal', label: 'Grupal' },
  { value: 'recurrente', label: 'Recurrente' },
]

const MODALIDAD_LABEL = {
  presencial: 'Presencial',
  virtual: 'Virtual',
  hibrida: 'Híbrida',
}

const ESTADO_BADGE = {
  true: 'border-green-200 bg-green-100 text-green-700',
  false: 'border-gray-200 bg-gray-100 text-gray-600',
}

const ESTADO_LABEL = {
  true: 'Activo',
  false: 'Inactivo',
}

function normalizarServicio(s) {
  const base = s ?? {}
  const out = { ...base }
  if (out.tipo_agenda == null) out.tipo_agenda = 'individual'
  if (out.modalidad == null) out.modalidad = 'virtual'
  if (out.duracion_minutos == null) out.duracion_minutos = 0
  if (out.cupo_minimo == null) out.cupo_minimo = 1
  if (out.cupo_maximo == null) out.cupo_maximo = 1
  if (out.precio == null) out.precio = null
  if (out.moneda == null) out.moneda = 'MXN'
  if (out.cobro_por_sesion_habilitado == null) out.cobro_por_sesion_habilitado = true
  if (out.cobro_por_paquete_habilitado == null) out.cobro_por_paquete_habilitado = false
  if (out.precio_paquete == null) out.precio_paquete = null
  if (out.activo === undefined) out.activo = true
  return out
}

const MODALIDADES = [
  { value: 'presencial', label: 'Presencial' },
  { value: 'virtual', label: 'Virtual' },
  { value: 'hibrida', label: 'Híbrida' },
]

const MONEDAS = ['MXN', 'USD', 'EUR']

const FORM_VACIO = {
  nombre: '',
  descripcion: '',
  categoria: '',
  tipo_agenda: 'individual',
  modalidad: 'virtual',
  duracion_minutos: 60,
  cupo_minimo: 1,
  cupo_maximo: 1,
  precio: '',
  moneda: 'MXN',
  pago_requerido: true,
  cobro_por_sesion_habilitado: true,
  cobro_por_paquete_habilitado: false,
  precio_paquete: '',
  visible_web: true,
  requiere_confirmacion: false,
  buffer_antes_min: 0,
  buffer_despues_min: 0,
}

function formatPrecio(precio, moneda) {
  if (precio === null || precio === undefined) return '—'
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: moneda ?? 'MXN',
  }).format(Number(precio))
}

function Badge({ value, map, labelMap, color }) {
  const className = color ?? map?.[value] ?? 'border-gray-200 bg-gray-100 text-gray-600'
  const text = labelMap?.[value] ?? value ?? '—'
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${className}`}
    >
      {text}
    </span>
  )
}

export default function GestionServicios({ tenantSlug, token }) {
  const [servicios, setServicios] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [accionError, setAccionError] = useState(null)
  const [toggleLoadingId, setToggleLoadingId] = useState(null)
  const [confirmarDesactivar, setConfirmarDesactivar] = useState(null)
  const [modalAbierto, setModalAbierto] = useState(false)
  const [crearLoading, setCrearLoading] = useState(false)
  const [crearError, setCrearError] = useState(null)
  const [editando, setEditando] = useState(null)
  const [editarLoading, setEditarLoading] = useState(false)
  const [editarError, setEditarError] = useState(null)
  const [horarioDe, setHorarioDe] = useState(null)
  const [franjasNuevas, setFranjasNuevas] = useState([])
  const [form, setForm] = useState(FORM_VACIO)
  const [serieDe, setSerieDe] = useState(null)

  const fetchServicios = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { data, error: fetchErr } = await client.GET(
      '/api/v2/{tenant_slug}/admin/servicios',
      {
        params: { path: { tenant_slug: tenantSlug } },
        headers: { Authorization: `Bearer ${token}` },
      },
    )
    if (fetchErr) {
      setError(errorMensaje(fetchErr))
      setLoading(false)
      return
    }
    setServicios(data ?? [])
    setLoading(false)
  }, [tenantSlug, token])

  useEffect(() => {
    fetchServicios()
  }, [fetchServicios])

  const reintentar = () => {
    setLoading(true)
    setError(null)
    fetchServicios()
  }

  const abrirModal = () => {
    setForm({ ...FORM_VACIO })
    setFranjasNuevas([])
    setCrearError(null)
    setModalAbierto(true)
  }

  const abrirEditar = (s) => {
    setForm({
      nombre: s.nombre,
      descripcion: s.descripcion ?? '',
      categoria: s.categoria ?? '',
      tipo_agenda: s.tipo_agenda,
      modalidad: s.modalidad,
      duracion_minutos: s.duracion_minutos,
      cupo_minimo: s.cupo_minimo,
      cupo_maximo: s.cupo_maximo,
      precio: s.precio === null || s.precio === undefined ? '' : String(s.precio),
      moneda: s.moneda,
      pago_requerido: s.pago_requerido,
      cobro_por_sesion_habilitado: s.cobro_por_sesion_habilitado ?? true,
      cobro_por_paquete_habilitado: s.cobro_por_paquete_habilitado ?? false,
      precio_paquete: s.precio_paquete === null || s.precio_paquete === undefined ? '' : String(s.precio_paquete),
      visible_web: s.visible_web,
      requiere_confirmacion: s.requiere_confirmacion ?? false,
      buffer_antes_min: s.buffer_antes_min,
      buffer_despues_min: s.buffer_despues_min,
    })
    setEditarError(null)
    setEditando(s)
  }

  const setCampo = (campo, valor) => {
    setForm((prev) => {
      if (campo === 'tipo_agenda' && valor === 'individual') {
        return { ...prev, tipo_agenda: valor, cupo_minimo: 1, cupo_maximo: 1 }
      }
      return { ...prev, [campo]: valor }
    })
  }

  const validarForm = () => {
    const duracion = Number(form.duracion_minutos)
    if (!Number.isFinite(duracion) || duracion < 15) {
      return 'La duración debe ser de al menos 15 minutos'
    }
    const cupoMin = Number(form.cupo_minimo)
    const cupoMax = Number(form.cupo_maximo)
    if (!Number.isFinite(cupoMin) || cupoMin < 1) {
      return 'El cupo mínimo debe ser al menos 1'
    }
    if (form.tipo_agenda !== 'individual' && cupoMax < cupoMin) {
      return 'El cupo máximo no puede ser menor que el cupo mínimo'
    }
    if (form.precio !== '' && Number(form.precio) < 0) {
      return 'El precio no puede ser negativo'
    }
    if (form.tipo_agenda !== 'recurrente' && form.cobro_por_paquete_habilitado) {
      return 'El cobro por paquete solo está disponible para servicios recurrentes'
    }
    if (!form.cobro_por_sesion_habilitado && !form.cobro_por_paquete_habilitado) {
      return 'Debe habilitar al menos una modalidad de cobro'
    }
    if (form.cobro_por_paquete_habilitado && form.precio_paquete === '') {
      return 'El precio del paquete es obligatorio cuando el cobro por paquete está habilitado'
    }
    if (form.precio_paquete !== '' && Number(form.precio_paquete) < 0) {
      return 'El precio del paquete no puede ser negativo'
    }
    return null
  }

  const crearServicio = async (e) => {
    e.preventDefault()
    if (crearLoading) return

    const invalido = validarForm()
    if (invalido) {
      setCrearError(invalido)
      return
    }

    const body = {
      nombre: form.nombre.trim(),
      descripcion: form.descripcion.trim() || null,
      categoria: form.categoria.trim() || null,
      tipo_agenda: form.tipo_agenda,
      modalidad: form.modalidad,
      duracion_minutos: Number(form.duracion_minutos),
      cupo_minimo: Number(form.cupo_minimo),
      cupo_maximo: form.tipo_agenda === 'individual' ? 1 : Number(form.cupo_maximo),
      precio: form.precio === '' ? null : Number(form.precio),
      moneda: form.moneda,
      pago_requerido: form.pago_requerido,
      cobro_por_sesion_habilitado: form.cobro_por_sesion_habilitado,
      cobro_por_paquete_habilitado:
        form.tipo_agenda === 'recurrente' ? form.cobro_por_paquete_habilitado : false,
      precio_paquete:
        form.tipo_agenda === 'recurrente' && form.cobro_por_paquete_habilitado && form.precio_paquete !== ''
          ? Number(form.precio_paquete)
          : null,
      visible_web: form.visible_web,
      requiere_confirmacion: form.requiere_confirmacion,
      buffer_antes_min: Number(form.buffer_antes_min),
      buffer_despues_min: Number(form.buffer_despues_min),
    }

    setCrearLoading(true)
    setCrearError(null)
    const { data, error: fetchErr, response } = await client.POST(
      '/api/v2/{tenant_slug}/admin/servicios',
      {
        params: { path: { tenant_slug: tenantSlug } },
        body,
        headers: { Authorization: `Bearer ${token}` },
      },
    )
    setCrearLoading(false)
    if (fetchErr) {
      if (response?.status === 409) {
        setCrearError('Ya existe un servicio con ese slug')
        return
      }
      if (response?.status === 422) {
        setCrearError('Verifica los datos ingresados')
        return
      }
      setCrearError(errorMensaje(fetchErr))
      return
    }
    setServicios((prev) => [data, ...prev])
    setModalAbierto(false)
    setFranjasNuevas([])
    if (franjasNuevas.length > 0) {
      let fallo = null
      for (const f of franjasNuevas) {
        const { error: hErr } = await client.POST(
          '/api/v2/{tenant_slug}/admin/servicios/{servicio_id}/horarios',
          {
            params: { path: { tenant_slug: tenantSlug, servicio_id: data.id } },
            body: f,
            headers: { Authorization: `Bearer ${token}` },
          },
        )
        if (hErr) {
          fallo = errorMensaje(hErr)
          break
        }
      }
      if (fallo) {
        setAccionError(`Servicio creado, pero no se pudo guardar el horario: ${fallo}`)
      }
    }
  }

  const editarServicio = async (e) => {
    e.preventDefault()
    if (editarLoading) return

    const invalido = validarForm()
    if (invalido) {
      setEditarError(invalido)
      return
    }

    const cambios = {}
    if (form.nombre.trim() !== editando.nombre) cambios.nombre = form.nombre.trim()
    if ((form.descripcion.trim() || null) !== editando.descripcion) {
      cambios.descripcion = form.descripcion.trim() || null
    }
    if ((form.categoria.trim() || null) !== editando.categoria) {
      cambios.categoria = form.categoria.trim() || null
    }
    if (form.tipo_agenda !== editando.tipo_agenda) cambios.tipo_agenda = form.tipo_agenda
    if (form.modalidad !== editando.modalidad) cambios.modalidad = form.modalidad
    if (Number(form.duracion_minutos) !== editando.duracion_minutos) {
      cambios.duracion_minutos = Number(form.duracion_minutos)
    }
    if (Number(form.cupo_minimo) !== editando.cupo_minimo) {
      cambios.cupo_minimo = Number(form.cupo_minimo)
    }
    if (form.tipo_agenda !== 'individual') {
      if (Number(form.cupo_maximo) !== editando.cupo_maximo) {
        cambios.cupo_maximo = Number(form.cupo_maximo)
      }
    } else if (editando.cupo_maximo !== 1) {
      cambios.cupo_maximo = 1
    }
    const nuevoPrecio = form.precio === '' ? null : Number(form.precio)
    const precioActual = editando.precio === null ? null : Number(editando.precio)
    if (nuevoPrecio !== precioActual) cambios.precio = nuevoPrecio
    if (form.moneda !== editando.moneda) cambios.moneda = form.moneda
    if (form.pago_requerido !== editando.pago_requerido) cambios.pago_requerido = form.pago_requerido
    if (form.cobro_por_sesion_habilitado !== (editando.cobro_por_sesion_habilitado ?? true)) {
      cambios.cobro_por_sesion_habilitado = form.cobro_por_sesion_habilitado
    }
    const cobroPaqueteEnviar = form.tipo_agenda === 'recurrente' ? form.cobro_por_paquete_habilitado : false
    if (cobroPaqueteEnviar !== (editando.cobro_por_paquete_habilitado ?? false)) {
      cambios.cobro_por_paquete_habilitado = cobroPaqueteEnviar
    }
    const precioPaqueteEnviar =
      form.tipo_agenda === 'recurrente' && cobroPaqueteEnviar && form.precio_paquete !== ''
        ? Number(form.precio_paquete)
        : null
    const precioPaqueteActual = editando.precio_paquete === null ? null : Number(editando.precio_paquete)
    if (precioPaqueteEnviar !== precioPaqueteActual) cambios.precio_paquete = precioPaqueteEnviar
    if (form.visible_web !== editando.visible_web) cambios.visible_web = form.visible_web
    if (form.requiere_confirmacion !== (editando.requiere_confirmacion ?? false)) {
      cambios.requiere_confirmacion = form.requiere_confirmacion
    }
    if (Number(form.buffer_antes_min) !== editando.buffer_antes_min) {
      cambios.buffer_antes_min = Number(form.buffer_antes_min)
    }
    if (Number(form.buffer_despues_min) !== editando.buffer_despues_min) {
      cambios.buffer_despues_min = Number(form.buffer_despues_min)
    }

    if (Object.keys(cambios).length === 0) {
      setEditando(null)
      return
    }

    setEditarLoading(true)
    setEditarError(null)
    const { data, error: fetchErr, response } = await client.PATCH(
      '/api/v2/{tenant_slug}/admin/servicios/{servicio_id}',
      {
        params: { path: { tenant_slug: tenantSlug, servicio_id: editando.id } },
        body: cambios,
        headers: { Authorization: `Bearer ${token}` },
      },
    )
    setEditarLoading(false)
    if (fetchErr) {
      if (response?.status === 409) {
        setEditarError('Ya existe un servicio con ese slug')
        return
      }
      if (response?.status === 422) {
        setEditarError('Verifica los datos ingresados')
        return
      }
      setEditarError(errorMensaje(fetchErr))
      return
    }
    setServicios((prev) => prev.map((x) => (x.id === data.id ? data : x)))
    setEditando(null)
  }

  const activar = async (s) => {
    setToggleLoadingId(s.id)
    setAccionError(null)
    const { data, error: fetchErr } = await client.POST(
      '/api/v2/{tenant_slug}/admin/servicios/{servicio_id}/activar',
      {
        params: { path: { tenant_slug: tenantSlug, servicio_id: s.id } },
        headers: { Authorization: `Bearer ${token}` },
      },
    )
    setToggleLoadingId(null)
    if (fetchErr) {
      setAccionError(errorMensaje(fetchErr))
      return
    }
    setServicios((prev) => prev.map((x) => (x.id === data.detalle.id ? { ...x, activo: true } : x)))
  }

  const desactivar = async (s) => {
    setToggleLoadingId(s.id)
    setAccionError(null)
    const { data, error: fetchErr } = await client.DELETE(
      '/api/v2/{tenant_slug}/admin/servicios/{servicio_id}',
      {
        params: { path: { tenant_slug: tenantSlug, servicio_id: s.id } },
        headers: { Authorization: `Bearer ${token}` },
      },
    )
    setToggleLoadingId(null)
    if (fetchErr) {
      setAccionError(errorMensaje(fetchErr))
      return
    }
    setServicios((prev) => prev.map((x) => (x.id === data.detalle.id ? { ...x, activo: false } : x)))
  }

  function FilaServicio({ s }) {
    try {
      return (
        <tr className="transition hover:bg-gray-50">
          <td className="px-4 py-3">
            <div className="flex items-center gap-2">
              <span
                className="h-3 w-3 shrink-0 rounded-full"
                style={{ backgroundColor: s.color ?? '#3b82f6' }}
              />
              <span className="font-medium text-gray-900">{s.nombre}</span>
            </div>
          </td>
          <td className="px-4 py-3">
            <Badge value={s.tipo_agenda} map={TIPO_BADGE} labelMap={TIPO_LABEL} />
          </td>
          <td className="hidden px-4 py-3 text-gray-700 sm:table-cell">
            {MODALIDAD_LABEL[s.modalidad] ?? s.modalidad}
          </td>
          <td className="whitespace-nowrap px-4 py-3 text-gray-700">
            {s.duracion_minutos} min
          </td>
          <td className="hidden px-4 py-3 text-gray-700 md:table-cell">
            {s.tipo_agenda === 'individual' ? '1:1' : `${s.cupo_minimo}–${s.cupo_maximo}`}
          </td>
          <td className="hidden px-4 py-3 text-gray-700 sm:table-cell">
            {formatPrecio(s.precio, s.moneda)}
          </td>
          <td className="px-4 py-3">
            <Badge value={s.activo} map={ESTADO_BADGE} labelMap={ESTADO_LABEL} />
          </td>
          <td className="whitespace-nowrap px-4 py-3 text-right">
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => abrirEditar(s)}
                className="rounded-lg border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-700 transition hover:bg-gray-50"
              >
                Editar
              </button>
              {s.requiere_confirmacion && (
                <button
                  type="button"
                  onClick={() => setHorarioDe(s)}
                  className="rounded-lg border border-blue-200 px-2.5 py-1 text-xs font-medium text-blue-700 transition hover:bg-blue-50"
                >
                  Horario
                </button>
              )}
              {s.tipo_agenda === 'recurrente' && (
                <button
                  type="button"
                  onClick={() => setSerieDe(s)}
                  className="rounded-lg border border-orange-200 px-2.5 py-1 text-xs font-medium text-orange-700 transition hover:bg-orange-50"
                >
                  Crear Serie
                </button>
              )}
              <button
                type="button"
                role="switch"
                aria-checked={s.activo}
                disabled={toggleLoadingId === s.id}
                onClick={() => (s.activo ? setConfirmarDesactivar(s) : activar(s))}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                  s.activo ? 'bg-green-500' : 'bg-gray-300'
                } disabled:cursor-not-allowed disabled:opacity-50`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition ${
                    s.activo ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </td>
        </tr>
      )
    } catch (err) {
      console.error('Error al renderizar servicio', s?.id, err)
      return (
        <tr>
          <td colSpan={8} className="px-4 py-3 text-red-600">
            Error al mostrar el servicio {s?.id ?? 'desconocido'}
          </td>
        </tr>
      )
    }
  }

  const filas = servicios.map(normalizarServicio)
  const activos = filas.filter((s) => s.activo).length

  if (loading) {
    return (
      <div className="animate-pulse space-y-3">
        <div className="h-10 w-full max-w-xs rounded-lg bg-gray-100" />
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-12 rounded-lg bg-gray-100" />
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
        <p className="mb-1 font-semibold text-red-700">Error al cargar servicios</p>
        <p className="mb-4 text-sm text-red-600">{error}</p>
        <button
          type="button"
          onClick={reintentar}
          className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700"
        >
          Intentar de nuevo
        </button>
      </div>
    )
  }

  return (
    <div className="min-w-0">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-gray-600">
          <span className="font-semibold text-gray-900">{activos}</span> servicios activos
        </p>
        <button
          type="button"
          onClick={abrirModal}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
        >
          Nuevo servicio
        </button>
      </div>

      {accionError && (
        <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {accionError}
        </p>
      )}

      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <th className="px-4 py-3 font-medium">Nombre</th>
              <th className="px-4 py-3 font-medium">Tipo</th>
              <th className="hidden px-4 py-3 font-medium sm:table-cell">Modalidad</th>
              <th className="px-4 py-3 font-medium">Duración</th>
              <th className="hidden px-4 py-3 font-medium md:table-cell">Cupo</th>
              <th className="hidden px-4 py-3 font-medium sm:table-cell">Precio</th>
              <th className="px-4 py-3 font-medium">Estado</th>
              <th className="px-4 py-3 text-right font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filas.map((s) => (
              <FilaServicio key={s.id} s={s} />
            ))}
            {filas.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-gray-500">
                  No hay servicios registrados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {modalAbierto && (
        <Modal title="Nuevo servicio" onClose={() => setModalAbierto(false)} maxWidth="max-w-2xl">
          <form onSubmit={crearServicio} className="space-y-4" noValidate>
            <div>
              <label htmlFor="servicio-nombre" className="mb-1 block text-sm font-medium text-gray-700">
                Nombre *
              </label>
              <input
                id="servicio-nombre"
                type="text"
                required
                value={form.nombre}
                onChange={(e) => setCampo('nombre', e.target.value)}
                placeholder="Ej. Consultoría Individual"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none transition focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="servicio-tipo" className="mb-1 block text-sm font-medium text-gray-700">
                  Tipo de agenda
                </label>
                <select
                  id="servicio-tipo"
                  value={form.tipo_agenda}
                  onChange={(e) => setCampo('tipo_agenda', e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none transition focus:ring-2 focus:ring-blue-500"
                >
                  {TIPOS.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="servicio-modalidad" className="mb-1 block text-sm font-medium text-gray-700">
                  Modalidad
                </label>
                <select
                  id="servicio-modalidad"
                  value={form.modalidad}
                  onChange={(e) => setCampo('modalidad', e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none transition focus:ring-2 focus:ring-blue-500"
                >
                  {MODALIDADES.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4">
              <div>
                <label htmlFor="servicio-duracion" className="mb-1 block text-sm font-medium text-gray-700">
                  Duración (min) *
                </label>
                <input
                  id="servicio-duracion"
                  type="number"
                  min="15"
                  step="5"
                  required
                  value={form.duracion_minutos}
                  onChange={(e) => setCampo('duracion_minutos', e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none transition focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label htmlFor="servicio-cupo-min" className="mb-1 block text-sm font-medium text-gray-700">
                  Cupo mínimo
                </label>
                <input
                  id="servicio-cupo-min"
                  type="number"
                  min="1"
                  disabled={form.tipo_agenda === 'individual'}
                  value={form.cupo_minimo}
                  onChange={(e) => setCampo('cupo_minimo', e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none transition focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400"
                />
              </div>

              <div>
                <label htmlFor="servicio-cupo-max" className="mb-1 block text-sm font-medium text-gray-700">
                  Cupo máximo
                </label>
                <input
                  id="servicio-cupo-max"
                  type="number"
                  min="1"
                  disabled={form.tipo_agenda === 'individual'}
                  value={form.tipo_agenda === 'individual' ? 1 : form.cupo_maximo}
                  onChange={(e) => setCampo('cupo_maximo', e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none transition focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400"
                />
                {form.tipo_agenda === 'individual' && (
                  <p className="mt-1 text-xs text-gray-400">Siempre 1:1</p>
                )}
              </div>

              <div>
                <label htmlFor="servicio-moneda" className="mb-1 block text-sm font-medium text-gray-700">
                  Moneda
                </label>
                <select
                  id="servicio-moneda"
                  value={form.moneda}
                  onChange={(e) => setCampo('moneda', e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none transition focus:ring-2 focus:ring-blue-500"
                >
                  {MONEDAS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label htmlFor="servicio-precio" className="mb-1 block text-sm font-medium text-gray-700">
                  Precio
                </label>
                <input
                  id="servicio-precio"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.precio}
                  onChange={(e) => setCampo('precio', e.target.value)}
                  placeholder="Opcional"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none transition focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label htmlFor="servicio-buffer-antes" className="mb-1 block text-sm font-medium text-gray-700">
                  Buffer antes (min)
                </label>
                <input
                  id="servicio-buffer-antes"
                  type="number"
                  min="0"
                  value={form.buffer_antes_min}
                  onChange={(e) => setCampo('buffer_antes_min', e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none transition focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label htmlFor="servicio-buffer-despues" className="mb-1 block text-sm font-medium text-gray-700">
                  Buffer después (min)
                </label>
                <input
                  id="servicio-buffer-despues"
                  type="number"
                  min="0"
                  value={form.buffer_despues_min}
                  onChange={(e) => setCampo('buffer_despues_min', e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none transition focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label htmlFor="servicio-descripcion" className="mb-1 block text-sm font-medium text-gray-700">
                Descripción
              </label>
              <textarea
                id="servicio-descripcion"
                rows="2"
                value={form.descripcion}
                onChange={(e) => setCampo('descripcion', e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none transition focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={form.pago_requerido}
                  onChange={(e) => setCampo('pago_requerido', e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600"
                />
                Pago requerido
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={form.visible_web}
                  onChange={(e) => setCampo('visible_web', e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600"
                />
                Visible en web
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={form.requiere_confirmacion}
                  onChange={(e) => setCampo('requiere_confirmacion', e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600"
                />
                Requiere confirmación manual
              </label>
            </div>

            {form.tipo_agenda === 'recurrente' && (
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                <p className="mb-2 text-xs font-medium text-gray-500">Modalidades de cobro para series</p>
                <div className="flex flex-wrap gap-4">
                  <label className="flex items-center gap-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={form.cobro_por_sesion_habilitado}
                      onChange={(e) => setCampo('cobro_por_sesion_habilitado', e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 text-blue-600"
                    />
                    Ofrecer pago por sesión
                  </label>
                  <label className="flex items-center gap-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={form.cobro_por_paquete_habilitado}
                      onChange={(e) => setCampo('cobro_por_paquete_habilitado', e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 text-blue-600"
                    />
                    Ofrecer pago por paquete
                  </label>
                </div>
                {form.cobro_por_paquete_habilitado && (
                  <div className="mt-3">
                    <label
                      htmlFor="servicio-precio-paquete"
                      className="mb-1 block text-sm font-medium text-gray-700"
                    >
                      Precio del paquete *
                    </label>
                    <input
                      id="servicio-precio-paquete"
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.precio_paquete}
                      onChange={(e) => setCampo('precio_paquete', e.target.value)}
                      placeholder="Ej. 15000"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none transition focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="mt-1 text-xs text-gray-500">Precio total por todas las sesiones de la serie</p>
                  </div>
                )}
              </div>
            )}

            {form.requiere_confirmacion && (
              <HorarioServicio
                pendiente
                sinModal
                servicio={{ nombre: form.nombre.trim() || 'Nuevo servicio' }}
                onCambio={setFranjasNuevas}
                onClose={() => {}}
              />
            )}

            {crearError && (
              <p
                role="alert"
                className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
              >
                {crearError}
              </p>
            )}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setModalAbierto(false)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={crearLoading}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {crearLoading ? 'Creando...' : 'Crear servicio'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {editando && (
        <Modal title="Editar servicio" onClose={() => setEditando(null)} maxWidth="max-w-2xl">
          <form onSubmit={editarServicio} className="space-y-4" noValidate>
            <div>
              <label htmlFor="edit-servicio-nombre" className="mb-1 block text-sm font-medium text-gray-700">
                Nombre *
              </label>
              <input
                id="edit-servicio-nombre"
                type="text"
                required
                value={form.nombre}
                onChange={(e) => setCampo('nombre', e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none transition focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="edit-servicio-tipo" className="mb-1 block text-sm font-medium text-gray-700">
                  Tipo de agenda
                </label>
                <select
                  id="edit-servicio-tipo"
                  value={form.tipo_agenda}
                  onChange={(e) => setCampo('tipo_agenda', e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none transition focus:ring-2 focus:ring-blue-500"
                >
                  {TIPOS.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="edit-servicio-modalidad" className="mb-1 block text-sm font-medium text-gray-700">
                  Modalidad
                </label>
                <select
                  id="edit-servicio-modalidad"
                  value={form.modalidad}
                  onChange={(e) => setCampo('modalidad', e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none transition focus:ring-2 focus:ring-blue-500"
                >
                  {MODALIDADES.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4">
              <div>
                <label htmlFor="edit-servicio-duracion" className="mb-1 block text-sm font-medium text-gray-700">
                  Duración (min) *
                </label>
                <input
                  id="edit-servicio-duracion"
                  type="number"
                  min="15"
                  step="5"
                  required
                  value={form.duracion_minutos}
                  onChange={(e) => setCampo('duracion_minutos', e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none transition focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label htmlFor="edit-servicio-cupo-min" className="mb-1 block text-sm font-medium text-gray-700">
                  Cupo mínimo
                </label>
                <input
                  id="edit-servicio-cupo-min"
                  type="number"
                  min="1"
                  disabled={form.tipo_agenda === 'individual'}
                  value={form.cupo_minimo}
                  onChange={(e) => setCampo('cupo_minimo', e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none transition focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400"
                />
              </div>

              <div>
                <label htmlFor="edit-servicio-cupo-max" className="mb-1 block text-sm font-medium text-gray-700">
                  Cupo máximo
                </label>
                <input
                  id="edit-servicio-cupo-max"
                  type="number"
                  min="1"
                  disabled={form.tipo_agenda === 'individual'}
                  value={form.tipo_agenda === 'individual' ? 1 : form.cupo_maximo}
                  onChange={(e) => setCampo('cupo_maximo', e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none transition focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400"
                />
                {form.tipo_agenda === 'individual' && (
                  <p className="mt-1 text-xs text-gray-400">Siempre 1:1</p>
                )}
              </div>

              <div>
                <label htmlFor="edit-servicio-moneda" className="mb-1 block text-sm font-medium text-gray-700">
                  Moneda
                </label>
                <select
                  id="edit-servicio-moneda"
                  value={form.moneda}
                  onChange={(e) => setCampo('moneda', e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none transition focus:ring-2 focus:ring-blue-500"
                >
                  {MONEDAS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label htmlFor="edit-servicio-precio" className="mb-1 block text-sm font-medium text-gray-700">
                  Precio
                </label>
                <input
                  id="edit-servicio-precio"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.precio}
                  onChange={(e) => setCampo('precio', e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none transition focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label htmlFor="edit-servicio-buffer-antes" className="mb-1 block text-sm font-medium text-gray-700">
                  Buffer antes (min)
                </label>
                <input
                  id="edit-servicio-buffer-antes"
                  type="number"
                  min="0"
                  value={form.buffer_antes_min}
                  onChange={(e) => setCampo('buffer_antes_min', e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none transition focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label htmlFor="edit-servicio-buffer-despues" className="mb-1 block text-sm font-medium text-gray-700">
                  Buffer después (min)
                </label>
                <input
                  id="edit-servicio-buffer-despues"
                  type="number"
                  min="0"
                  value={form.buffer_despues_min}
                  onChange={(e) => setCampo('buffer_despues_min', e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none transition focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label htmlFor="edit-servicio-descripcion" className="mb-1 block text-sm font-medium text-gray-700">
                Descripción
              </label>
              <textarea
                id="edit-servicio-descripcion"
                rows="2"
                value={form.descripcion}
                onChange={(e) => setCampo('descripcion', e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none transition focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={form.pago_requerido}
                  onChange={(e) => setCampo('pago_requerido', e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600"
                />
                Pago requerido
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={form.visible_web}
                  onChange={(e) => setCampo('visible_web', e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600"
                />
                Visible en web
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={form.requiere_confirmacion}
                  onChange={(e) => setCampo('requiere_confirmacion', e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600"
                />
                Requiere confirmación manual
              </label>
            </div>

            {form.tipo_agenda === 'recurrente' && (
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                <p className="mb-2 text-xs font-medium text-gray-500">Modalidades de cobro para series</p>
                <div className="flex flex-wrap gap-4">
                  <label className="flex items-center gap-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={form.cobro_por_sesion_habilitado}
                      onChange={(e) => setCampo('cobro_por_sesion_habilitado', e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 text-blue-600"
                    />
                    Ofrecer pago por sesión
                  </label>
                  <label className="flex items-center gap-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={form.cobro_por_paquete_habilitado}
                      onChange={(e) => setCampo('cobro_por_paquete_habilitado', e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 text-blue-600"
                    />
                    Ofrecer pago por paquete
                  </label>
                </div>
                {form.cobro_por_paquete_habilitado && (
                  <div className="mt-3">
                    <label
                      htmlFor="edit-servicio-precio-paquete"
                      className="mb-1 block text-sm font-medium text-gray-700"
                    >
                      Precio del paquete *
                    </label>
                    <input
                      id="edit-servicio-precio-paquete"
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.precio_paquete}
                      onChange={(e) => setCampo('precio_paquete', e.target.value)}
                      placeholder="Ej. 15000"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none transition focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="mt-1 text-xs text-gray-500">Precio total por todas las sesiones de la serie</p>
                  </div>
                )}
              </div>
            )}

            {form.requiere_confirmacion && (
              <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2">
                <p className="mb-2 text-xs text-blue-700">
                  El cliente propone fecha/hora dentro del "Horario de propuestas"; el asesor
                  se asigna al confirmar.
                </p>
                {editando.requiere_confirmacion ? (
                  <button
                    type="button"
                    onClick={() => setHorarioDe(editando)}
                    className="rounded-lg border border-blue-300 px-3 py-1.5 text-xs font-medium text-blue-700 transition hover:bg-blue-100"
                  >
                    Configurar horario de propuestas
                  </button>
                ) : (
                  <p className="text-xs font-medium text-blue-600">
                    Guarda los cambios primero — después podrás configurar el horario aquí mismo.
                  </p>
                )}
              </div>
            )}

            {editarError && (
              <p
                role="alert"
                className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
              >
                {editarError}
              </p>
            )}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditando(null)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={editarLoading}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {editarLoading ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {confirmarDesactivar && (
        <Modal
          title="Desactivar servicio"
          onClose={() => setConfirmarDesactivar(null)}
          maxWidth="max-w-md"
        >
          <p className="mb-5 text-sm text-gray-600">
            ¿Desactivar el servicio{' '}
            <span className="font-semibold text-gray-900">{confirmarDesactivar.nombre}</span>? Ya no
            aparecerá en la página pública.
          </p>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setConfirmarDesactivar(null)}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={toggleLoadingId === confirmarDesactivar.id}
              onClick={() => {
                desactivar(confirmarDesactivar)
                setConfirmarDesactivar(null)
              }}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {toggleLoadingId === confirmarDesactivar.id ? 'Desactivando...' : 'Desactivar'}
            </button>
          </div>
        </Modal>
      )}

      {horarioDe && (
        <HorarioServicio
          servicio={horarioDe}
          tenantSlug={tenantSlug}
          token={token}
          onClose={() => setHorarioDe(null)}
        />
      )}

      {serieDe && (
        <CrearSerieModal
          servicio={serieDe}
          onClose={() => setSerieDe(null)}
          onCreado={(serie) => {
            console.log('Serie creada:', serie)
            // Opcional: refrescar la lista de servicios o mostrar notificación
          }}
        />
      )}
    </div>
  )
}
