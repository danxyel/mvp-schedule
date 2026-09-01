import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import client from '../api/client'
import { errorMensaje } from '../utils/errores'

function toLocalTime(utcString, timezone) {
  const date = new Date(utcString)
  return new Intl.DateTimeFormat('es-MX', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: timezone,
  }).format(date)
}

function formatFechaHora(utcString, timezone) {
  const date = new Date(utcString)
  return new Intl.DateTimeFormat('es-MX', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: timezone,
  }).format(date)
}

function CardSkeleton() {
  return (
    <div className="animate-pulse rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="mb-3 h-5 w-3/5 rounded bg-gray-200" />
      <div className="mb-2 h-4 w-4/5 rounded bg-gray-100" />
      <div className="mb-4 h-4 w-2/5 rounded bg-gray-100" />
      <div className="h-9 w-24 rounded-lg bg-gray-200" />
    </div>
  )
}

export default function SesionesAbiertas() {
  const { tenantSlug, servicioId } = useParams()
  const navigate = useNavigate()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchSesiones = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { data, error: fetchErr } = await client.GET(
      '/api/v2/{tenant_slug}/servicios/{servicio_id}/sesiones-abiertas',
      {
        params: {
          path: { tenant_slug: tenantSlug, servicio_id: servicioId },
        },
      },
    )
    setLoading(false)
    if (fetchErr) {
      setError(errorMensaje(fetchErr))
      return
    }
    setItems(data ?? [])
  }, [tenantSlug, servicioId])

  useEffect(() => {
    fetchSesiones()
  }, [fetchSesiones])

  const unirse = (s) => {
    navigate(`/t/${tenantSlug}/reservar/${servicioId}`, {
      state: {
        slot: {
          fecha_hora_inicio: s.fecha_hora_inicio,
          fecha_hora_fin: s.fecha_hora_fin,
          sesion_existente_id: s.id,
          asesor: s.asesor,
        },
      },
    })
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-gray-900">Sesiones abiertas</h2>
        <button
          type="button"
          onClick={() => navigate(`/t/${tenantSlug}/servicio/${servicioId}`)}
          className="text-sm text-blue-600 hover:underline"
        >
          Ver calendario
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-center">
          <p className="mb-1 text-sm text-red-700">{error}</p>
          <button
            type="button"
            onClick={fetchSesiones}
            className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-red-700"
          >
            Intentar de nuevo
          </button>
        </div>
      )}

      {loading && (
        <div className="space-y-3">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      )}

      {!loading && !error && items.length === 0 && (
        <p className="py-12 text-center text-gray-500">
          No hay sesiones abiertas disponibles para este servicio.
        </p>
      )}

      {!loading && !error && items.length > 0 && (
        <div className="space-y-3">
          {items.map((s) => {
            const lugares = s.lugares_disponibles ?? Math.max(0, (s.cupo_maximo ?? 0) - (s.inscritos ?? 0))
            return (
              <div
                key={s.id}
                className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:shadow-md"
              >
                <div className="mb-2 flex items-start justify-between gap-3">
                  <p className="text-base font-semibold text-gray-900">
                    {formatFechaHora(s.fecha_hora_inicio, s.timezone ?? 'America/Mexico_City')}
                  </p>
                  <span className="inline-flex shrink-0 items-center rounded-full border border-green-200 bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">
                    {lugares} lugar{lugares !== 1 ? 'es' : ''}
                  </span>
                </div>

                <p className="mb-1 text-sm text-gray-600">
                  {toLocalTime(s.fecha_hora_inicio, s.timezone ?? 'America/Mexico_City')}
                  {' — '}
                  {toLocalTime(s.fecha_hora_fin, s.timezone ?? 'America/Mexico_City')}
                </p>

                {s.asesor && (
                  <p className="mb-3 text-sm text-gray-600">
                    <span className="font-medium text-gray-700">Asesor:</span> {s.asesor.nombre}
                  </p>
                )}

                <button
                  type="button"
                  onClick={() => unirse(s)}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
                >
                  Unirme
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
