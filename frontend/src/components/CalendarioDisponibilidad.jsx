import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import client from '../api/client'
import { getLocalOffset } from '../utils/fechas'
import SelectorFecha from './common/SelectorFecha'
import { badgeClassForTone } from '../utils/estado'
const MOTIVO_LABELS = {
  bloqueado: 'No disponible',
  ocupado: 'Ocupado',
  cupo_lleno: 'Lleno',
}

function toLocalTime(utcString, timezone) {
  const date = new Date(utcString)
  return new Intl.DateTimeFormat('es-MX', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: timezone,
  }).format(date)
}

function formatDateTitle(date) {
  return new Intl.DateTimeFormat('es-MX', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date)
}

function toDateInputValue(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function SlotSkeleton() {
  return (
    <div className="animate-pulse rounded-lg border border-gray-200 bg-gray-100 px-4 py-4">
      <div className="mb-2 h-4 w-2/3 rounded bg-gray-300" />
      <div className="h-3 w-1/3 rounded bg-gray-300" />
    </div>
  )
}

export default function CalendarioDisponibilidad() {
  const { tenantSlug, servicioId } = useParams()
  const navigate = useNavigate()
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  const [currentDate, setCurrentDate] = useState(() => hoy)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchDisponibilidad = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const fechaStr = `${toDateInputValue(currentDate)}T00:00:00${getLocalOffset()}`
      const { data: result, error: fetchErr } = await client.GET(
        '/api/v2/{tenant_slug}/servicios/{servicio_id}/disponibilidad',
        {
          params: {
            path: { tenant_slug: tenantSlug, servicio_id: servicioId },
            query: { fecha: fechaStr },
          },
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
  }, [currentDate, tenantSlug, servicioId])

  useEffect(() => {
    fetchDisponibilidad()
  }, [fetchDisponibilidad])

  const motivoLabel = (motivo) => MOTIVO_LABELS[motivo] ?? motivo

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl">
        <div className="h-9 w-24 animate-pulse rounded-lg bg-gray-200" />
        <div className="mt-6 grid gap-3">
          <SlotSkeleton />
          <SlotSkeleton />
          <SlotSkeleton />
          <SlotSkeleton />
          <SlotSkeleton />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="mx-auto max-w-2xl">
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
          <p className="mb-1 font-semibold text-red-700">
            Error al cargar disponibilidad
          </p>
          <p className="mb-4 text-sm text-red-600">
            {error?.message ?? JSON.stringify(error)}
          </p>
          <button
            type="button"
            onClick={fetchDisponibilidad}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700"
          >
            Intentar de nuevo
          </button>
        </div>
      </div>
    )
  }

  const timezone = data?.timezone ?? 'America/Mexico_City'

  return (
    <div className="mx-auto max-w-3xl">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-[auto_1fr]">
        <div className="md:sticky md:top-4 md:self-start">
          <SelectorFecha
            value={currentDate}
            onChange={setCurrentDate}
            minDate={hoy}
          />
        </div>

        <div>
          <h2 className="mb-4 text-lg font-semibold capitalize text-gray-900">
            {data ? formatDateTitle(new Date(data.fecha)) : formatDateTitle(currentDate)}
          </h2>

          {data && data.slots.length === 0 && (
            <p className="py-8 text-center text-gray-500">
              No hay horarios disponibles para este d&iacute;a.
            </p>
          )}

          <div className="grid gap-3">
            {data?.slots.map((slot, idx) => {
              if (!slot.disponible) {
                const label = motivoLabel(slot.motivo_no_disponible)

                return (
                  <div
                    key={idx}
                    className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 opacity-50"
                  >
                    <p className="text-sm font-medium text-slate-500">
                      {toLocalTime(slot.fecha_hora_inicio, timezone)} &mdash;{' '}
                      {toLocalTime(slot.fecha_hora_fin, timezone)}
                    </p>
                    <span className={badgeClassForTone('idle')}>{label}</span>
                  </div>
                )
              }

              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => navigate(`/t/${tenantSlug}/reservar/${servicioId}`, { state: { slot } })}
                  className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3 text-left transition hover:bg-slate-50 hover:shadow-sm"
                >
                  <p className="text-sm font-semibold text-slate-800">
                    {toLocalTime(slot.fecha_hora_inicio, timezone)} &mdash;{' '}
                    {toLocalTime(slot.fecha_hora_fin, timezone)}
                  </p>
                  <span className={badgeClassForTone('accent')}>
                    {slot.cupo_disponible != null && slot.cupo_disponible > 0
                      ? `${slot.cupo_disponible} lugar${slot.cupo_disponible !== 1 ? 'es' : ''}`
                      : 'Disponible'}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
