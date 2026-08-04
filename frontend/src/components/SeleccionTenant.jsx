import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import client from '../api/client'
import { errorMensaje } from '../utils/errores'
export default function SeleccionTenant() {
  const navigate = useNavigate()
  const [tenants, setTenants] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchTenants = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { data, error: fetchErr } = await client.GET('/tenants/publicos')
    if (fetchErr) {
      setError(errorMensaje(fetchErr))
      setLoading(false)
      return
    }
    setTenants(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchTenants()
  }, [fetchTenants])

  if (loading) {
    return (
      <div className="w-full max-w-4xl">
        <div className="mb-6 h-7 w-56 rounded-lg bg-gray-100" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-40 animate-pulse rounded-xl border border-gray-200 bg-gray-50" />
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="w-full max-w-xl rounded-lg border border-red-200 bg-red-50 p-6 text-center">
        <p className="mb-1 font-semibold text-red-700">No se pudieron cargar los espacios</p>
        <p className="mb-4 text-sm text-red-600">{error}</p>
        <button
          type="button"
          onClick={fetchTenants}
          className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700"
        >
          Intentar de nuevo
        </button>
      </div>
    )
  }

  if (tenants.length === 0) {
    return (
      <div className="w-full max-w-xl rounded-lg border border-gray-200 bg-white p-10 text-center">
        <p className="text-gray-500">Aún no hay espacios disponibles para agendar.</p>
      </div>
    )
  }

  return (
    <div className="w-full max-w-4xl">
      <h2 className="mb-1 text-xl font-bold text-gray-900">¿Con quién quieres agendar?</h2>
      <p className="mb-6 text-sm text-gray-500">Elige el espacio al que quieres agendar una sesión.</p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tenants.map((t) => (
          <div
            key={t.id}
            className="flex flex-col rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:shadow-md"
          >
            <div className="mb-3 flex items-center gap-3">
              {t.logo_url ? (
                <img
                  src={t.logo_url}
                  alt={t.nombre}
                  className="h-12 w-12 rounded-lg object-cover"
                />
              ) : (
                <span
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg text-lg font-bold text-white"
                  style={{ backgroundColor: t.color_primario ?? '#2563eb' }}
                >
                  {t.nombre.charAt(0).toUpperCase()}
                </span>
              )}
              <h3 className="text-lg font-semibold text-gray-900">{t.nombre}</h3>
            </div>
            <div className="mt-auto flex justify-end">
              <button
                type="button"
                onClick={() => {
                  sessionStorage.setItem('tenantSlug', t.slug)
                  sessionStorage.setItem('tenantNombre', t.nombre)
                  navigate(`/t/${t.slug}`)
                }}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
              >
                Elegir
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
