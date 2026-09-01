import { useState } from 'react'
import { Link } from 'react-router-dom'
import client from '../api/client'

export default function RecuperarPassword() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [enviado, setEnviado] = useState(false)
  const [error, setError] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (loading) return

    setLoading(true)
    setError(null)
    const { error: fetchErr, response } = await client.POST('/auth/recuperar-password', {
      body: { email },
    })
    setLoading(false)

    if (fetchErr) {
      if (response?.status === 429) {
        setError('Demasiados intentos. Espera un momento e intenta de nuevo.')
      } else if (response?.status === 422) {
        setError('Verifica el correo ingresado.')
      } else {
        setError('No se pudo enviar. Intenta de nuevo.')
      }
      return
    }

    setEnviado(true)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="mb-6 text-center">
          <h1 className="text-xl font-bold text-gray-900">MVP Schedule</h1>
          <p className="mt-1 text-sm text-gray-500">
            Ingresa tu correo y te mandamos un enlace para restablecer tu contraseña.
          </p>
        </div>

        {enviado ? (
          <p className="rounded-lg border border-green-200 bg-green-50 px-3 py-3 text-sm text-green-700">
            Si el correo pertenece a una cuenta, te enviamos un enlace para restablecer tu contraseña. Revisa tu
            bandeja de entrada (y spam).
          </p>
        ) : (
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
              {loading ? 'Enviando...' : 'Enviar enlace'}
            </button>
          </form>
        )}

        <div className="mt-4 text-center">
          <Link to="/login" className="text-sm text-blue-600 hover:underline">
            Volver a iniciar sesión
          </Link>
        </div>
      </div>
    </div>
  )
}
