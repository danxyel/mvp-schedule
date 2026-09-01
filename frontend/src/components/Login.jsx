import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import client from '../api/client'
import { Button, Card, Field } from './ui'

const APP_NOMBRE = import.meta.env.VITE_APP_NOMBRE || 'MVP Schedule'

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
  const tenantSlug = sessionStorage.getItem('tenantSlug')
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
      <Card className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <h1 className="text-xl font-bold text-gray-900">{APP_NOMBRE}</h1>
          <p className="mt-1 text-sm text-gray-500">Inicia sesión para continuar</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <Field
            label="Email"
            name="email"
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value)
              if (error) setError(null)
            }}
            placeholder="correo@ejemplo.com"
            required
          />

          <Field
            label="Contraseña"
            name="password"
            type="password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value)
              if (error) setError(null)
            }}
            placeholder="••••••••"
            required
          />

          {error && (
            <p
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
            >
              {error}
            </p>
          )}

          <Button type="submit" loading={loading}>
            {loading ? 'Entrando...' : 'Entrar'}
          </Button>
        </form>

        <div className="mt-4 space-y-2 text-center">
          <Link to="/recuperar-password" className="text-sm text-brand-700 hover:underline">
            ¿Olvidaste tu contraseña?
          </Link>

          {tenantSlug && (
            <p>
              <Link
                to={`/t/${tenantSlug}/reclamar`}
                className="text-sm text-brand-700 hover:underline"
              >
                ¿No tienes contraseña? Reclama tu cuenta
              </Link>
            </p>
          )}
        </div>
      </Card>
    </div>
  )
}
