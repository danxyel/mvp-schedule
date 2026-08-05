import { useState, useEffect, useCallback } from 'react'
import client from '../../api/client'
import { errorMensaje } from '../../utils/errores'

const METODOS = [
  { value: 'local', label: 'Local (efectivo/transferencia)' },
  { value: 'online', label: 'En línea (MercadoPago)' },
]

const CAMPO = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none transition focus:ring-2 focus:ring-blue-500'

export default function MercadoPagoTab({ tenantSlug, token }) {
  const [estado, setEstado] = useState(null)
  const [metodo, setMetodo] = useState('local')
  const [metodoInicial, setMetodoInicial] = useState('local')
  const [accessToken, setAccessToken] = useState('')
  const [mostrarToken, setMostrarToken] = useState(false)
  const [publicKey, setPublicKey] = useState('')
  const [loading, setLoading] = useState(true)
  const [conectando, setConectando] = useState(false)
  const [desconectando, setDesconectando] = useState(false)
  const [guardandoMetodo, setGuardandoMetodo] = useState(false)
  const [error, setError] = useState(null)
  const [exito, setExito] = useState(null)

  const fetchEstado = useCallback(async () => {
    setLoading(true)
    setError(null)
    setExito(null)
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
      const m = data?.metodo_pago_default ?? 'local'
      setMetodo(m)
      setMetodoInicial(m)
    }
    setLoading(false)
  }, [tenantSlug, token])

  useEffect(() => {
    fetchEstado()
  }, [fetchEstado])

  const conectar = async (e) => {
    e.preventDefault()
    if (conectando || !accessToken.trim()) return

    setConectando(true)
    setError(null)
    setExito(null)
    const { data, error: fetchErr } = await client.POST(
      '/api/v2/{tenant_slug}/admin/mercadopago/conectar',
      {
        params: { path: { tenant_slug: tenantSlug } },
        headers: { Authorization: `Bearer ${token}` },
        body: {
          access_token: accessToken.trim(),
          public_key: publicKey.trim() || undefined,
        },
      }
    )
    setConectando(false)
    if (fetchErr) {
      setError(errorMensaje(fetchErr))
      return
    }
    setEstado(data)
    const m = data?.metodo_pago_default ?? 'local'
    setMetodo(m)
    setMetodoInicial(m)
    setAccessToken('')
    setPublicKey('')
    setExito('Cuenta de MercadoPago conectada')
  }

  const desconectar = async () => {
    const mensaje =
      '¿Desconectar la cuenta de MercadoPago de este tenant?\n\n' +
      'Esto solo borra el token guardado en MVP Schedule; no lo revoca en MercadoPago. ' +
      'Si quieres invalidar el acceso de verdad, regenera el token desde tu panel de MercadoPago.'
    if (!window.confirm(mensaje)) return

    setDesconectando(true)
    setError(null)
    setExito(null)
    const { data, error: fetchErr } = await client.DELETE(
      '/api/v2/{tenant_slug}/admin/mercadopago/desconectar',
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
    const m = data?.metodo_pago_default ?? 'local'
    setMetodo(m)
    setMetodoInicial(m)
    setExito('Cuenta desconectada')
  }

  const guardarMetodo = async (e) => {
    e.preventDefault()
    if (guardandoMetodo || metodo === metodoInicial) return

    setGuardandoMetodo(true)
    setError(null)
    setExito(null)
    const { data, error: fetchErr } = await client.PATCH(
      '/api/v2/{tenant_slug}/admin/tenant/metodo-pago-default',
      {
        params: { path: { tenant_slug: tenantSlug } },
        headers: { Authorization: `Bearer ${token}` },
        body: { metodo_pago_default: metodo },
      }
    )
    setGuardandoMetodo(false)
    if (fetchErr) {
      setError(errorMensaje(fetchErr))
      return
    }
    setEstado((prev) => ({ ...prev, metodo_pago_default: data.metodo_pago_default }))
    setMetodoInicial(data.metodo_pago_default)
    setExito('Método de pago por default actualizado')
  }

  const onlineDeshabilitado = !estado?.conectado

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
        <h3 className="mb-2 text-lg font-semibold text-gray-900">MercadoPago</h3>
        <p className="mb-4 text-sm text-gray-600">
          Conecta la cuenta de MercadoPago del tenant para que los clientes puedan pagar en línea.
          El dinero llega directamente al tenant; DANIEL Consultoría no cobra comisión por transacción.
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

        <div className="mb-4 rounded-lg border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900">
          <p className="mb-2 font-medium">Para conectar tu cuenta:</p>
          <ol className="list-decimal space-y-1 pl-5">
            <li>Entra a tu cuenta de MercadoPago.</li>
            <li>Ve a <strong>Tus integraciones</strong>.</li>
            <li>Crea una aplicación si no tienes una, o usa la que ya exista.</li>
            <li>Abre <strong>Credenciales de producción</strong>.</li>
            <li>Copia el <strong>Access Token</strong> y pégalo aquí.</li>
          </ol>
        </div>

        <form onSubmit={conectar} className="space-y-4">
          <div>
            <label htmlFor="mp-access-token" className="mb-1 block text-sm font-medium text-gray-700">
              Access Token <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                id="mp-access-token"
                type={mostrarToken ? 'text' : 'password'}
                value={accessToken}
                onChange={(e) => setAccessToken(e.target.value)}
                placeholder={estado?.conectado ? '•••• (ya configurado, pega uno nuevo para reemplazarlo)' : 'TEST-... o APP_USR-...'}
                className={`${CAMPO} pr-20`}
              />
              <button
                type="button"
                onClick={() => setMostrarToken((prev) => !prev)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100"
              >
                {mostrarToken ? 'Ocultar' : 'Mostrar'}
              </button>
            </div>
            <p className="mt-1 text-xs text-gray-500">
              Nunca se muestra después de guardarlo. Pegar uno nuevo lo reemplaza.
            </p>
          </div>

          <div>
            <label htmlFor="mp-public-key" className="mb-1 block text-sm font-medium text-gray-700">
              Public Key (opcional)
            </label>
            <input
              id="mp-public-key"
              type="text"
              value={publicKey}
              onChange={(e) => setPublicKey(e.target.value)}
              placeholder="TEST-... o APP_USR-..."
              className={CAMPO}
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={conectando || !accessToken.trim()}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {conectando ? 'Verificando...' : estado?.conectado ? 'Reconectar cuenta' : 'Conectar con MercadoPago'}
            </button>
            <button
              type="button"
              onClick={fetchEstado}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
            >
              Actualizar estado
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

      <form
        onSubmit={guardarMetodo}
        className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm"
      >
        <h3 className="mb-2 text-lg font-semibold text-gray-900">Método de pago por default</h3>
        <p className="mb-4 text-sm text-gray-600">
          Decide cómo se crean las reservas de los clientes por default. Para cobrar en línea, el tenant debe tener MercadoPago conectado.
        </p>

        <div className="mb-4">
          <label htmlFor="metodo-pago-default" className="mb-1 block text-sm font-medium text-gray-700">
            Método de pago
          </label>
          <select
            id="metodo-pago-default"
            value={metodo}
            onChange={(e) => {
              setMetodo(e.target.value)
              setExito(null)
            }}
            className={CAMPO}
          >
            {METODOS.map((m) => (
              <option key={m.value} value={m.value} disabled={m.value === 'online' && onlineDeshabilitado}>
                {m.label}
              </option>
            ))}
          </select>
          {onlineDeshabilitado && metodo === 'online' && (
            <p className="mt-2 text-sm text-yellow-700">
              Conecta una cuenta de MercadoPago primero para activar el pago en línea.
            </p>
          )}
          {onlineDeshabilitado && (
            <p className="mt-2 text-xs text-gray-500">
              La opción "En línea" se deshabilitará mientras no haya una cuenta de MercadoPago conectada.
            </p>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => {
              setMetodo(metodoInicial)
              setExito(null)
              setError(null)
            }}
            disabled={guardandoMetodo || metodo === metodoInicial}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={guardandoMetodo || metodo === metodoInicial}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {guardandoMetodo ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      </form>
    </div>
  )
}
