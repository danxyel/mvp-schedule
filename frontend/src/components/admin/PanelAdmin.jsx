import { useState, useEffect, useCallback, Fragment } from 'react'
import { useNavigate } from 'react-router-dom'
import client from '../../api/client'
import GestionServicios from './GestionServicios'
import GestionUsuarios from './GestionUsuarios'
import SeriesTab from './SeriesTab'
import CrearSerieModal from './CrearSerieModal'
import MercadoPagoTab from './MercadoPagoTab'
import Modal from '../common/Modal'
import SelectorFecha from '../common/SelectorFecha'
import { getLocalOffset } from '../../utils/fechas'
import { errorMensaje } from '../../utils/errores'
const SESION_BADGE = {
  abierta: 'bg-green-100 text-green-700 border-green-200',
  confirmada: 'bg-blue-100 text-blue-700 border-blue-200',
  llena: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  cancelada: 'bg-red-100 text-red-700 border-red-200',
  completada: 'bg-gray-100 text-gray-600 border-gray-200',
}

const SESION_LABEL = {
  abierta: 'Abierta',
  confirmada: 'Confirmada',
  llena: 'Llena',
  cancelada: 'Cancelada',
  completada: 'Completada',
}

const RESERVA_BADGE = {
  confirmada: 'bg-green-100 text-green-700 border-green-200',
  en_espera: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  pendiente: 'bg-gray-100 text-gray-600 border-gray-200',
  cancelada: 'bg-red-100 text-red-700 border-red-200',
  completada: 'bg-blue-100 text-blue-700 border-blue-200',
  no_show: 'bg-red-200 text-red-800 border-red-300',
}

const RESERVA_LABEL = {
  confirmada: 'Confirmada',
  en_espera: 'En espera de pago',
  pendiente: 'Procesando...',
  cancelada: 'Cancelada',
  completada: 'Completada',
  no_show: 'No asistió',
}

const PAGO_LABEL = {
  pendiente: 'Pago pendiente',
  completado: 'Pagado',
  reembolsado: 'Reembolsado',
  exento: 'Sin costo',
}

const FILTROS_ESTADO = [
  'todas',
  'pendiente',
  'en_espera',
  'confirmada',
  'cancelada',
  'completada',
  'no_show',
]

const LIMIT = 10
const LIMIT_RESERVAS = 50

const INICIO_MIN = 8 * 60
const FIN_MIN = 20 * 60
const DURACION_MIN = FIN_MIN - INICIO_MIN
const HORAS = Array.from({ length: 12 }, (_, i) => 8 + i)

const TIMELINE_COLORS = {
  confirmada: 'border-blue-700 bg-blue-500 text-white',
  completada: 'border-green-700 bg-green-500 text-white',
  cancelada: 'border-gray-500 bg-gray-400 text-white',
  en_espera: 'border-yellow-600 bg-yellow-400 text-gray-800',
  no_show: 'border-red-700 bg-red-500 text-white',
}

function formatFechaHora(utcString, timezone) {
  return new Intl.DateTimeFormat('es-MX', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: timezone,
  }).format(new Date(utcString))
}

function formatHora(utcString, timezone) {
  return new Intl.DateTimeFormat('es-MX', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: timezone,
  }).format(new Date(utcString))
}

function toDateInputValue(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function getHoraMin(utcString, timezone) {
  const parts = new Intl.DateTimeFormat('es-MX', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: timezone,
  }).formatToParts(new Date(utcString))
  const get = (t) => parts.find((p) => p.type === t)?.value
  return `${get('hour') ?? '00'}:${get('minute') ?? '00'}`
}

