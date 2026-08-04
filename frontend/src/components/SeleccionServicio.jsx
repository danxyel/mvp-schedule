import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import client from '../api/client'
import { errorMensaje } from '../utils/errores'
const MODALIDAD_INFO = {
  virtual: { icon: '💻', label: 'Virtual' },
  presencial: { icon: '📍', label: 'Presencial' },
  hibrida: { icon: '🔄', label: 'Híbrida' },
}

const TIPO_INFO = {
  individual: { label: 'Individual', className: 'border-blue-200 bg-blue-100 text-blue-700' },
  grupal: { label: 'Grupal', className: 'border-purple-200 bg-purple-100 text-purple-700' },
  recurrente: { label: 'Recurrente', className: 'border-orange-200 bg-orange-100 text-orange-700' },
}

function formatPrecio(precio, moneda) {
  if (precio === null || precio === undefined || precio === '') return null
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: moneda ?? 'MXN',
  }).format(Number(precio))
}

export default function SeleccionServicio() {
  const { tenantSlug } = useParams()
  const navigate = useNavigate()
  const [servicios, setServicios] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchServicios = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { data, error: fetchErr } = await client.GET(
      '/api/v2/{tenant_slug}/servicios',
      {
        params: { path: { tenant_slug: tenantSlug } },
      },
    )
    if (fetchErr) {
      setError(errorMensaje(fetchErr))
      setLoading(false)
      return
    }
    setServicios(data ?? [])
    setLoading(false)
  }, [tenantSlug])

  useEffect(() => {
    fetchServicios()
  }, [fetchServicios])

  if (loading) {
    return (
      <div className="w-full max-w-4xl">
        <div className="mb-6 h-7 w-56 rounded-lg bg-gray-100" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-44 animate-pulse rounded-xl border border-gray-200 bg-gray-50" />
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="w-full max-w-xl rounded-lg border border-red-200 bg-red-50 p-6 text-center">
        <p className="mb-1 font-semibold text-red-700">No se pudieron cargar los servicios</p>
        <p className="mb-4 text-sm text-red-600">{error}</p>
        <button
          type="button"
          onClick={fetchServicios}
          className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700"
        >
          Intentar de nuevo
        </button>
      </div>
    )
  }

  if (servicios.length === 0) {
    return (
      <div className="w-full max-w-xl rounded-lg border border-gray-200 bg-white p-10 text-center">
        <p className="text-gray-500">No hay servicios disponibles.</p>
      </div>
    )
  }

  return (
    <div className="w-full max-w-4xl">
      <h2 className="mb-1 text-xl font-bold text-gray-900">¿Qué servicio necesitas?</h2>
      <p className="mb-6 text-sm text-gray-500">Elige uno para ver los horarios disponibles.</p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {servicios.map((s) => {
          const mod = MODALIDAD_INFO[s.modalidad] ?? { icon: '🕐', label: s.modalidad }
          const tipo = TIPO_INFO[s.tipo_agenda] ?? {
            label: s.tipo_agenda,
            className: 'border-gray-200 bg-gray-100 text-gray-600',
          }
          const precio = formatPrecio(s.precio, s.moneda)
          return (
            <div
              key={s.id}
              className="flex flex-col rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:shadow-md"
            >
              <div className="mb-2 flex items-start justify-between gap-2">
                <h3 className="text-lg font-semibold text-gray-900">{s.nombre}</h3>
                <span
                  className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${tipo.className}`}
                >
                  {tipo.label}
                </span>
              </div>
              {s.descripcion && <p className="mb-4 text-sm text-gray-600">{s.descripcion}</p>}
              <div className="mb-4 space-y-1 text-sm text-gray-700">
                <p>
                  <span className="mr-2">⏱</span>
                  {s.duracion_minutos} min
                </p>
                <p>
                  <span className="mr-2">{mod.icon}</span>
                  {mod.label}
                </p>
              </div>
              <div className="mt-auto flex items-center justify-between">
                <span className="text-base font-bold text-gray-900">{precio ?? 'Sin costo'}</span>
                <button
                  type="button"
                  onClick={() => navigate(`/t/${tenantSlug}/servicio/${s.id}`)}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
                >
                  Agendar
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
