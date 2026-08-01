import { useState } from 'react'
import client from '../api/client'
function emailValido(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export default function Registro({ onRegistro, onVolverALogin }) {
  const [nombre, setNombre] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [telefono, setTelefono] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (loading) return

    if (!nombre.trim()) {
      setError('Escribe tu nombre')
      return
    }
    if (!emailValido(email)) {
      setError('Escribe un email válido')
      return
    }
    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres')
      return
    }
    if (password !== confirmar) {
      setError('Las contraseñas no coinciden')
      return
    }

    setLoading(true)
    setError(null)
    try {
      const { data, error: fetchErr, response } = await client.POST('/auth/register', {
        body: {
          email: email.trim(),
          password,
          nombre: nombre.trim(),
          telefono: telefono.trim() || null,
        },
      })

      if (fetchErr) {
        if (response?.status === 409) {
          setError('Ya existe una cuenta con ese email')
        } else if (response?.status === 422) {
          setError('Verifica los datos ingresados')
        } else {
          setError('No se pudo crear la cuenta. Intenta de nuevo.')
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
      onRegistro(data.token, usuario)
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
          <h1 className="text-xl font-bold text-gray-900">Crea tu cuenta</h1>
          <p className="mt-1 text-sm text-gray-500">Regístrate para agendar tus citas</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div>
            <label htmlFor="registro-nombre" className="mb-1 block text-sm font-medium text-gray-700">
              Nombre *
            </label>
            <input
              id="registro-nombre"
              type="text"
              autoComplete="name"
              required
              value={nombre}
              onChange={(e) => {
                setNombre(e.target.value)
                if (error) setError(null)
              }}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none transition focus:ring-2 focus:ring-blue-500"
              placeholder="Tu nombre completo"
            />
          </div>

          <div>
            <label htmlFor="registro-email" className="mb-1 block text-sm font-medium text-gray-700">
              Email *
            </label>
            <input
              id="registro-email"
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
            <label htmlFor="registro-password" className="mb-1 block text-sm font-medium text-gray-700">
              Contraseña *
            </label>
            <input
              id="registro-password"
              type="password"
              autoComplete="new-password"
              required
              value={password}
              onChange={(e) => {
                setPassword(e.target.value)
                if (error) setError(null)
              }}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none transition focus:ring-2 focus:ring-blue-500"
              placeholder="Mínimo 6 caracteres"
            />
          </div>

          <div>
            <label htmlFor="registro-confirmar" className="mb-1 block text-sm font-medium text-gray-700">
              Confirmar contraseña *
            </label>
            <input
              id="registro-confirmar"
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

          <div>
            <label htmlFor="registro-telefono" className="mb-1 block text-sm font-medium text-gray-700">
              Teléfono (opcional)
            </label>
            <input
              id="registro-telefono"
              type="tel"
              autoComplete="tel"
              value={telefono}
              onChange={(e) => {
                setTelefono(e.target.value)
                if (error) setError(null)
              }}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none transition focus:ring-2 focus:ring-blue-500"
              placeholder="55 1234 5678"
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
            {loading ? 'Creando cuenta...' : 'Crear cuenta'}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-gray-600">
          ¿Ya tienes cuenta?{' '}
          <button
            type="button"
            onClick={onVolverALogin}
            className="font-medium text-blue-600 transition hover:text-blue-700"
          >
            Inicia sesión
          </button>
        </p>
      </div>
    </div>
  )
}
