import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate, Link } from 'react-router-dom'
import client from '../api/client'

function persistirSesion({ token, usuario, tenantSlug, tenantNombre }) {
  const guardar = (clave, valor) => {
    if (valor) sessionStorage.setItem(clave, valor)
    else sessionStorage.removeItem(clave)
  }
  guardar('token', token)
  guardar('usuario', usuario ? JSON.stringify(usuario) : null)
  guardar('tenantSlug', tenantSlug)
  guardar('tenantNombre', tenantNombre)
}

export default function RestablecerPassword() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  const navigate = useNavigate()

  const [estadoToken, setEstadoToken] = useState('verificando') // verificando | valido | invalido
  const [password, setPassword] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!token) {
      setEstadoToken('invalido')
      return
    }
    let activo = true
    client.GET('/auth/activar-cuenta/validar', { params: { query: { token } } }).then(({ data }) => {
      if (!activo) return
      setEstadoToken(data?.valido ? 'valido' : 'invalido')
    })
    return () => {
      activo = false
    }
  }, [token])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (loading) return
    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres')
      return
    }
    if (password !== confirmar) {
      setError('Las contraseñas no coinciden')
      return
    }

    setLoading(true)
    setError(null)
    const { data, error: fetchErr, response } = await client.POST('/auth/activar-cuenta', {
      body: { token, password },
    })
    setLoading(false)

    if (fetchErr) {
      if (response?.status === 400) {
        setEstadoToken('invalido')
      } else if (response?.status === 422) {
        setError('Verifica los datos ingresados')
      } else {
        setError('No se pudo restablecer la contraseña. Intenta de nuevo.')
      }
      return
    }

    const usuario = {
      usuario_id: data.usuario_id,
      nombre: data.nombre,
      rol: data.rol,
      tenant_slug: data.tenant_slug ?? null,
      tenant_nombre: data.tenant_nombre ?? null,
    }

    persistirSesion({
      token: data.token,
      usuario,
      tenantSlug: usuario.tenant_slug,
      tenantNombre: usuario.tenant_nombre,
    })

    if (usuario.rol === 'superadmin') {
      navigate('/superadmin')
    } else if (usuario.rol === 'admin' || usuario.rol === 'asesor') {
      navigate('/admin')
    } else if (usuario.rol === 'cliente' && !usuario.tenant_slug) {
      navigate('/seleccion-tenant')
    } else if (usuario.rol === 'cliente') {
      navigate('/mis-reservas')
    } else {
      navigate('/')
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="mb-6 text-center">
          <h1 className="text-xl font-bold text-gray-900">MVP Schedule</h1>
          <p className="mt-1 text-sm text-gray-500">Restablece tu contraseña</p>
        </div>

        {estadoToken === 'verificando' && (
          <p className="text-center text-sm text-gray-500">Verificando enlace...</p>
        )}

        {estadoToken === 'invalido' && (
          <div className="text-center">
            <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-3 text-sm text-red-700">
              Este enlace no es válido o ya expiró.
            </p>
            <Link to="/recuperar-password" className="text-sm font-medium text-blue-600 hover:underline">
              Pedir un enlace nuevo
            </Link>
          </div>
        )}

        {estadoToken === 'valido' && (
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <p className="text-sm text-gray-500">Elige una nueva contraseña para tu cuenta.</p>
            <div>
              <label htmlFor="password" className="mb-1 block text-sm font-medium text-gray-700">
                Contraseña
              </label>
              <input
                id="password"
                type="password"
                autoComplete="new-password"
                required
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value)
                  if (error) setError(null)
                }}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none transition focus:ring-2 focus:ring-blue-500"
                placeholder="Mínimo 8 caracteres"
              />
            </div>
            <div>
              <label htmlFor="confirmar" className="mb-1 block text-sm font-medium text-gray-700">
                Confirmar contraseña
              </label>
              <input
                id="confirmar"
                type="password"
                autoComplete="new-password"
                required
                value={confirmar}
                onChange={(e) => {
                  setConfirmar(e.target.value)
                  if (error) setError(null)
                }}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none transition focus:ring-2 focus:ring-blue-500"
                placeholder="Repite tu contraseña"
              />
            </div>

            {error && (
              <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? 'Guardando...' : 'Guardar nueva contraseña'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
