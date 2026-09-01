import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import client from '../api/client'
import { getLocalOffset } from '../utils/fechas'
import { errorMensaje } from '../utils/errores'
import SelectorFecha from './common/SelectorFecha'

function toDateInputValue(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export default function SolicitarFecha() {
  const { tenantSlug, servicioId } = useParams()
  const navigate = useNavigate()
  const token = sessionStorage.getItem('token')

  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)

  const [servicio, setServicio] = useState(null)
  const [loadingServicio, setLoadingServicio] = useState(true)
  const [currentDate, setCurrentDate] = useState(() => hoy)
  const [hora, setHora] = useState('09:00')
  const [notas, setNotas] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [enviado, setEnviado] = useState(false)

  const fetchServicio = useCallback(async () => {
    setLoadingServicio(true)
    const { data, error: fetchErr } = await client.GET(
      '/api/v2/{tenant_slug}/servicios/{servicio_id}',
      {
        params: { path: { tenant_slug: tenantSlug, servicio_id: servicioId } },
      },
    )
    setLoadingServicio(false)
    if (fetchErr) {
      setError(errorMensaje(fetchErr))
      return
    }
    setServicio(data)
  }, [tenantSlug, servicioId])

  useEffect(() => {
    fetchServicio()
  }, [fetchServicio])

  const enviar = async (e) => {
    e.preventDefault()
    if (!hora) return

    setSubmitting(true)
    setError(null)

    const fechaHoraPropuesta = `${toDateInputValue(currentDate)}T${hora}${getLocalOffset()}`
    const { error: fetchErr } = await client.POST(
      '/api/v2/{tenant_slug}/solicitudes',
      {
        params: { path: { tenant_slug: tenantSlug } },
        body: {
          servicio_id: Number(servicioId),
          fecha_hora_propuesta: fechaHoraPropuesta,
          notas_cliente: notas.trim() || null,
        },
        headers: { Authorization: `Bearer ${token}` },
      },
    )

    setSubmitting(false)
    if (fetchErr) {
      setError(errorMensaje(fetchErr))
      return
    }
    setEnviado(true)
  }

  if (loadingServicio) {
    return (
      <div className="mx-auto max-w-xl py-10 text-center">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600" />
      </div>
    )
  }

  if (enviado) {
    return (
      <div className="mx-auto max-w-xl">
        <div className="rounded-xl border border-green-200 bg-green-50 p-6 text-center">
          <h2 className="mb-2 text-lg font-semibold text-green-800">
            Tu solicitud fue enviada
          </h2>
          <p className="mb-4 text-sm text-green-700">
            Te avisaremos cuando el negocio la revise.
          </p>
          <Link
            to="/mis-solicitudes"
            className="inline-block rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-green-700"
          >
            Ver mis solicitudes
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-xl">
      <h2 className="mb-1 text-xl font-semibold text-gray-900">
        Proponer otra fecha
      </h2>
      {servicio && (
        <p className="mb-6 text-sm text-gray-600">
          Servicio: <span className="font-medium text-gray-800">{servicio.nombre}</span>
        </p>
      )}

      {error && (
        <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <form onSubmit={enviar} className="space-y-6" noValidate>
        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700">
            Fecha propuesta
          </label>
          <SelectorFecha
            value={currentDate}
            onChange={setCurrentDate}
            minDate={hoy}
          />
        </div>

        <div>
          <label htmlFor="solicitud-hora" className="mb-1 block text-sm font-medium text-gray-700">
            Hora propuesta
          </label>
          <input
            id="solicitud-hora"
            type="time"
            required
            value={hora}
            onChange={(e) => setHora(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none transition focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label htmlFor="solicitud-notas" className="mb-1 block text-sm font-medium text-gray-700">
            Notas para el negocio (opcional)
          </label>
          <textarea
            id="solicitud-notas"
            rows={3}
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            placeholder="Ej. Prefiero sesión por la tarde, tengo disponibilidad de lunes a jueves..."
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none transition focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={submitting || !hora}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? 'Enviando...' : 'Enviar solicitud'}
          </button>
        </div>
      </form>
    </div>
  )
}
