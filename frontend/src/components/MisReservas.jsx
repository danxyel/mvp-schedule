import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import client from '../api/client'
const BADGE = {
  confirmada: 'bg-green-100 text-green-700 border-green-200',
  en_espera: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  pendiente: 'bg-gray-100 text-gray-600 border-gray-200',
  cancelada: 'bg-red-100 text-red-700 border-red-200',
  completada: 'bg-blue-100 text-blue-700 border-blue-200',
  no_show: 'bg-red-200 text-red-800 border-red-300',
}

const ESTADO_LABEL = {
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

function toLocalTime(utcString, timezone) {
  return new Intl.DateTimeFormat('es-MX', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: timezone,
  }).format(new Date(utcString))
}

function CardSkeleton() {
  return (
    <div className="animate-pulse rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="mb-3 h-5 w-3/5 rounded bg-gray-200" />
      <div className="mb-2 h-4 w-4/5 rounded bg-gray-100" />
      <div className="mb-4 h-4 w-2/5 rounded bg-gray-100" />
      <div className="flex gap-2">
        <div className="h-6 w-20 rounded-full bg-gray-200" />
        <div className="h-6 w-16 rounded-full bg-gray-100" />
      </div>
    </div>
  )
}

function CountdownTimer({ expiraEn }) {
  const [remaining, setRemaining] = useState(null)

  useEffect(() => {
    if (!expiraEn) return

    function tick() {
      const diff = new Date(expiraEn) - new Date()
      setRemaining(Math.max(0, diff))
    }

    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [expiraEn])

  if (remaining === null) return null
  if (remaining <= 0) return <span className="text-xs font-semibold text-red-600">Tiempo agotado</span>

  const mins = Math.floor(remaining / 60000)
  const secs = Math.floor((remaining % 60000) / 1000)
  return (
    <span className="text-xs font-mono font-bold text-yellow-700">
      {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
    </span>
  )
}

const MODALIDAD_COBRO_LABEL = {
  sesion: 'Por sesión',
  paquete: 'Por paquete',
}

function ReservaCard({ r, navigate }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:shadow-md">
      <div className="mb-1 flex items-start justify-between gap-2">
        <h3 className="text-base font-semibold text-gray-900">{r.servicio_nombre ?? 'Servicio'}</h3>
        <span
          className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${
            BADGE[r.estado] ?? 'bg-gray-100 text-gray-600'
          }`}
        >
          {ESTADO_LABEL[r.estado] ?? r.estado}
        </span>
      </div>

      <p className="mb-1 text-sm text-gray-600">{toLocalTime(r.fecha_hora_inicio, r.timezone)}</p>

      {r.asesor && <p className="mb-2 text-sm text-gray-500">Con {r.asesor.nombre}</p>}

      <div className="flex flex-wrap items-center gap-3">
        {r.estado_pago && r.estado_pago !== 'exento' && (
          <span className="text-xs text-gray-500">{PAGO_LABEL[r.estado_pago] ?? r.estado_pago}</span>
        )}
        {r.estado === 'en_espera' && r.hold_expira_en && <CountdownTimer expiraEn={r.hold_expira_en} />}
        {r.estado === 'confirmada' && r.meet_url && (
          <a
            href={r.meet_url}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg bg-blue-600 px-3 py-1 text-xs font-medium text-white transition hover:bg-blue-700"
          >
            Unirse
          </a>
        )}
      </div>

      <div className="mt-3 border-t border-gray-100 pt-3">
        <button
          type="button"
          onClick={() => navigate(`/mis-reservas/${r.folio}`)}
          className="text-xs font-medium text-blue-600 transition hover:text-blue-800"
        >
          Ver detalle &rarr;
        </button>
      </div>
    </div>
  )
}

function ReservaItem({ r, navigate }) {
  return (
    <div className="flex flex-col gap-1 border-b border-gray-100 py-2 last:border-b-0 last:pb-0">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-gray-700">{toLocalTime(r.fecha_hora_inicio, r.timezone)}</p>
        <span
          className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${
            BADGE[r.estado] ?? 'bg-gray-100 text-gray-600'
          }`}
        >
          {ESTADO_LABEL[r.estado] ?? r.estado}
        </span>
      </div>

      {r.asesor && (
        <p className="text-xs text-gray-500">Con {r.asesor.nombre}</p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {r.estado_pago && r.estado_pago !== 'exento' && (
          <span className="text-xs text-gray-500">{PAGO_LABEL[r.estado_pago] ?? r.estado_pago}</span>
        )}
        {r.estado === 'en_espera' && r.hold_expira_en && (
          <CountdownTimer expiraEn={r.hold_expira_en} />
        )}
      </div>

      <div className="pt-1">
        <button
          type="button"
          onClick={() => navigate(`/mis-reservas/${r.folio}`)}
          className="text-xs font-medium text-blue-600 transition hover:text-blue-800"
        >
          Ver detalle &rarr;
        </button>
      </div>
    </div>
  )
}

function SerieCard({ serie, navigate }) {
  const primera = serie.reservas[0]
  const esPaquete = primera.modalidad_cobro === 'paquete'
  const pagadas = serie.reservas.every((r) => r.estado_pago === 'completado' || r.estado_pago === 'exento')

  return (
    <div className="rounded-xl border border-orange-200 bg-white p-5 shadow-sm transition hover:shadow-md">
      <div className="mb-1 flex items-start justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold text-gray-900">{primera.servicio_nombre ?? 'Servicio'}</h3>
          <p className="text-xs text-gray-500">Serie de {serie.reservas.length} sesiones</p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">
          <span
            className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${
              esPaquete ? 'bg-purple-100 text-purple-700 border-purple-200' : 'bg-blue-100 text-blue-700 border-blue-200'
            }`}
          >
            {MODALIDAD_COBRO_LABEL[primera.modalidad_cobro] ?? primera.modalidad_cobro ?? 'Serie'}
          </span>
          {esPaquete && pagadas && (
            <span className="inline-flex items-center rounded-full border border-green-200 bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">
              Paquete pagado
            </span>
          )}
        </div>
      </div>

      <div className="mt-2 space-y-1">
        {serie.reservas.map((r) => (
          <ReservaItem key={r.folio} r={r} navigate={navigate} />
        ))}
      </div>
    </div>
  )
}

const LIMIT = 10

export default function MisReservas() {
  const navigate = useNavigate()
  const tenantSlug = sessionStorage.getItem('tenantSlug')
  const token = sessionStorage.getItem('token')
  
  const [incluirPasadas, setIncluirPasadas] = useState(false)
  const [offset, setOffset] = useState(0)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchReservas = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data: result, error: fetchErr } = await client.GET(
        '/api/v2/{tenant_slug}/mis-reservas',
        {
          params: {
            path: { tenant_slug: tenantSlug },
            query: { incluir_pasadas: incluirPasadas, limit: LIMIT, offset },
          },
          headers: { Authorization: `Bearer ${token}` },
        },
      )
      if (fetchErr) {
        setError(fetchErr)
        return
      }
      setData(result)
    } catch (err) {
      setError(err)
    } finally {
      setLoading(false)
    }
  }, [tenantSlug, token, incluirPasadas, offset])

  useEffect(() => {
    fetchReservas()
  }, [fetchReservas])

  const toggleHistorial = () => {
    setIncluirPasadas((prev) => !prev)
    setOffset(0)
  }

  const irPagina = (nuevaOffset) => {
    setOffset(nuevaOffset)
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Mis reservas</h2>
          <div className="h-6 w-28 animate-pulse rounded bg-gray-200" />
        </div>
        <div className="grid gap-4">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="mx-auto max-w-2xl">
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
          <p className="mb-1 font-semibold text-red-700">Error al cargar reservas</p>
          <p className="mb-4 text-sm text-red-600">
            {error?.message ?? JSON.stringify(error)}
          </p>
          <button
            type="button"
            onClick={fetchReservas}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700"
          >
            Intentar de nuevo
          </button>
        </div>
      </div>
    )
  }

  const reservas = data ?? []

  // Agrupar reservas con serie_id
  const seriesMap = new Map()
  const sueltas = []
  for (const r of reservas) {
    if (r.serie_id) {
      if (!seriesMap.has(r.serie_id)) {
        seriesMap.set(r.serie_id, [])
      }
      seriesMap.get(r.serie_id).push(r)
    } else {
      sueltas.push(r)
    }
  }
  const series = Array.from(seriesMap.values())
    .map((items) => ({
      id: items[0].serie_id,
      reservas: items.sort(
        (a, b) => new Date(b.fecha_hora_inicio) - new Date(a.fecha_hora_inicio)
      ),
    }))
    .sort(
      (a, b) =>
        new Date(b.reservas[0].fecha_hora_inicio) -
        new Date(a.reservas[0].fecha_hora_inicio)
    )

  const hayMas = reservas.length === LIMIT
  const sinReservas = reservas.length === 0

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-gray-900">Mis reservas</h2>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => navigate('/mis-series')}
            className="text-sm text-blue-600 hover:underline"
          >
            Mis series
          </button>
          <label className="flex cursor-pointer items-center gap-2">
            <span className="text-sm text-gray-600">Ver historial</span>
            <button
              type="button"
              role="switch"
              aria-checked={incluirPasadas}
              onClick={toggleHistorial}
              className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors ${
                incluirPasadas ? 'bg-blue-600' : 'bg-gray-200'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
                  incluirPasadas ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
          </label>
        </div>
      </div>

      {sinReservas && (
        <p className="py-12 text-center text-gray-500">
          {incluirPasadas
            ? 'No tienes reservas.'
            : 'No tienes reservas próximas.'}
        </p>
      )}

      <div className="grid gap-4">
        {series.map((serie) => (
          <SerieCard key={serie.id} serie={serie} navigate={navigate} />
        ))}
        {sueltas.map((r) => (
          <ReservaCard key={r.folio} r={r} navigate={navigate} />
        ))}
      </div>

      {!sinReservas && (
        <div className="mt-6 flex items-center justify-center gap-4">
          <button
            type="button"
            disabled={offset === 0}
            onClick={() => irPagina(Math.max(0, offset - LIMIT))}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            &larr; Anterior
          </button>
          <span className="text-sm text-gray-500">
            {offset + 1}&ndash;{offset + reservas.length}
          </span>
          <button
            type="button"
            disabled={!hayMas}
            onClick={() => irPagina(offset + LIMIT)}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Siguiente &rarr;
          </button>
        </div>
      )}
    </div>
  )
}
