import { useState, useEffect, useCallback } from 'react'
import client from '../../api/client'
import { errorMensaje } from '../../utils/errores'

export default function MercadoPagoTab({ tenantSlug, token }) {
  const [estado, setEstado] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [conectando, setConectando] = useState(false)

  const fetchEstado = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { data, error: fetchErr } = await client.GET(
      '/api/v2/{tenant_slug}/admin/mercadopago/estado',
      {
        params: { path: { tenant_slug: tenantSlug } },
        headers: { Authorization: `Bearer ${token}` },
      }
    )
    if (fetchErr) {
      setError(errorMensaje(fetchErr))
    } else {
      setEstado(data)
    }
    setLoading(false)
  }, [tenantSlug, token])

  useEffect(() => {
    fetchEstado()
  }, [fetchEstado])

  const conectar = async () => {
    setConectando(true)
    setError(null)
    const { data, error: fetchErr } = await client.GET(
      '/api/v2/{tenant_slug}/admin/mercadopago/conectar',
      {
        params: { path: { tenant_slug: tenantSlug } },
        headers: { Authorization: `Bearer ${token}` },
      }
    )
    setConectando(false)
    if (fetchErr || !data?.url) {
      setError(errorMensaje(fetchErr) || 'No se pudo generar el enlace de conexión')
      return
    }
    window.open(data.url, '_blank', 'noopener,noreferrer')
  }

  if (loading) {
    return (
      <div className="animate-pulse space-y-3">
        <div className="h-24 rounded-lg bg-gray-100" />
        <div className="h-10 w-40 rounded-lg bg-gray-100" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h3 className="mb-2 text-lg font-semibold text-gray-900">MercadoPago</h3>
        <p className="mb-4 text-sm text-gray-600">
          Conecta la cuenta de MercadoPago del tenant para que los clientes puedan pagar en línea.
          El dinero llega directamente al tenant; DANIEL Consultoría no cobra comisión por transacción.
        </p>

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="mb-4 flex items-center gap-2">
          <span
            className={`inline-block h-2.5 w-2.5 rounded-full ${
              estado?.conectado ? 'bg-green-500' : 'bg-gray-300'
            }`}
          />
          <span className="text-sm font-medium text-gray-700">
            {estado?.conectado ? 'Cuenta conectada' : 'Sin conectar'}
          </span>
        </div>

        {estado?.conectado && estado?.mp_user_id && (
          <p className="mb-4 text-xs text-gray-500">
            ID de cuenta: {estado.mp_user_id}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={conectar}
            disabled={conectando}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {conectando ? 'Generando enlace...' : estado?.conectado ? 'Reconectar cuenta' : 'Conectar con MercadoPago'}
          </button>
          <button
            type="button"
            onClick={fetchEstado}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
          >
            Actualizar estado
          </button>
        </div>
      </div>
    </div>
  )
}
