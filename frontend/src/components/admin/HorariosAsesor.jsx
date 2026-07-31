import { useState, useEffect, useCallback } from 'react'
import createClient from 'openapi-fetch'

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

function Modal({ title, onClose, children }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[80vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold text-gray-900">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export default function HorariosAsesor({ asesor, tenantSlug, token, onClose }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [accionError, setAccionError] = useState(null)
  const [horarios, setHorarios] = useState([])
  const [servicios, setServicios] = useState([])
  const [asignaciones, setAsignaciones] = useState([])
  const [horas, setHoras] = useState(() =>
    Object.fromEntries(DIAS.map((_, d) => [d, { inicio: '09:00', fin: '18:00' }])),
  )
  const [guardando, setGuardando] = useState(null)

  const cargar = useCallback(async () => {
    setLoading(true)
    setError(null)
    const [rH, rS, rA] = await Promise.all([
      client.GET('/api/v2/{tenant_slug}/admin/asesores/{ut_id}/horarios', {
        params: { path: { tenant_slug: tenantSlug, ut_id: asesor.id } },
        headers: { Authorization: `Bearer ${token}` },
      }),
      client.GET('/api/v2/{tenant_slug}/admin/servicios', {
        params: { path: { tenant_slug: tenantSlug } },
        headers: { Authorization: `Bearer ${token}` },
      }),
      client.GET('/api/v2/{tenant_slug}/admin/asesores/{ut_id}/servicios', {
        params: { path: { tenant_slug: tenantSlug, ut_id: asesor.id } },
        headers: { Authorization: `Bearer ${token}` },
      }),
    ])
    if (rH.error || rS.error || rA.error) {
      setError(errorMensaje(rH.error ?? rS.error ?? rA.error))
      setLoading(false)
      return
    }
    setHorarios(rH.data ?? [])
    setServicios((rS.data ?? []).filter((s) => s.activo))
    setAsignaciones(rA.data ?? [])
    setHoras((prev) => {
      const next = { ...prev }
      for (const h of rH.data ?? []) {
        next[h.dia_semana] = {
          inicio: h.hora_inicio.slice(0, 5),
          fin: h.hora_fin.slice(0, 5),
        }
      }
      return next
    })
    setLoading(false)
  }, [tenantSlug, token, asesor.id])

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
      '/api/v2/{tenant_slug}/admin/asesores/{ut_id}/horarios',
      {
        params: { path: { tenant_slug: tenantSlug, ut_id: asesor.id } },
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
      '/api/v2/{tenant_slug}/admin/asesores/{ut_id}/horarios/{h_id}',
      {
        params: {
          path: { tenant_slug: tenantSlug, ut_id: asesor.id, h_id: h.id },
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
      '/api/v2/{tenant_slug}/admin/asesores/{ut_id}/horarios/{h_id}',
      {
        params: {
          path: { tenant_slug: tenantSlug, ut_id: asesor.id, h_id: existente.id },
        },
        headers: { Authorization: `Bearer ${token}` },
      },
    )
    const { data, error: fetchErr, response } = await client.POST(
      '/api/v2/{tenant_slug}/admin/asesores/{ut_id}/horarios',
      {
        params: { path: { tenant_slug: tenantSlug, ut_id: asesor.id } },
        body: {
          dia_semana: dia,
          hora_inicio: nuevo.inicio,
          hora_fin: nuevo.fin,
        },
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

  const toggleServicio = async (servicio) => {
    const asignada = asignaciones.find((a) => a.servicio_id === servicio.id)
    setAccionError(null)
    if (asignada) {
      const { error: fetchErr } = await client.DELETE(
        '/api/v2/{tenant_slug}/admin/asesores/{ut_id}/servicios/{s_id}',
        {
          params: {
            path: { tenant_slug: tenantSlug, ut_id: asesor.id, s_id: asignada.id },
          },
          headers: { Authorization: `Bearer ${token}` },
        },
      )
      if (fetchErr) {
        setAccionError(errorMensaje(fetchErr))
        return
      }
      setAsignaciones((prev) => prev.filter((a) => a.id !== asignada.id))
      return
    }
    const { data, error: fetchErr, response } = await client.POST(
      '/api/v2/{tenant_slug}/admin/asesores/{ut_id}/servicios',
      {
        params: { path: { tenant_slug: tenantSlug, ut_id: asesor.id } },
        body: { servicio_id: servicio.id },
        headers: { Authorization: `Bearer ${token}` },
      },
    )
    if (fetchErr) {
      setAccionError(
        response?.status === 409
          ? 'El asesor ya tiene asignado este servicio'
          : errorMensaje(fetchErr),
      )
      return
    }
    setAsignaciones((prev) => [...prev, data])
  }

  return (
    <Modal title={`Configuración de ${asesor.nombre}`} onClose={onClose}>
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
        <div className="space-y-6">
          <div>
            <h4 className="mb-2 text-sm font-semibold text-gray-900">
              Horario semanal
            </h4>
            <p className="mb-3 text-xs text-gray-500">
              Activa los días en los que el asesor recibe reservas y define el
              rango horario.
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
                    {ocupado && (
                      <span className="text-xs text-blue-600">Guardando...</span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          <div>
            <h4 className="mb-2 text-sm font-semibold text-gray-900">
              Servicios asignados
            </h4>
            <p className="mb-3 text-xs text-gray-500">
              Elige qué servicios puede impartir este asesor.
            </p>
            {servicios.length === 0 ? (
              <p className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-4 text-center text-sm text-gray-500">
                No hay servicios activos en este tenant.
              </p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {servicios.map((s) => {
                  const asignada = asignaciones.find((a) => a.servicio_id === s.id)
                  return (
                    <label
                      key={s.id}
                      className="flex cursor-pointer items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 transition hover:bg-gray-50"
                    >
                      <input
                        type="checkbox"
                        checked={!!asignada}
                        onChange={() => toggleServicio(s)}
                        className="h-4 w-4 rounded border-gray-300 text-blue-600 accent-blue-600"
                      />
                      <span className="text-sm font-medium text-gray-800">{s.nombre}</span>
                    </label>
                  )
                })}
              </div>
            )}
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
