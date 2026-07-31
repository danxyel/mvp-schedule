import { useState, useEffect, useCallback } from 'react'
import createClient from 'openapi-fetch'
import GestionServicios from './GestionServicios'

const client = createClient({ baseUrl: 'http://localhost:8000' })

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

function errorMensaje(err) {
  return err?.mensaje ?? err?.message ?? JSON.stringify(err)
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

function Modal({ title, onClose, children, maxWidth = 'max-w-lg' }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className={`max-h-[80vh] w-full ${maxWidth} overflow-y-auto rounded-xl bg-white p-5 shadow-xl`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold text-gray-900">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

function SesionesTab({ tenantSlug, token }) {
  const [offset, setOffset] = useState(0)
  const [items, setItems] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [accionError, setAccionError] = useState(null)
  const [verInscritos, setVerInscritos] = useState(null)
  const [checkinFolio, setCheckinFolio] = useState(null)
  const [checkinErrores, setCheckinErrores] = useState({})
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
    const nuevaFechaHora = `${reagendar.fecha}T${reagendar.hora}-06:00`

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
                    <th className="px-2 py-2 text-right font-medium">Check-in</th>
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
                        {r.estado === 'confirmada' && (
                          <button
                            type="button"
                            onClick={() => hacerCheckinInscrito(r.folio)}
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
                        {r.estado === 'cancelada' && (
                          <span className="inline-flex shrink-0 items-center rounded-full border border-gray-200 bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
                            Cancelada
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

          <div className="mb-4 grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Nueva fecha</label>
              <input
                type="date"
                min={toDateInputValue(new Date())}
                value={reagendar.fecha}
                onChange={(e) => setReagendar((prev) => ({ ...prev, fecha: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none transition focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Nueva hora</label>
              <input
                type="time"
                value={reagendar.hora}
                onChange={(e) => setReagendar((prev) => ({ ...prev, hora: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none transition focus:ring-2 focus:ring-blue-500"
              />
            </div>
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
  const [estado, setEstado] = useState('todas')
  const [offset, setOffset] = useState(0)
  const [items, setItems] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [accionError, setAccionError] = useState(null)
  const [checkinFolio, setCheckinFolio] = useState(null)
  const [selectedFolio, setSelectedFolio] = useState(null)

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
      setAccionError(fetchErr)
      return
    }
    setItems((prev) => prev.map((r) => (r.folio === folio ? { ...r, estado: 'completada' } : r)))
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
          <input
            type="date"
            value={fecha}
            onChange={(e) => cambiarFecha(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 outline-none transition focus:ring-2 focus:ring-blue-500"
          />
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
    </div>
  )
}

export default function PanelAdmin({ tenantSlug, token, onVolver }) {
  const [tab, setTab] = useState('sesiones')

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Panel de administración</h2>
        <button
          type="button"
          onClick={onVolver}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
        >
          Volver
        </button>
      </div>

      <div className="mb-4 flex gap-1">
        <button
          type="button"
          onClick={() => setTab('sesiones')}
          className={`rounded-lg px-4 py-1.5 text-sm font-medium transition ${
            tab === 'sesiones'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          Sesiones
        </button>
        <button
          type="button"
          onClick={() => setTab('reservas')}
          className={`rounded-lg px-4 py-1.5 text-sm font-medium transition ${
            tab === 'reservas'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          Reservas del día
        </button>
        <button
          type="button"
          onClick={() => setTab('servicios')}
          className={`rounded-lg px-4 py-1.5 text-sm font-medium transition ${
            tab === 'servicios'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          Servicios
        </button>
      </div>

      {tab === 'sesiones' ? (
        <SesionesTab tenantSlug={tenantSlug} token={token} />
      ) : tab === 'reservas' ? (
        <ReservasTab tenantSlug={tenantSlug} token={token} />
      ) : (
        <GestionServicios tenantSlug={tenantSlug} token={token} />
      )}
    </div>
  )
}