function Badge({ value, map, labelMap }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${
        map[value] ?? 'bg-gray-100 text-gray-600 border-gray-200'
      }`}
    >
      {labelMap[value] ?? value}
    </span>
  )
}

function SesionesTab({ tenantSlug, token }) {
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  const [offset, setOffset] = useState(0)
  const [items, setItems] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [accionError, setAccionError] = useState(null)
  const [verInscritos, setVerInscritos] = useState(null)
  const [checkinFolio, setCheckinFolio] = useState(null)
  const [checkinErrores, setCheckinErrores] = useState({})
  const [cancelandoFolio, setCancelandoFolio] = useState(null)
  const [cancelarErrores, setCancelarErrores] = useState({})
  const [reagendar, setReagendar] = useState(null)
  const [reagendarError, setReagendarError] = useState(null)
  const [reagendarLoading, setReagendarLoading] = useState(false)

  const fetchSesiones = useCallback(async () => {
    const { data, error: fetchErr } = await client.GET(
      '/api/v2/{tenant_slug}/servicios/{servicio_id}/sesiones',
      {
        params: {
          path: { tenant_slug: tenantSlug, servicio_id: 1 },
          query: { limit: LIMIT, offset },
        },
        headers: { Authorization: `Bearer ${token}` },
      },
    )
    if (fetchErr) {
      setError(fetchErr)
      setLoading(false)
      return
    }
    setItems(data.items)
    setTotal(data.paginacion.total)
    setLoading(false)
  }, [tenantSlug, token, offset])

  useEffect(() => {
    fetchSesiones()
  }, [fetchSesiones])

  const irPagina = (nuevaOffset) => {
    setLoading(true)
    setOffset(nuevaOffset)
  }

  const reintentar = () => {
    setLoading(true)
    setError(null)
    fetchSesiones()
  }

  const abrirInscritos = async (sesion) => {
    setVerInscritos({ sesion, reservas: [], loading: true, error: null })
    const { data, error: fetchErr } = await client.GET(
      '/api/v2/{tenant_slug}/sesiones/{sesion_id}/admin',
      {
        params: { path: { tenant_slug: tenantSlug, sesion_id: sesion.id } },
        headers: { Authorization: `Bearer ${token}` },
      },
    )
    if (fetchErr) {
      setVerInscritos({ sesion, reservas: [], loading: false, error: fetchErr })
      return
    }
    const reservas = data?.reservas ?? []
    setVerInscritos({ sesion, reservas, loading: false, error: null })
  }

  const hacerCheckinInscrito = async (folio) => {
    setCheckinFolio(folio)
    setCheckinErrores((prev) => ({ ...prev, [folio]: null }))
    const { error: fetchErr, response } = await client.POST(
      '/api/v2/{tenant_slug}/reservas/{folio}/checkin',
      {
        params: { path: { tenant_slug: tenantSlug, folio } },
        headers: { Authorization: `Bearer ${token}` },
      },
    )
    setCheckinFolio(null)
    if (fetchErr) {
      if (fetchErr?.detail?.codigo === 'pago_pendiente') {
        setCheckinErrores((prev) => ({ ...prev, [folio]: 'Pago pendiente — regístralo antes de hacer check-in' }))
        return
      }
      if (response?.status === 409) {
        setCheckinErrores((prev) => ({ ...prev, [folio]: 'Ya registrado' }))
        return
      }
      setCheckinErrores((prev) => ({ ...prev, [folio]: errorMensaje(fetchErr) }))
      return
    }
    setVerInscritos((prev) => ({
      ...prev,
      reservas: prev.reservas.map((x) =>
        x.folio === folio ? { ...x, estado: 'completada' } : x,
      ),
    }))
  }

  const cancelarInscrito = async (folio) => {
    if (!confirm('¿Cancelar la reserva de este inscrito?')) return
    setCancelandoFolio(folio)
    setCancelarErrores((prev) => ({ ...prev, [folio]: null }))
    const { error: fetchErr } = await client.POST(
      '/api/v2/{tenant_slug}/reservas/{folio}/cancelar',
      {
        params: { path: { tenant_slug: tenantSlug, folio } },
        body: { motivo: 'Cancelado por administrador' },
        headers: { Authorization: `Bearer ${token}` },
      },
    )
    setCancelandoFolio(null)
    if (fetchErr) {
      setCancelarErrores((prev) => ({ ...prev, [folio]: errorMensaje(fetchErr) }))
      return
    }
    setVerInscritos((prev) => ({
      ...prev,
      reservas: prev.reservas.map((x) =>
        x.folio === folio ? { ...x, estado: 'cancelada' } : x,
      ),
    }))
    fetchSesiones()
  }

  const completarSesion = async (sesion) => {
    const hora = formatFechaHora(sesion.fecha_hora_inicio, sesion.timezone)
    if (!window.confirm(`¿Completar la sesión del ${hora}?`)) return

    setAccionError(null)
    const { error: fetchErr } = await client.POST(
      '/api/v2/{tenant_slug}/sesiones/{sesion_id}/completar',
      {
        params: { path: { tenant_slug: tenantSlug, sesion_id: sesion.id } },
        headers: { Authorization: `Bearer ${token}` },
      },
    )
    if (fetchErr) {
      setAccionError(fetchErr)
      return
    }
    fetchSesiones()
  }

  const abrirReagendar = (sesion) => {
    setReagendar({
      sesion,
      fecha: toDateInputValue(new Date(sesion.fecha_hora_inicio)),
      hora: getHoraMin(sesion.fecha_hora_inicio, sesion.timezone),
    })
    setReagendarError(null)
  }

  const guardarReagendar = async () => {
    if (!reagendar?.fecha || !reagendar?.hora) return
    setReagendarLoading(true)
    setReagendarError(null)
    const nuevaFechaHora = `${reagendar.fecha}T${reagendar.hora}${getLocalOffset()}`

    const { error: fetchErr } = await client.POST(
      '/api/v2/{tenant_slug}/sesiones/{sesion_id}/reagendar',
      {
        params: { path: { tenant_slug: tenantSlug, sesion_id: reagendar.sesion.id } },
        body: { nueva_fecha_hora_inicio: nuevaFechaHora, motivo: null },
        headers: { Authorization: `Bearer ${token}` },
      },
    )
    setReagendarLoading(false)
    if (fetchErr) {
      setReagendarError(fetchErr)
      return
    }
    setReagendar(null)
    fetchSesiones()
  }

  if (loading) {
    return (
      <div className="animate-pulse space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-12 rounded-lg bg-gray-100" />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
        <p className="mb-1 font-semibold text-red-700">Error al cargar sesiones</p>
        <p className="mb-4 text-sm text-red-600">{errorMensaje(error)}</p>
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
    <div>
      {accionError && (
        <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {errorMensaje(accionError)}
        </p>
      )}

      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <th className="px-4 py-3 font-medium">Fecha/Hora</th>
              <th className="px-4 py-3 font-medium">Asesor</th>
              <th className="px-4 py-3 font-medium">Estado</th>
              <th className="px-4 py-3 font-medium">Inscritos/Cupo</th>
              <th className="px-4 py-3 text-right font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {items.map((s) => (
              <tr key={s.id} className="transition hover:bg-gray-50">
                <td className="whitespace-nowrap px-4 py-3 text-gray-700">
                  {formatFechaHora(s.fecha_hora_inicio, s.timezone)}
                </td>
                <td className="px-4 py-3 text-gray-700">{s.asesor?.nombre ?? '—'}</td>
                <td className="px-4 py-3">
                  <Badge value={s.estado} map={SESION_BADGE} labelMap={SESION_LABEL} />
                </td>
                <td className="px-4 py-3 text-gray-700">
                  {s.inscritos ?? 0}/{s.cupo_maximo ?? 0}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right">
                  <div className="flex justify-end gap-1">
                    <button
                      type="button"
                      onClick={() => abrirInscritos(s)}
                      className="rounded-lg border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-700 transition hover:bg-gray-50"
                    >
                      Ver inscritos
                    </button>
                    <button
                      type="button"
                      onClick={() => abrirReagendar(s)}
                      disabled={s.estado === 'completada' || s.estado === 'cancelada'}
                      className="rounded-lg border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Reagendar
                    </button>
                    <button
                      type="button"
                      onClick={() => completarSesion(s)}
                      disabled={s.estado === 'completada' || s.estado === 'cancelada'}
                      className="rounded-lg bg-blue-600 px-2.5 py-1 text-xs font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Completar
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-gray-500">
                  No hay sesiones.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center justify-center gap-4">
        <button
          type="button"
          disabled={offset === 0}
          onClick={() => irPagina(Math.max(0, offset - LIMIT))}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          &larr; Anterior
        </button>
        <span className="text-sm text-gray-500">
          {offset + 1}&ndash;{offset + items.length} de {total}
        </span>
        <button
          type="button"
          disabled={offset + items.length >= total}
          onClick={() => irPagina(offset + LIMIT)}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Siguiente &rarr;
        </button>
      </div>

      {verInscritos && (
        <Modal title="Inscritos" onClose={() => setVerInscritos(null)} maxWidth="max-w-2xl">
          {verInscritos.loading && (
            <div className="animate-pulse space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-9 rounded bg-gray-100" />
              ))}
            </div>
          )}

          {verInscritos.error && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {errorMensaje(verInscritos.error)}
            </p>
          )}

          {!verInscritos.loading && !verInscritos.error && verInscritos.reservas.length === 0 && (
            <p className="py-6 text-center text-sm text-gray-500">
              Aún no hay inscritos en esta sesión.
            </p>
          )}

          {!verInscritos.loading && !verInscritos.error && verInscritos.reservas.length > 0 && (
            <div className="max-h-[60vh] overflow-x-auto overflow-y-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-xs uppercase tracking-wide text-gray-500">
                    <th className="px-2 py-2 font-medium">Nombre</th>
                    <th className="hidden px-2 py-2 font-medium sm:table-cell">Email</th>
                    <th className="px-2 py-2 font-medium">Estado</th>
                    <th className="px-2 py-2 font-medium">Folio</th>
                    <th className="px-2 py-2 text-right font-medium">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {verInscritos.reservas.map((r) => (
                    <tr key={r.folio}>
                      <td className="whitespace-nowrap px-2 py-2 text-gray-700">
                        {r.nombre_cliente ?? '—'}
                        {checkinErrores[r.folio] && (
                          <span className="ml-2 text-xs font-medium text-red-600">
                            {checkinErrores[r.folio]}
                          </span>
                        )}
                      </td>
                      <td className="hidden px-2 py-2 text-gray-700 sm:table-cell">
                        {r.email_cliente ?? '—'}
                      </td>
                      <td className="px-2 py-2">
                        <Badge value={r.estado} map={RESERVA_BADGE} labelMap={RESERVA_LABEL} />
                      </td>
                      <td className="whitespace-nowrap px-2 py-2 font-mono text-xs text-gray-600">
                        {r.folio}
                      </td>
                      <td className="whitespace-nowrap px-2 py-2 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {r.estado === 'confirmada' && (
                            <button
                              type="button"
                              onClick={() => hacerCheckinInscrito(r.folio)}
                              disabled={checkinFolio !== null || cancelandoFolio === r.folio}
                              className="rounded-lg bg-blue-600 px-2.5 py-1 text-xs font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              {checkinFolio === r.folio ? 'Registrando...' : 'Check-in'}
                            </button>
                          )}
                          {r.estado === 'completada' && (
                            <span className="inline-flex shrink-0 items-center rounded-full border border-green-200 bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">
                              Asistió ✓
                            </span>
                          )}
                          {(r.estado === 'confirmada' || r.estado === 'pendiente' || r.estado === 'en_espera') && (
                            <button
                              type="button"
                              onClick={() => cancelarInscrito(r.folio)}
                              disabled={cancelandoFolio === r.folio || checkinFolio === r.folio}
                              className="rounded-lg border border-red-300 px-2.5 py-1 text-xs font-medium text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              {cancelandoFolio === r.folio ? 'Cancelando...' : 'Cancelar'}
                            </button>
                          )}
                          {r.estado === 'cancelada' && (
                            <span className="inline-flex shrink-0 items-center rounded-full border border-gray-200 bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
                              Cancelada
                            </span>
                          )}
                        </div>
                        {cancelarErrores[r.folio] && (
                          <span className="mt-1 block text-xs font-medium text-red-600">
                            {cancelarErrores[r.folio]}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Modal>
      )}

      {reagendar && (
        <Modal title="Reagendar sesión" onClose={() => setReagendar(null)}>
          <p className="mb-4 text-sm text-gray-600">
            Sesión actual:{' '}
            {formatFechaHora(reagendar.sesion.fecha_hora_inicio, reagendar.sesion.timezone)}
          </p>

          <div className="mb-4 flex justify-center">
            <SelectorFecha
              value={new Date(`${reagendar.fecha}T00:00:00`)}
              onChange={(day) =>
                setReagendar((prev) => ({ ...prev, fecha: toDateInputValue(day) }))
              }
              minDate={hoy}
            />
          </div>

          <div className="mb-4">
            <label className="mb-1 block text-sm font-medium text-gray-700">Nueva hora</label>
            <input
              type="time"
              value={reagendar.hora}
              onChange={(e) => setReagendar((prev) => ({ ...prev, hora: e.target.value }))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none transition focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {reagendarError && (
            <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {errorMensaje(reagendarError)}
            </p>
          )}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setReagendar(null)}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={guardarReagendar}
              disabled={reagendarLoading || !reagendar.fecha || !reagendar.hora}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {reagendarLoading ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}

function minutosDelDia(utcString, timezone) {
  const parts = new Intl.DateTimeFormat('es-MX', {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone: timezone,
  }).formatToParts(new Date(utcString))
  const get = (t) => parseInt(parts.find((p) => p.type === t)?.value, 10) || 0
  return get('hour') * 60 + get('minute')
}

function ahoraEn(timezone) {
  const parts = new Intl.DateTimeFormat('es-MX', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone: timezone,
  }).formatToParts(new Date())
  const get = (t) => parts.find((p) => p.type === t)?.value
  return {
    fecha: `${get('year')}-${get('month')}-${get('day')}`,
    minutos: parseInt(get('hour'), 10) * 60 + parseInt(get('minute'), 10),
  }
}

function ReservasTab({ tenantSlug, token }) {
  const [fecha, setFecha] = useState(() => toDateInputValue(new Date()))
  const [pickerAbierto, setPickerAbierto] = useState(false)
  const [estado, setEstado] = useState('todas')
  const [offset, setOffset] = useState(0)
  const [items, setItems] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [accionError, setAccionError] = useState(null)
  const [checkinFolio, setCheckinFolio] = useState(null)
  const [selectedFolio, setSelectedFolio] = useState(null)
  const [pagoFolio, setPagoFolio] = useState(null)
  const [pagoMetodo, setPagoMetodo] = useState('efectivo')
  const [pagoMonto, setPagoMonto] = useState('')
  const [pagoReferencia, setPagoReferencia] = useState('')
  const [pagoEnviando, setPagoEnviando] = useState(false)

  const fetchReservas = useCallback(async () => {
    const query = {
      fecha,
      limit: LIMIT_RESERVAS,
      offset,
      ...(estado !== 'todas' ? { estado } : {}),
    }
    console.log('Fetching reservas del día...')
    const { data, error: fetchErr } = await client.GET(
      '/api/v2/{tenant_slug}/admin/reservas',
      {
        params: { path: { tenant_slug: tenantSlug }, query },
        headers: { Authorization: `Bearer ${token}` },
      },
    )
    if (fetchErr) {
      setError(fetchErr)
      setLoading(false)
      return
    }
    setItems(data.items)
    setTotal(data.paginacion.total)
    setLoading(false)
  }, [tenantSlug, token, fecha, estado, offset])

  useEffect(() => {
    fetchReservas()
  }, [fetchReservas])

  const cambiarFecha = (nuevaFecha) => {
    setFecha(nuevaFecha)
    setOffset(0)
    setSelectedFolio(null)
  }

  const cambiarEstado = (nuevoEstado) => {
    setEstado(nuevoEstado)
    setOffset(0)
    setSelectedFolio(null)
  }

  const irPagina = (nuevaOffset) => {
    setLoading(true)
    setOffset(nuevaOffset)
  }

  const reintentar = () => {
    setLoading(true)
    setError(null)
    fetchReservas()
  }

  const hacerCheckin = async (folio) => {
    setCheckinFolio(folio)
    setAccionError(null)
    const { error: fetchErr } = await client.POST(
      '/api/v2/{tenant_slug}/reservas/{folio}/checkin',
      {
        params: { path: { tenant_slug: tenantSlug, folio } },
        headers: { Authorization: `Bearer ${token}` },
      },
    )
    setCheckinFolio(null)
    if (fetchErr) {
      if (fetchErr?.detail?.codigo === 'pago_pendiente') {
        setAccionError({ mensaje: 'Pago pendiente — regístralo antes de hacer check-in' })
      } else {
        setAccionError(fetchErr)
      }
      return
    }
    setItems((prev) => prev.map((r) => (r.folio === folio ? { ...r, estado: 'completada' } : r)))
  }

  const abrirPago = (folio) => {
    const reserva = items.find((r) => r.folio === folio)
    setPagoFolio(folio)
    setPagoMetodo('efectivo')
    setPagoMonto('')
    setPagoReferencia('')
    setAccionError(null)
    setSelectedFolio(reserva ? folio : null)
  }

  const registrarPagoLocal = async () => {
    if (!pagoFolio) return
    setPagoEnviando(true)
    setAccionError(null)
    const body = { metodo: pagoMetodo }
    if (pagoMonto !== '') {
      const monto = Number(pagoMonto)
      if (!Number.isFinite(monto) || monto < 0) {
        setAccionError({ detail: 'El monto debe ser un número mayor o igual a cero' })
        setPagoEnviando(false)
        return
      }
      body.monto = monto
    }
    if (pagoReferencia.trim() !== '') body.referencia = pagoReferencia.trim()
    const { error: fetchErr } = await client.POST(
      '/api/v2/{tenant_slug}/admin/reservas/{folio}/pago-local',
      {
        params: { path: { tenant_slug: tenantSlug, folio: pagoFolio } },
        body,
        headers: { Authorization: `Bearer ${token}` },
      },
    )
    setPagoEnviando(false)
    if (fetchErr) {
      setAccionError(fetchErr)
      return
    }
    setItems((prev) =>
      prev.map((r) =>
        r.folio === pagoFolio
          ? {
              ...r,
              estado_pago: 'completado',
              estado: r.estado === 'en_espera' ? 'confirmada' : r.estado,
              precio_final: body.monto ?? r.precio_final,
            }
          : r,
      ),
    )
    setPagoFolio(null)
  }

  const timezone = items[0]?.timezone ?? 'America/Mexico_City'
  const ahora = ahoraEn(timezone)
  const mostrarLineaAhora = ahora.fecha === fecha && ahora.minutos >= INICIO_MIN && ahora.minutos <= FIN_MIN
  const ahoraPct = Math.max(Math.min(((ahora.minutos - INICIO_MIN) / DURACION_MIN) * 100, 100), 0)
  const ahoraLabel = `${String(Math.floor(ahora.minutos / 60)).padStart(2, '0')}:${String(
    ahora.minutos % 60,
  ).padStart(2, '0')}`

  const carriles = items.reduce((acc, r) => {
    const asesor = r.asesor ?? { id: 'sin-asignar', nombre: 'Sin asignar' }
    let carril = acc.find((c) => c.asesor.id === asesor.id)
    if (!carril) {
      carril = { asesor, items: [] }
      acc.push(carril)
    }
    carril.items.push(r)
    return acc
  }, [])
  carriles.sort((a, b) => a.asesor.nombre.localeCompare(b.asesor.nombre))
  carriles.forEach((c) =>
    c.items.sort((a, b) => a.fecha_hora_inicio.localeCompare(b.fecha_hora_inicio)),
  )

  const visibles = selectedFolio ? items.filter((r) => r.folio === selectedFolio) : items

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-10 w-full max-w-xs rounded-lg bg-gray-100" />
        <div className="hidden h-40 rounded-lg bg-gray-100 md:block" />
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
        <p className="mb-1 font-semibold text-red-700">Error al cargar reservas</p>
        <p className="mb-4 text-sm text-red-600">{errorMensaje(error)}</p>
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
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2">
          <span className="text-sm text-gray-600">Día</span>
          <span className="relative">
            <button
              type="button"
              onClick={() => setPickerAbierto((v) => !v)}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 transition hover:bg-gray-50"
            >
              {fecha}
            </button>
            {pickerAbierto && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setPickerAbierto(false)}
                />
                <div className="absolute left-0 top-full z-50 mt-1">
                  <SelectorFecha
                    value={new Date(`${fecha}T00:00:00`)}
                    onChange={(day) => {
                      cambiarFecha(toDateInputValue(day))
                      setPickerAbierto(false)
                    }}
                  />
                </div>
              </>
            )}
          </span>
        </label>
        <label className="flex items-center gap-2">
          <span className="text-sm text-gray-600">Estado</span>
          <select
            value={estado}
            onChange={(e) => cambiarEstado(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 outline-none transition focus:ring-2 focus:ring-blue-500"
          >
            {FILTROS_ESTADO.map((e) => (
              <option key={e} value={e}>
                {e === 'todas' ? 'Todos' : RESERVA_LABEL[e] ?? e}
              </option>
            ))}
          </select>
        </label>
      </div>

      {items.length > 0 && (
        <div className="mb-4 hidden md:block">
          <div className="mb-2 flex text-xs font-medium text-gray-600">
            <div className="w-28 shrink-0 pr-3">Asesor</div>
            <div className="flex flex-1 items-center justify-between">
              <span className="text-center">Agenda {fecha}</span>
              {mostrarLineaAhora && (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-red-600">
                  <span className="h-2 w-2 rounded-full bg-red-500" />
                  Ahora {ahoraLabel}
                </span>
              )}
            </div>
          </div>
          <div className="flex">
            <div className="w-28 shrink-0 pr-3" />
            <div className="relative flex-1">
              <div className="grid grid-cols-12">
                {HORAS.map((h) => (
                  <div key={h} className="relative text-[10px] text-gray-400">
                    <span className="absolute -top-0.5 left-0">
                      {`${String(h).padStart(2, '0')}:00`}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="mt-3 space-y-2">
            {carriles.map((carril) => (
              <div key={carril.asesor.id} className="flex items-stretch">
                <div className="flex w-28 shrink-0 items-center pr-3 text-xs font-medium text-gray-700">
                  <span className="truncate">{carril.asesor.nombre}</span>
                </div>
                <div className="relative h-12 flex-1 rounded-lg border border-gray-100 bg-gray-50/60">
                  {HORAS.map((h) => (
                    <div
                      key={h}
                      className="absolute bottom-0 top-0 border-l border-gray-200"
                      style={{ left: `${((h - INICIO_MIN / 60) / (FIN_MIN / 60 - INICIO_MIN / 60)) * 100}%` }}
                    />
                  ))}
                  {carril.items.map((r) => {
                    const inicio = minutosDelDia(r.fecha_hora_inicio, r.timezone)
                    const fin = minutosDelDia(r.fecha_hora_fin, r.timezone)
                    const left = Math.min(Math.max(((inicio - INICIO_MIN) / DURACION_MIN) * 100, 0), 95)
                    const width = Math.min(
                      Math.max(((fin - inicio) / DURACION_MIN) * 100, 3.5),
                      100 - left,
                    )
                    const activo = r.folio === selectedFolio
                    return (
                      <button
                        key={r.folio}
                        type="button"
                        onClick={() => setSelectedFolio(activo ? null : r.folio)}
                        title={`${formatHora(r.fecha_hora_inicio, r.timezone)} – ${formatHora(
                          r.fecha_hora_fin,
                          r.timezone,
                        )} · ${r.nombre_cliente ?? ''} · ${RESERVA_LABEL[r.estado] ?? r.estado}`}
                        className={`absolute bottom-1 top-1 overflow-hidden rounded-md border px-1.5 text-left text-[10px] font-medium leading-tight transition ${
                          TIMELINE_COLORS[r.estado] ?? 'border-gray-500 bg-gray-400 text-white'
                        } ${activo ? 'ring-2 ring-blue-400 ring-offset-1' : 'hover:brightness-110'}`}
                        style={{ left: `${left}%`, width: `${width}%` }}
                      >
                        <span className="block truncate">{r.nombre_cliente ?? r.folio}</span>
                      </button>
                    )
                  })}
                  {mostrarLineaAhora && (
                    <div
                      className="pointer-events-none absolute bottom-0 top-0 w-px bg-red-500"
                      style={{ left: `${ahoraPct}%` }}
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {selectedFolio && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2">
          <span className="text-sm text-blue-800">Mostrando detalle de reserva</span>
          <span className="font-mono text-xs text-blue-700">{selectedFolio}</span>
          <button
            type="button"
            onClick={() => setSelectedFolio(null)}
            className="ml-auto rounded-lg bg-blue-600 px-2.5 py-1 text-xs font-medium text-white transition hover:bg-blue-700"
          >
            Mostrar todas
          </button>
        </div>
      )}

      {accionError && (
        <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {errorMensaje(accionError)}
        </p>
      )}

      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <th className="px-4 py-3 font-medium">Hora</th>
              <th className="px-4 py-3 font-medium">Cliente</th>
              <th className="px-4 py-3 font-medium">Estado</th>
              <th className="hidden px-4 py-3 font-medium sm:table-cell">Pago</th>
              <th className="px-4 py-3 text-right font-medium">Check-in</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {visibles.map((r) => (
              <tr
                key={r.folio}
                className={`transition hover:bg-gray-50 ${
                  r.folio === selectedFolio ? 'bg-blue-50' : ''
                }`}
              >
                <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-700">
                  {formatHora(r.fecha_hora_inicio, r.timezone)}
                  <span className="text-gray-400"> – </span>
                  <span className="text-gray-400">{formatHora(r.fecha_hora_fin, r.timezone)}</span>
                </td>
                <td className="px-4 py-3">
                  <p className="text-gray-700">{r.nombre_cliente ?? '—'}</p>
                  <p className="hidden text-xs text-gray-400 sm:block">
                    {r.email_cliente ?? ''}
                  </p>
                </td>
                <td className="px-4 py-3">
                  <Badge value={r.estado} map={RESERVA_BADGE} labelMap={RESERVA_LABEL} />
                </td>
                <td className="hidden px-4 py-3 sm:table-cell">
                  <span className="text-sm text-gray-700">
                    {PAGO_LABEL[r.estado_pago] ?? r.estado_pago}
                  </span>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right">
                  {r.estado_pago === 'pendiente' &&
                    r.estado !== 'cancelada' &&
                    r.estado !== 'no_show' && (
                      <button
                        type="button"
                        onClick={() => abrirPago(r.folio)}
                        disabled={pagoFolio !== null}
                        className="mr-2 rounded-lg border border-green-600 px-2.5 py-1 text-xs font-medium text-green-700 transition hover:bg-green-600 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Registrar pago
                      </button>
                    )}
                  {r.estado === 'confirmada' && (
                    <button
                      type="button"
                      onClick={() => hacerCheckin(r.folio)}
                      disabled={checkinFolio !== null}
                      className="rounded-lg bg-blue-600 px-2.5 py-1 text-xs font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {checkinFolio === r.folio ? 'Registrando...' : 'Check-in'}
                    </button>
                  )}
                  {r.estado === 'completada' && (
                    <span className="inline-flex shrink-0 items-center rounded-full border border-green-200 bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">
                      Asistió ✓
                    </span>
                  )}
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-gray-500">
                  No hay reservas para este día.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {items.length > 0 && (
        <div className="mt-4 flex items-center justify-center gap-4">
          <button
            type="button"
            disabled={offset === 0}
            onClick={() => irPagina(Math.max(0, offset - LIMIT_RESERVAS))}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            &larr; Anterior
          </button>
          <span className="text-sm text-gray-500">
            {offset + 1}&ndash;{offset + items.length} de {total}
          </span>
          <button
            type="button"
            disabled={offset + items.length >= total}
            onClick={() => irPagina(offset + LIMIT_RESERVAS)}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Siguiente &rarr;
          </button>
        </div>
      )}

      {pagoFolio && (
        <Modal title="Registrar pago local" onClose={() => setPagoFolio(null)} maxWidth="max-w-sm">
            <p className="mb-4 font-mono text-xs text-gray-500">{pagoFolio}</p>

            <label className="mb-1 block text-xs font-medium text-gray-600">Método de cobro</label>
            <div className="mb-3 flex gap-2">
              {['efectivo', 'transferencia'].map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setPagoMetodo(m)}
                  className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition ${
                    pagoMetodo === m
                      ? 'border-green-600 bg-green-600 text-white'
                      : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {m === 'efectivo' ? 'Efectivo' : 'Transferencia'}
                </button>
              ))}
            </div>

            <label className="mb-1 block text-xs font-medium text-gray-600">
              Monto (opcional, usa el precio de la reserva si se omite)
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={pagoMonto}
              onChange={(e) => setPagoMonto(e.target.value)}
              placeholder="Ej. 1500.00"
              className="mb-3 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 outline-none transition focus:ring-2 focus:ring-green-500"
            />

            <label className="mb-1 block text-xs font-medium text-gray-600">
              Referencia (opcional)
            </label>
            <input
              type="text"
              value={pagoReferencia}
              onChange={(e) => setPagoReferencia(e.target.value)}
              placeholder="Ej. Ticket #123, SPEI folio"
              maxLength={255}
              className="mb-3 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 outline-none transition focus:ring-2 focus:ring-green-500"
            />

            {accionError && (
              <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {errorMensaje(accionError)}
              </p>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPagoFolio(null)}
                disabled={pagoEnviando}
                className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={registrarPagoLocal}
                disabled={pagoEnviando}
                className="flex-1 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {pagoEnviando ? 'Registrando...' : 'Confirmar pago'}
              </button>
            </div>
        </Modal>
      )}
    </div>
  )
}

const SOLICITUD_BADGE = {
  pendiente: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  aceptada: 'bg-green-100 text-green-700 border-green-200',
  rechazada: 'bg-red-100 text-red-700 border-red-200',
  cancelada: 'bg-gray-100 text-gray-600 border-gray-200',
}

const SOLICITUD_LABEL = {
  pendiente: 'Pendiente',
  aceptada: 'Aceptada',
  rechazada: 'Rechazada',
  cancelada: 'Cancelada',
}

const FILTROS_SOLICITUD = ['pendiente', 'aceptada', 'rechazada', 'cancelada', 'todas']

function formatFechaHoraLocal(utcString) {
  return new Intl.DateTimeFormat('es-MX', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(utcString))
}

function SolicitudesTab({ tenantSlug, token, onIrAPendientes }) {
  const [estado, setEstado] = useState('pendiente')
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [confirmando, setConfirmando] = useState(null)
  const [rechazando, setRechazando] = useState(null)
  const [rechazarModal, setRechazarModal] = useState(null)
  const [motivoRechazo, setMotivoRechazo] = useState('')
  const [rechazandoLoading, setRechazandoLoading] = useState(false)
  const [errores, setErrores] = useState({})
  const [exito, setExito] = useState(null)
  const [serieModal, setSerieModal] = useState(null)

  const fetchSolicitudes = useCallback(async () => {
    const query = estado !== 'todas' ? { estado } : {}
    const { data, error: fetchErr } = await client.GET(
      '/api/v2/{tenant_slug}/admin/solicitudes',
      {
        params: { path: { tenant_slug: tenantSlug }, query },
        headers: { Authorization: `Bearer ${token}` },
      },
    )
    if (fetchErr) {
      setError(fetchErr)
      setLoading(false)
      return
    }
    setItems(data ?? [])
    setLoading(false)
  }, [tenantSlug, token, estado])

  useEffect(() => {
    fetchSolicitudes()
  }, [fetchSolicitudes])

  const cambiarEstado = (nuevoEstado) => {
    setEstado(nuevoEstado)
    setLoading(true)
  }

  const reintentar = () => {
    setLoading(true)
    setError(null)
    fetchSolicitudes()
  }

  const confirmar = async (s) => {
    setConfirmando(s.id)
    setErrores((prev) => ({ ...prev, [s.id]: null }))
    setExito(null)
    const { data, error: fetchErr, response } = await client.POST(
      '/api/v2/{tenant_slug}/admin/solicitudes/{solicitud_id}/confirmar',
      {
        params: { path: { tenant_slug: tenantSlug, solicitud_id: s.id } },
        headers: { Authorization: `Bearer ${token}` },
      },
    )
    setConfirmando(null)
    if (fetchErr) {
      const msg =
        fetchErr?.codigo === 'solicitud_no_pendiente'
          ? 'Esta solicitud ya fue resuelta.'
          : fetchErr?.codigo === 'franja_ocupada'
            ? 'El horario ya no está disponible.'
            : fetchErr?.codigo === 'cupo_agotado'
              ? 'Ya no hay lugares en ese horario.'
              : errorMensaje(fetchErr)
      setErrores((prev) => ({ ...prev, [s.id]: msg }))
      if (response?.status === 409 && fetchErr?.codigo === 'solicitud_no_pendiente') {
        fetchSolicitudes()
      }
      return
    }
    setExito({
      folio: data?.folio_reserva,
      mensaje: `Reserva creada (${data?.folio_reserva}). Revisa la pestaña Pendientes para asignar el asesor.`,
    })
    window.setTimeout(() => setExito(null), 6000)
    fetchSolicitudes()
  }

  const abrirRechazar = (s) => {
    setRechazarModal(s)
    setMotivoRechazo(s.motivo_rechazo ?? '')
    setErrores((prev) => ({ ...prev, [s.id]: null }))
  }

  const cerrarRechazar = () => {
    setRechazarModal(null)
    setMotivoRechazo('')
    setRechazandoLoading(false)
  }

  const rechazar = async () => {
    if (!rechazarModal) return
    setRechazando(rechazarModal.id)
    setRechazandoLoading(true)
    setErrores((prev) => ({ ...prev, [rechazarModal.id]: null }))
    setExito(null)
    const { error: fetchErr, response } = await client.POST(
      '/api/v2/{tenant_slug}/admin/solicitudes/{solicitud_id}/rechazar',
      {
        params: { path: { tenant_slug: tenantSlug, solicitud_id: rechazarModal.id } },
        body: { motivo: motivoRechazo.trim() || null },
        headers: { Authorization: `Bearer ${token}` },
      },
    )
    setRechazando(null)
    setRechazandoLoading(false)
    if (fetchErr) {
      const msg =
        fetchErr?.codigo === 'solicitud_no_pendiente'
          ? 'Esta solicitud ya fue resuelta.'
          : errorMensaje(fetchErr)
      setErrores((prev) => ({ ...prev, [rechazarModal.id]: msg }))
      if (response?.status === 409 && fetchErr?.codigo === 'solicitud_no_pendiente') {
        fetchSolicitudes()
        cerrarRechazar()
      }
      return
    }
    cerrarRechazar()
    setExito({ folio: null, mensaje: 'Solicitud rechazada.' })
    window.setTimeout(() => setExito(null), 4000)
    fetchSolicitudes()
  }

  if (loading) {
    return (
      <div className="animate-pulse space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-12 rounded-lg bg-gray-100" />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
        <p className="mb-1 font-semibold text-red-700">Error al cargar solicitudes</p>
        <p className="mb-4 text-sm text-red-600">{errorMensaje(error)}</p>
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
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2">
          <span className="text-sm text-gray-600">Estado</span>
          <select
            value={estado}
            onChange={(e) => cambiarEstado(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 outline-none transition focus:ring-2 focus:ring-blue-500"
          >
            {FILTROS_SOLICITUD.map((e) => (
              <option key={e} value={e}>
                {e === 'todas' ? 'Todas' : SOLICITUD_LABEL[e] ?? e}
              </option>
            ))}
          </select>
        </label>
      </div>

      {exito && (
        <div className="mb-3 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
          <p className="inline">{exito.mensaje}</p>
          {exito.folio && onIrAPendientes && (
            <button
              type="button"
              onClick={onIrAPendientes}
              className="ml-2 font-medium text-green-800 underline hover:text-green-900"
            >
              Ver en Pendientes →
            </button>
          )}
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <th className="px-4 py-3 font-medium">Servicio</th>
              <th className="px-4 py-3 font-medium">Propuesta</th>
              <th className="px-4 py-3 font-medium">Cliente</th>
              <th className="px-4 py-3 font-medium">Notas / Motivo</th>
              <th className="px-4 py-3 font-medium">Estado</th>
              <th className="px-4 py-3 text-right font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {items.map((s) => (
              <Fragment key={s.id}>
                <tr className="align-top transition hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {s.servicio_nombre ?? `Servicio #${s.servicio_id}`}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-gray-700">
                    {formatFechaHoraLocal(s.fecha_hora_propuesta)}
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-gray-700">{s.nombre_cliente ?? '—'}</p>
                    <p className="hidden text-xs text-gray-400 sm:block">{s.email_cliente ?? ''}</p>
                  </td>
                  <td className="max-w-xs px-4 py-3 text-xs text-gray-600">
                    {s.notas_cliente ? (
                      <span className="line-clamp-2" title={s.notas_cliente}>
                        {s.notas_cliente}
                      </span>
                    ) : (
                      <span className="text-gray-400">Sin notas</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Badge value={s.estado} map={SOLICITUD_BADGE} labelMap={SOLICITUD_LABEL} />
                    {s.reserva_id && (
                      <p className="mt-1 font-mono text-[10px] text-gray-500">
                        Reserva ID: {s.reserva_id}
                      </p>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    {s.estado === 'pendiente' ? (
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => confirmar(s)}
                          disabled={confirmando === s.id || rechazando === s.id}
                          className="rounded-lg bg-blue-600 px-2.5 py-1.5 text-xs font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          {confirmando === s.id ? 'Confirmando...' : 'Confirmar'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setSerieModal(s)}
                          disabled={confirmando === s.id || rechazando === s.id}
                          className="rounded-lg border border-orange-300 px-2.5 py-1.5 text-xs font-medium text-orange-700 transition hover:bg-orange-50 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          Serie
                        </button>
                        <button
                          type="button"
                          onClick={() => abrirRechazar(s)}
                          disabled={confirmando === s.id || rechazando === s.id}
                          className="rounded-lg border border-red-300 px-2.5 py-1.5 text-xs font-medium text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          Rechazar
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400">Resuelta</span>
                    )}
                  </td>
                </tr>
                {errores[s.id] && (
                  <tr className="bg-red-50">
                    <td colSpan={6} className="px-4 py-2 text-sm text-red-700">
                      {errores[s.id]}
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-gray-500">
                  No hay solicitudes en este filtro.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {serieModal && (
        <CrearSerieModal
          servicio={{ id: serieModal.servicio_id, nombre: serieModal.servicio_nombre, duracion_minutos: serieModal.duracion_minutos }}
          solicitud={serieModal}
          onClose={() => setSerieModal(null)}
          onCreado={() => {
            setExito({ folio: null, mensaje: 'Serie creada desde la solicitud.' })
            window.setTimeout(() => setExito(null), 4000)
            setSerieModal(null)
            fetchSolicitudes()
          }}
        />
      )}

      {rechazarModal && (
        <Modal title="Rechazar solicitud" onClose={cerrarRechazar} maxWidth="max-w-sm">
          <p className="mb-3 text-sm text-gray-600">
            <span className="font-medium text-gray-800">Cliente:</span>{' '}
            {rechazarModal.nombre_cliente ?? '—'}
            <br />
            <span className="font-medium text-gray-800">Propuesta:</span>{' '}
            {formatFechaHoraLocal(rechazarModal.fecha_hora_propuesta)}
          </p>

          <label className="mb-1 block text-sm font-medium text-gray-700">
            Motivo de rechazo (opcional)
          </label>
          <textarea
            value={motivoRechazo}
            onChange={(e) => setMotivoRechazo(e.target.value)}
            maxLength={500}
            rows={3}
            placeholder="Ej. No tenemos disponibilidad en ese horario."
            className="mb-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 outline-none transition focus:ring-2 focus:ring-red-500"
          />
          <p className="mb-3 text-right text-xs text-gray-400">
            {motivoRechazo.length}/500
          </p>

          {errores[rechazarModal.id] && (
            <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {errores[rechazarModal.id]}
            </p>
          )}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={cerrarRechazar}
              disabled={rechazandoLoading}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={rechazar}
              disabled={rechazandoLoading}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {rechazandoLoading ? 'Rechazando...' : 'Rechazar solicitud'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}

function PendientesTab({ tenantSlug, token }) {
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  const [offset, setOffset] = useState(0)
  const [items, setItems] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [staff, setStaff] = useState([])
  const [errorStaff, setErrorStaff] = useState(null)
  const [asesorSel, setAsesorSel] = useState({})
  const [confirmando, setConfirmando] = useState(null)
  const [errores, setErrores] = useState({})
  const [exito, setExito] = useState(null)
  const [reprogramar, setReprogramar] = useState(null)
  const [reprogramarLoading, setReprogramarLoading] = useState(false)
  const [reprogramarError, setReprogramarError] = useState(null)

  const fetchPendientes = useCallback(async () => {
    const { data, error: fetchErr } = await client.GET(
      '/api/v2/{tenant_slug}/admin/reservas',
      {
        params: {
          path: { tenant_slug: tenantSlug },
          query: { estado: 'pendiente', limit: LIMIT_RESERVAS, offset },
        },
        headers: { Authorization: `Bearer ${token}` },
      },
    )
    if (fetchErr) {
      setError(fetchErr)
      setLoading(false)
      return
    }
    setItems(data.items)
    setTotal(data.paginacion.total)
    setLoading(false)
  }, [tenantSlug, token, offset])

  useEffect(() => {
    fetchPendientes()
  }, [fetchPendientes])

  const fetchStaff = useCallback(async () => {
    const { data, error: fetchErr } = await client.GET(
      '/api/v2/{tenant_slug}/admin/usuarios',
      {
        params: { path: { tenant_slug: tenantSlug } },
        headers: { Authorization: `Bearer ${token}` },
      },
    )
    if (fetchErr) {
      setErrorStaff(fetchErr)
      return
    }
    setStaff(
      (data ?? []).filter((u) => u.activo && (u.rol === 'asesor' || u.rol === 'admin')),
    )
  }, [tenantSlug, token])

  useEffect(() => {
    fetchStaff()
  }, [fetchStaff])

  const irPagina = (nuevaOffset) => {
    setLoading(true)
    setOffset(nuevaOffset)
  }

  const reintentar = () => {
    setLoading(true)
    setError(null)
    fetchPendientes()
  }

  const asignar = async (reserva) => {
    const asesorId = asesorSel[reserva.id]
    if (!asesorId) {
      setErrores((prev) => ({ ...prev, [reserva.id]: 'Elige un asesor para confirmar.' }))
      return
    }
    setConfirmando(reserva.id)
    setErrores((prev) => ({ ...prev, [reserva.id]: null }))
    const { data, error: fetchErr } = await client.POST(
      '/api/v2/{tenant_slug}/admin/reservas/{reserva_id}/asignar-asesor',
      {
        params: { path: { tenant_slug: tenantSlug, reserva_id: reserva.id } },
        body: { asesor_id: Number(asesorId) },
        headers: { Authorization: `Bearer ${token}` },
      },
    )
    setConfirmando(null)
    if (fetchErr) {
      const msg =
        fetchErr?.codigo === 'franja_ocupada'
          ? 'Este asesor no tiene disponibilidad en ese horario. Elige otro.'
          : errorMensaje(fetchErr)
      setErrores((prev) => ({ ...prev, [reserva.id]: msg }))
      return
    }
    setExito({
      folio: reserva.folio,
      mensaje: data?.mensaje ?? 'Reserva confirmada',
    })
    window.setTimeout(() => setExito(null), 4000)
    fetchPendientes()
  }

  const abrirReprogramar = (reserva) => {
    setReprogramar({
      reserva,
      fecha: toDateInputValue(new Date(reserva.fecha_hora_inicio)),
      hora: getHoraMin(reserva.fecha_hora_inicio, reserva.timezone),
    })
    setReprogramarError(null)
  }

  const guardarReprogramar = async () => {
    if (!reprogramar?.fecha || !reprogramar?.hora) return
    setReprogramarLoading(true)
    setReprogramarError(null)
    const nuevaFechaHora = `${reprogramar.fecha}T${reprogramar.hora}${getLocalOffset()}`
    const { error: fetchErr } = await client.POST(
      '/api/v2/{tenant_slug}/sesiones/{sesion_id}/reagendar',
      {
        params: {
          path: { tenant_slug: tenantSlug, sesion_id: reprogramar.reserva.sesion_id },
        },
        body: {
          nueva_fecha_hora_inicio: nuevaFechaHora,
          motivo: 'Reprogramado por el staff (reserva pendiente)',
        },
        headers: { Authorization: `Bearer ${token}` },
      },
    )
    setReprogramarLoading(false)
    if (fetchErr) {
      setReprogramarError(fetchErr)
      return
    }
    setReprogramar(null)
    fetchPendientes()
  }

  if (loading) {
    return (
      <div className="animate-pulse space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-12 rounded-lg bg-gray-100" />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
        <p className="mb-1 font-semibold text-red-700">Error al cargar pendientes</p>
        <p className="mb-4 text-sm text-red-600">{errorMensaje(error)}</p>
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
    <div>
      {exito && (
        <p className="mb-3 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
          {exito.mensaje} — {exito.folio}
        </p>
      )}

      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <th className="px-4 py-3 font-medium">Folio</th>
              <th className="px-4 py-3 font-medium">Servicio</th>
              <th className="px-4 py-3 font-medium">Fecha/Hora</th>
              <th className="px-4 py-3 font-medium">Cliente</th>
              <th className="px-4 py-3 font-medium">Asesor</th>
              <th className="px-4 py-3 text-right font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {items.map((r) => (
              <Fragment key={r.id}>
                <tr className="align-top transition hover:bg-gray-50">
                  <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-gray-600">
                    {r.folio}
                  </td>
                  <td className="px-4 py-3 text-gray-700">{r.servicio_nombre ?? '—'}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-gray-700">
                    {formatFechaHora(r.fecha_hora_inicio, r.timezone)}
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-gray-700">{r.nombre_cliente ?? '—'}</p>
                    <p className="hidden text-xs text-gray-400 sm:block">{r.email_cliente ?? ''}</p>
                  </td>
                  <td className="px-4 py-3">
                    {errorStaff ? (
                      <span className="text-xs text-red-500">{errorMensaje(errorStaff)}</span>
                    ) : staff.length > 0 ? (
                      <select
                        value={asesorSel[r.id] ?? ''}
                        onChange={(e) =>
                          setAsesorSel((prev) => ({ ...prev, [r.id]: e.target.value }))
                        }
                        disabled={confirmando === r.id}
                        className="w-full min-w-[9rem] rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm text-gray-700 outline-none transition focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <option value="">Elige un asesor</option>
                        {staff.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.nombre}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-xs text-gray-400">Sin asesores disponibles</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => abrirReprogramar(r)}
                        disabled={confirmando !== null}
                        className="rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Reprogramar
                      </button>
                      <button
                        type="button"
                        onClick={() => asignar(r)}
                        disabled={confirmando !== null}
                        className="rounded-lg bg-blue-600 px-2.5 py-1.5 text-xs font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {confirmando === r.id ? 'Confirmando...' : 'Asignar y confirmar'}
                      </button>
                    </div>
                  </td>
                </tr>
                {errores[r.id] && (
                  <tr className="bg-red-50">
                    <td colSpan={6} className="px-4 py-2 text-sm text-red-700">
                      {errores[r.id]}
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-gray-500">
                  No hay reservas pendientes de confirmación.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {items.length > 0 && (
        <div className="mt-4 flex items-center justify-center gap-4">
          <button
            type="button"
            disabled={offset === 0}
            onClick={() => irPagina(Math.max(0, offset - LIMIT_RESERVAS))}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            &larr; Anterior
          </button>
          <span className="text-sm text-gray-500">
            {offset + 1}&ndash;{offset + items.length} de {total}
          </span>
          <button
            type="button"
            disabled={offset + items.length >= total}
            onClick={() => irPagina(offset + LIMIT_RESERVAS)}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Siguiente &rarr;
          </button>
        </div>
      )}

      {reprogramar && (
        <Modal title="Reprogramar reserva pendiente" onClose={() => setReprogramar(null)}>
          <p className="mb-4 text-sm text-gray-600">
            Fecha/hora propuesta por el cliente:{' '}
            {formatFechaHora(
              reprogramar.reserva.fecha_hora_inicio,
              reprogramar.reserva.timezone,
            )}
          </p>

          <div className="mb-4 flex justify-center">
            <SelectorFecha
              value={new Date(`${reprogramar.fecha}T00:00:00`)}
              onChange={(day) =>
                setReprogramar((prev) => ({ ...prev, fecha: toDateInputValue(day) }))
              }
              minDate={hoy}
            />
          </div>

          <div className="mb-4">
            <label className="mb-1 block text-sm font-medium text-gray-700">Nueva hora</label>
            <input
              type="time"
              value={reprogramar.hora}
              onChange={(e) => setReprogramar((prev) => ({ ...prev, hora: e.target.value }))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none transition focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <p className="mb-3 text-xs text-gray-500">
            La reserva sigue pendiente. El email de confirmación y la asignación real del asesor
            se hacen con "Asignar y confirmar".
          </p>

          {reprogramarError && (
            <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {errorMensaje(reprogramarError)}
            </p>
          )}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setReprogramar(null)}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={guardarReprogramar}
              disabled={reprogramarLoading || !reprogramar.fecha || !reprogramar.hora}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {reprogramarLoading ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}

function TabButton({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
        active
          ? 'bg-blue-600 text-white'
          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
      }`}
    >
      {children}
    </button>
  )
}

function TabGroup({ label, children }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="px-1 text-[10px] font-medium uppercase tracking-wider text-gray-400">
        {label}
      </span>
      <div className="flex flex-wrap gap-1">{children}</div>
    </div>
  )
}

export default function PanelAdmin() {
  const navigate = useNavigate()
  const tenantSlug = sessionStorage.getItem('tenantSlug')
  const token = sessionStorage.getItem('token')
  const [tab, setTab] = useState('sesiones')
  const [nuevoServicio, setNuevoServicio] = useState(null)
  const [pendientesCount, setPendientesCount] = useState(null)
  const [solicitudesCount, setSolicitudesCount] = useState(null)

  const fetchConteos = useCallback(async () => {
    const [pendientesRes, solicitudesRes] = await Promise.all([
      client.GET('/api/v2/{tenant_slug}/admin/reservas', {
        params: {
          path: { tenant_slug: tenantSlug },
          query: { estado: 'pendiente', limit: 1, offset: 0 },
        },
        headers: { Authorization: `Bearer ${token}` },
      }),
      client.GET('/api/v2/{tenant_slug}/admin/solicitudes', {
        params: { path: { tenant_slug: tenantSlug }, query: { estado: 'pendiente' } },
        headers: { Authorization: `Bearer ${token}` },
      }),
    ])
    setPendientesCount(
      pendientesRes.error
        ? null
        : (pendientesRes.data?.paginacion?.total ?? pendientesRes.data?.items?.length ?? 0),
    )
    setSolicitudesCount(
      solicitudesRes.error
        ? null
        : (solicitudesRes.data?.length ?? 0),
    )
  }, [tenantSlug, token])

  useEffect(() => {
    fetchConteos()
  }, [fetchConteos])

  useEffect(() => {
    if (tab === 'pendientes' || tab === 'solicitudes') {
      fetchConteos()
    }
  }, [tab, fetchConteos])

  const cambiarTab = (nuevaTab) => {
    setNuevoServicio(null)
    setTab(nuevaTab)
  }

  const irACrearSerie = (servicio) => {
    setNuevoServicio(servicio)
    setTab('series')
  }

  return (
    <div className="mx-auto min-w-0 max-w-4xl">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Panel de administración</h2>
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
        >
          Volver
        </button>
      </div>

      <div className="mb-4 flex flex-wrap items-start gap-x-6 gap-y-3">
        <TabGroup label="Operación diaria">
          <TabButton active={tab === 'sesiones'} onClick={() => cambiarTab('sesiones')}>
            Sesiones
          </TabButton>
          <TabButton active={tab === 'pendientes'} onClick={() => cambiarTab('pendientes')}>
            Pendientes
            {pendientesCount ? (
              <span className="ml-1.5 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                {pendientesCount}
              </span>
            ) : null}
          </TabButton>
          <TabButton active={tab === 'solicitudes'} onClick={() => cambiarTab('solicitudes')}>
            Solicitudes
            {solicitudesCount ? (
              <span className="ml-1.5 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-orange-500 px-1 text-[10px] font-bold text-white">
                {solicitudesCount}
              </span>
            ) : null}
          </TabButton>
          <TabButton active={tab === 'reservas'} onClick={() => cambiarTab('reservas')}>
            Reservas del día
          </TabButton>
        </TabGroup>

        <TabGroup label="Series recurrentes">
          <TabButton active={tab === 'servicios'} onClick={() => cambiarTab('servicios')}>
            Servicios
          </TabButton>
          <TabButton active={tab === 'series'} onClick={() => cambiarTab('series')}>
            Series
          </TabButton>
        </TabGroup>

        <TabGroup label="Cuenta">
          <TabButton active={tab === 'usuarios'} onClick={() => cambiarTab('usuarios')}>
            Usuarios
          </TabButton>
          <TabButton active={tab === 'pagos'} onClick={() => cambiarTab('pagos')}>
            Pagos
          </TabButton>
        </TabGroup>
      </div>

      {tab === 'sesiones' ? (
        <SesionesTab tenantSlug={tenantSlug} token={token} />
      ) : tab === 'pendientes' ? (
        <PendientesTab tenantSlug={tenantSlug} token={token} />
      ) : tab === 'solicitudes' ? (
        <SolicitudesTab tenantSlug={tenantSlug} token={token} onIrAPendientes={() => setTab('pendientes')} />
      ) : tab === 'reservas' ? (
        <ReservasTab tenantSlug={tenantSlug} token={token} />
      ) : tab === 'series' ? (
        <SeriesTab
          tenantSlug={tenantSlug}
          token={token}
          servicioInicial={nuevoServicio}
          onLimpiarServicioInicial={() => setNuevoServicio(null)}
        />
      ) : tab === 'servicios' ? (
        <GestionServicios tenantSlug={tenantSlug} token={token} onIrACrearSerie={irACrearSerie} />
      ) : tab === 'pagos' ? (
        <MercadoPagoTab tenantSlug={tenantSlug} token={token} />
      ) : (
        <GestionUsuarios tenantSlug={tenantSlug} token={token} />
      )}
    </div>
  )
}
