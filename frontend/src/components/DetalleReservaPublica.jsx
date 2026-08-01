import { useState, useEffect, useCallback } from 'react'
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

function DetalleSkeleton() {
  return (
    <div className="mx-auto max-w-lg animate-pulse">
      <div className="mb-6 h-5 w-20 rounded bg-gray-200" />
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="mb-4 h-6 w-3/4 rounded bg-gray-200" />
        <div className="space-y-3">
          <div className="h-4 w-1/2 rounded bg-gray-100" />
          <div className="h-4 w-2/3 rounded bg-gray-100" />
          <div className="h-4 w-1/3 rounded bg-gray-100" />
        </div>
      </div>
    </div>
  )
}

export default function DetalleReservaPublica({ tenantSlug, folio, codigo }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchReserva = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data: result, error: fetchErr } = await client.GET(
        '/api/v2/{tenant_slug}/reservas/{folio}/publica',
        {
          params: {
            path: { tenant_slug: tenantSlug, folio },
            query: { codigo_confirmacion: codigo },
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
  }, [tenantSlug, folio, codigo])

  useEffect(() => {
    fetchReserva()
  }, [fetchReserva])

  if (loading) {
    return <DetalleSkeleton />
  }

  if (error) {
    return (
      <div className="mx-auto max-w-lg">
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
          <p className="mb-1 font-semibold text-red-700">Reserva no encontrada</p>
          <p className="text-sm text-red-600">
            {error?.mensaje ?? 'Verifica el folio y código de confirmación'}
          </p>
        </div>
      </div>
    )
  }

  if (!data) {
    return null
  }

  return (
    <div className="mx-auto max-w-lg">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-900">Detalle de reserva</h2>
        <p className="text-sm text-gray-500">Vista pública</p>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-gray-900">
            {data.servicio_nombre ?? 'Servicio'}
          </h3>
          <span
            className={`mt-2 inline-block rounded-full border px-3 py-1 text-xs font-medium ${
              BADGE[data.estado] ?? 'bg-gray-100 text-gray-600'
            }`}
          >
            {ESTADO_LABEL[data.estado] ?? data.estado}
          </span>
        </div>

        <div className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">Fecha y hora:</span>
            <span className="font-medium text-gray-900">
              {toLocalTime(data.fecha_hora_inicio, data.timezone)}
            </span>
          </div>

          <div className="flex justify-between">
            <span className="text-gray-500">Modalidad:</span>
            <span className="font-medium text-gray-900">
              {data.modalidad ?? '—'}
            </span>
          </div>

          {data.precio_final && data.precio_final > 0 && (
            <div className="flex justify-between">
              <span className="text-gray-500">Precio:</span>
              <span className="font-medium text-gray-900">
                {data.precio_final} {data.moneda}
              </span>
            </div>
          )}

          <div className="flex justify-between">
            <span className="text-gray-500">Estado de pago:</span>
            <span className="font-medium text-gray-900">
              {PAGO_LABEL[data.estado_pago] ?? data.estado_pago}
            </span>
          </div>

          <div className="flex justify-between">
            <span className="text-gray-500">Folio:</span>
            <span className="font-mono text-xs text-gray-700">{data.folio}</span>
          </div>

          <div className="flex justify-between">
            <span className="text-gray-500">Código:</span>
            <span className="font-mono text-xs text-gray-700">
              {data.codigo_confirmacion}
            </span>
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-lg border border-blue-200 bg-blue-50 p-4">
        <p className="text-sm text-blue-800">
          <strong>¿Necesitas más detalles?</strong>
          <br />
          Inicia sesión para ver información adicional como ubicación, asesor asignado y enlace de reunión.
        </p>
      </div>
    </div>
  )
}
