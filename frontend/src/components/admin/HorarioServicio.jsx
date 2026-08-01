import { useState, useEffect, useCallback } from 'react'
import createClient from 'openapi-fetch'
import Modal from '../common/Modal'

const client = createClient({ baseUrl: 'http://localhost:8000' })

const DIAS = [
  'Lunes',
  'Martes',
  'Miércoles',
  'Jueves',
  'Viernes',
  'Sábado',
  'Domingo',
]

function errorMensaje(err) {
  return err?.mensaje ?? err?.detail ?? err?.message ?? JSON.stringify(err)
}

export default function HorarioServicio({ servicio, tenantSlug, token, onClose }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [accionError, setAccionError] = useState(null)
  const [horarios, setHorarios] = useState([])
  const [guardando, setGuardando] = useState(null)
  const [horas, setHoras] = useState(() =>
    Object.fromEntries(DIAS.map((_, d) => [d, { inicio: '09:00', fin: '18:00' }])),
  )

  const cargar = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { data, error: fetchErr } = await client.GET(
      '/api/v2/{tenant_slug}/admin/servicios/{servicio_id}/horarios',
      {
        params: { path: { tenant_slug: tenantSlug, servicio_id: servicio.id } },
        headers: { Authorization: `Bearer ${token}` },
      },
    )
    if (fetchErr) {
      setError(errorMensaje(fetchErr))
      setLoading(false)
      return
    }
    setHorarios(data ?? [])
    setHoras((prev) => {
      const next = { ...prev }
      for (const h of data ?? []) {
        next[h.dia_semana] = {
          inicio: h.hora_inicio.slice(0, 5),
          fin: h.hora_fin.slice(0, 5),
        }
      }
      return next
    })
    setLoading(false)
  }, [tenantSlug, token, servicio.id])

  useEffect(() => {
    cargar()
  }, [cargar])

  const crearHorario = async (dia) => {
    const { inicio, fin } = horas[dia]
    if (inicio >= fin) {
      setAccionError('La hora de inicio debe ser antes de la de fin')
      return
    }
    setGuardando(dia)
    setAccionError(null)
    const { data, error: fetchErr, response } = await client.POST(
      '/api/v2/{tenant_slug}/admin/servicios/{servicio_id}/horarios',
      {
        params: { path: { tenant_slug: tenantSlug, servicio_id: servicio.id } },
        body: { dia_semana: dia, hora_inicio: inicio, hora_fin: fin },
        headers: { Authorization: `Bearer ${token}` },
      },
    )
    setGuardando(null)
    if (fetchErr) {
      setAccionError(
        response?.status === 422
          ? 'Horario inválido. Verifica el día y las horas.'
          : errorMensaje(fetchErr),
      )
      return
    }
    setHorarios((prev) => [...prev, data])
  }

  const eliminarHorario = async (h) => {
    setGuardando(h.dia_semana)
    setAccionError(null)
    const { error: fetchErr } = await client.DELETE(
      '/api/v2/{tenant_slug}/admin/servicios/{servicio_id}/horarios/{h_id}',
      {
        params: {
          path: {
            tenant_slug: tenantSlug,
            servicio_id: servicio.id,
            h_id: h.id,
          },
        },
        headers: { Authorization: `Bearer ${token}` },
      },
    )
    setGuardando(null)
    if (fetchErr) {
      setAccionError(errorMensaje(fetchErr))
      return
    }
    setHorarios((prev) => prev.filter((x) => x.id !== h.id))
  }

  const toggleDia = async (dia) => {
    const existente = horarios.find((h) => h.dia_semana === dia)
    if (existente) {
      await eliminarHorario(existente)
    } else {
      await crearHorario(dia)
    }
  }

  const guardarHora = async (dia, campo, valor) => {
    const existente = horarios.find((h) => h.dia_semana === dia)
    setHoras((prev) => ({ ...prev, [dia]: { ...prev[dia], [campo]: valor } }))
    if (!existente) return
    const nuevo = { ...horas[dia], [campo]: valor }
    if (nuevo.inicio >= nuevo.fin) {
      setAccionError('La hora de inicio debe ser antes de la de fin')
      return
    }
    setGuardando(dia)
    setAccionError(null)
    await client.DELETE(
      '/api/v2/{tenant_slug}/admin/servicios/{servicio_id}/horarios/{h_id}',
      {
        params: {
          path: {
            tenant_slug: tenantSlug,
            servicio_id: servicio.id,
            h_id: existente.id,
          },
        },
        headers: { Authorization: `Bearer ${token}` },
      },
    )
    const { data, error: fetchErr, response } = await client.POST(
      '/api/v2/{tenant_slug}/admin/servicios/{servicio_id}/horarios',
      {
        params: { path: { tenant_slug: tenantSlug, servicio_id: servicio.id } },
        body: { dia_semana: dia, hora_inicio: nuevo.inicio, hora_fin: nuevo.fin },
        headers: { Authorization: `Bearer ${token}` },
      },
    )
    setGuardando(null)
    if (fetchErr) {
      setAccionError(
        response?.status === 422
          ? 'Horario inválido. Verifica las horas.'
          : errorMensaje(fetchErr),
      )
      return
    }
    setHorarios((prev) => prev.map((h) => (h.dia_semana === dia ? data : h)))
  }

  return (
    <Modal
      title={`Horario de propuestas · ${servicio.nombre}`}
      onClose={onClose}
      maxWidth="max-w-xl"
    >
      {loading ? (
        <div className="animate-pulse space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-10 rounded-lg bg-gray-100" />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
          <p className="mb-4 text-sm text-red-700">{error}</p>
          <button
            type="button"
            onClick={cargar}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700"
          >
            Intentar de nuevo
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-xs text-gray-500">
            Ventana en la que el cliente puede proponer fecha y hora. La
            disponibilidad real del asesor se valida al confirmar la
            solicitud.
          </p>
          <div className="space-y-2">
            {DIAS.map((nombre, dia) => {
              const existente = horarios.find((h) => h.dia_semana === dia)
              const ocupado = guardando === dia
              return (
                <div
                  key={dia}
                  className={`flex flex-wrap items-center gap-3 rounded-lg border px-3 py-2 ${
                    existente ? 'border-blue-200 bg-blue-50/50' : 'border-gray-200 bg-white'
                  }`}
                >
                  <label className="flex w-36 cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      checked={!!existente}
                      disabled={ocupado}
                      onChange={() => toggleDia(dia)}
                      className="h-4 w-4 rounded border-gray-300 text-blue-600 accent-blue-600"
                    />
                    <span className="text-sm font-medium text-gray-800">{nombre}</span>
                  </label>
                  {existente && (
                    <div className="flex items-center gap-2 text-sm">
                      <input
                        type="time"
                        value={horas[dia].inicio}
                        disabled={ocupado}
                        onChange={(e) => guardarHora(dia, 'inicio', e.target.value)}
                        className="rounded-lg border border-gray-300 px-2 py-1 text-sm text-gray-700 outline-none transition focus:ring-2 focus:ring-blue-500"
                      />
                      <span className="text-gray-400">a</span>
                      <input
                        type="time"
                        value={horas[dia].fin}
                        disabled={ocupado}
                        onChange={(e) => guardarHora(dia, 'fin', e.target.value)}
                        className="rounded-lg border border-gray-300 px-2 py-1 text-sm text-gray-700 outline-none transition focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  )}
                  {ocupado && <span className="text-xs text-blue-600">Guardando...</span>}
                </div>
              )
            })}
          </div>

          {accionError && (
            <p
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
            >
              {accionError}
            </p>
          )}

          <div className="flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}
