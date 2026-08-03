import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
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

export default function Login() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (loading) return

    setLoading(true)
    setError(null)
    try {
      const { data, error: fetchErr, response } = await client.POST('/auth/login', {
        body: { email, password },
      })

      if (fetchErr) {
        if (response?.status === 401) {
          setError('Email o contraseña incorrectos')
        } else if (response?.status === 422) {
          setError('Verifica los datos ingresados')
        } else {
          setError('No se pudo iniciar sesión. Intenta de nuevo.')
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

      // Redirigir según el rol
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
    } catch {
      setError('No se pudo conectar al servidor')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="mb-6 text-center">
          <h1 className="text-xl font-bold text-gray-900">MVP Schedule</h1>
          <p className="mt-1 text-sm text-gray-500">Inicia sesión para continuar</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div>
            <label htmlFor="email" className="mb-1 block text-sm font-medium text-gray-700">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => {
                setEmail(e.target.value)
                if (error) setError(null)
              }}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none transition focus:ring-2 focus:ring-blue-500"
              placeholder="correo@ejemplo.com"
            />
          </div>

          <div>
            <label htmlFor="password" className="mb-1 block text-sm font-medium text-gray-700">
              Contraseña
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => {
                setPassword(e.target.value)
                if (error) setError(null)
              }}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none transition focus:ring-2 focus:ring-blue-500"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

      </div>
    </div>
  )
}
