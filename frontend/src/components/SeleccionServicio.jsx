import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import client from '../api/client'
import { errorMensaje } from '../utils/errores'
import { Badge, Button, Card } from './ui'

const MODALIDAD_INFO = {
  virtual: { icon: '💻', label: 'Virtual' },
  presencial: { icon: '📍', label: 'Presencial' },
  hibrida: { icon: '🔄', label: 'Híbrida' },
}

const TIPO_INFO = {
  individual: { label: 'Individual', tono: 'info' },
  grupal: { label: 'Grupal', tono: 'warning' },
  recurrente: { label: 'Recurrente', tono: 'neutral' },
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
      }
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
      <Card className="w-full max-w-xl text-center">
        <p className="mb-1 font-semibold text-red-700">No se pudieron cargar los servicios</p>
        <p className="mb-4 text-sm text-red-600">{error}</p>
        <Button variant="danger" onClick={fetchServicios} fullWidth={false}>
          Intentar de nuevo
        </Button>
      </Card>
    )
  }

  if (servicios.length === 0) {
    return (
      <Card className="w-full max-w-xl text-center" padding="md">
        <p className="text-gray-500">No hay servicios disponibles.</p>
      </Card>
    )
  }

  return (
    <div className="w-full max-w-4xl">
      <h2 className="mb-1 text-xl font-bold text-gray-900">¿Qué servicio necesitas?</h2>
      <p className="mb-6 text-sm text-gray-500">Elige uno para ver los horarios disponibles.</p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {servicios.map((s) => {
          const mod = MODALIDAD_INFO[s.modalidad] ?? { icon: '🕐', label: s.modalidad }
          const tipo = TIPO_INFO[s.tipo_agenda] ?? { label: s.tipo_agenda, tono: 'neutral' }
          const precio = formatPrecio(s.precio, s.moneda)
          return (
            <Card key={s.id} padding="md" className="flex flex-col transition hover:shadow-md">
              <div className="mb-2 flex items-start justify-between gap-2">
                <h3 className="text-lg font-semibold text-gray-900">{s.nombre}</h3>
                <Badge tono={tipo.tono}>{tipo.label}</Badge>
              </div>
              {s.descripcion && <p className="mb-4 text-sm text-gray-600">{s.descripcion}</p>}
              <div className="mb-4 space-y-1 text-sm text-gray-700">
                <p>
                  <span className="mr-2">⏱</span>
                  {s.duracion_minutos} min
                </p>
                <p>
                  <span className="mr-2">{mod.icon}</span>
                  <Badge tono="neutral">{mod.label}</Badge>
                </p>
              </div>
              {s.tiene_sesiones_abiertas && (
                <Link
                  to={`/t/${tenantSlug}/servicio/${s.id}/sesiones-abiertas`}
                  className="mb-2 block rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-center text-xs font-medium text-green-700 hover:bg-green-100"
                >
                  Ya hay sesiones abiertas — únete
                </Link>
              )}
              <div className="mt-auto flex items-center justify-between gap-3">
                <span className="text-base font-bold text-gray-900">{precio ?? 'Sin costo'}</span>
                <Button
                  type="button"
                  onClick={() => navigate(`/t/${tenantSlug}/servicio/${s.id}`)}
                  fullWidth={false}
                >
                  Agendar
                </Button>
              </div>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
