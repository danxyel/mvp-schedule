import { useState, useEffect, useCallback } from 'react'
import client from '../../api/client'
import { errorMensaje } from '../../utils/errores'

const CAMPO = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none transition focus:ring-2 focus:ring-blue-500'

export default function GoogleMeetTab({ tenantSlug, token }) {
  const [estado, setEstado] = useState(null)
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(true)
  const [conectando, setConectando] = useState(false)
  const [desconectando, setDesconectando] = useState(false)
  const [revisando, setRevisando] = useState(false)
  const [error, setError] = useState(null)
  const [exito, setExito] = useState(null)

  const fetchEstado = useCallback(async () => {
    setLoading(true)
    setError(null)
    setExito(null)
    const { data, error: fetchErr } = await client.GET(
      '/api/v2/{tenant_slug}/admin/google-meet/estado',
      {
        params: { path: { tenant_slug: tenantSlug } },
        headers: { Authorization: `Bearer ${token}` },
      }
    )
    if (fetchErr) {
      setError(errorMensaje(fetchErr))
    } else {
      setEstado(data)
      setEmail(data?.impersonar_email ?? '')
    }
    setLoading(false)
  }, [tenantSlug, token])

  useEffect(() => {
    fetchEstado()
  }, [fetchEstado])

  const conectar = async (e) => {
    e.preventDefault()
    if (conectando || !email.trim()) return

    setConectando(true)
    setError(null)
    setExito(null)
    const { data, error: fetchErr } = await client.POST(
      '/api/v2/{tenant_slug}/admin/google-meet/conectar',
      {
        params: { path: { tenant_slug: tenantSlug } },
        headers: { Authorization: `Bearer ${token}` },
        body: { impersonar_email: email.trim() },
      }
    )
    setConectando(false)
    if (fetchErr) {
      setError(errorMensaje(fetchErr))
      return
    }
    setEstado(data)
    setExito('Cuenta de Google Meet conectada')
  }

  const desconectar = async () => {
    const mensaje =
      '¿Desconectar la cuenta de Google Meet de este tenant?\n\n' +
      'Esto solo borra la configuración guardada en MVP Schedule; no revoca la delegación de dominio en Google.'
    if (!window.confirm(mensaje)) return

    setDesconectando(true)
    setError(null)
    setExito(null)
    const { data, error: fetchErr } = await client.DELETE(
      '/api/v2/{tenant_slug}/admin/google-meet/desconectar',
      {
        params: { path: { tenant_slug: tenantSlug } },
        headers: { Authorization: `Bearer ${token}` },
      }
    )
    setDesconectando(false)
    if (fetchErr) {
      setError(errorMensaje(fetchErr))
      return
    }
    setEstado(data)
    setEmail('')
    setExito('Cuenta de Google Meet desconectada')
  }

  const revisarContenido = async () => {
    setRevisando(true)
    setError(null)
    setExito(null)
    const { data, error: fetchErr } = await client.POST(
      '/api/v2/{tenant_slug}/admin/google-meet/revisar-contenido',
      {
        params: { path: { tenant_slug: tenantSlug } },
        headers: { Authorization: `Bearer ${token}` },
      }
    )
    setRevisando(false)
    if (fetchErr) {
      setError(errorMensaje(fetchErr))
      return
    }
    setExito(data?.mensaje ?? 'Revisión completada')
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
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h3 className="mb-2 text-lg font-semibold text-gray-900">Google Meet</h3>
        <p className="mb-4 text-sm text-gray-600">
          Conecta un buzón de Google Workspace para generar automáticamente salas de Meet,
          grabaciones y transcripciones de las sesiones virtuales.
        </p>

        {exito && (
          <div className="mb-4 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">
            {exito}
          </div>
        )}
        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="mb-4 flex items-center gap-2">
          <span className={`inline-block h-2.5 w-2.5 rounded-full ${estado?.conectado ? 'bg-green-500' : 'bg-gray-300'}`} />
          <span className="text-sm font-medium text-gray-700">
            {estado?.conectado ? `Conectado: ${estado.impersonar_email}` : 'Sin conectar'}
          </span>
        </div>

        <form onSubmit={conectar} className="space-y-4">
          <div>
            <label htmlFor="google-meet-email" className="mb-1 block text-sm font-medium text-gray-700">
              Correo de Google Workspace a impersonar
            </label>
            <input
              id="google-meet-email"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value)
                if (error) setError(null)
              }}
              placeholder="admin@tenant-workspace.com"
              className={CAMPO}
            />
            <p className="mt-1 text-xs text-gray-500">
              Requiere Domain-Wide Delegation autorizada en el admin console de Google Workspace.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={conectando || !email.trim()}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {conectando ? 'Verificando...' : estado?.conectado ? 'Reconectar cuenta' : 'Conectar Google Meet'}
            </button>
            {estado?.conectado && (
              <button
                type="button"
                onClick={desconectar}
                disabled={desconectando}
                className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {desconectando ? 'Desconectando...' : 'Desconectar'}
              </button>
            )}
          </div>
        </form>
      </div>

      {estado?.conectado && (
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="mb-2 text-lg font-semibold text-gray-900">Revisar contenido ahora</h3>
          <p className="mb-4 text-sm text-gray-600">
            El proceso normalmente corre solo cada 10 minutos. Si el backend
            está en un plan que se duerme por inactividad, usa este botón
            para forzar la revisión manualmente (organiza carpetas, renombra
            archivos y manda el correo de contenido de sesiones ya
            terminadas).
          </p>
          <button
            type="button"
            onClick={revisarContenido}
            disabled={revisando}
            className="rounded-lg bg-gray-800 px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-900 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {revisando ? 'Revisando...' : 'Revisar contenido ahora'}
          </button>
        </div>
      )}
    </div>
  )
}
