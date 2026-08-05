import { useState, useEffect, useCallback } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import client from '../api/client'
import { errorMensaje } from '../utils/errores'

const BADGE = {
  pendiente: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  aceptada: 'bg-green-100 text-green-700 border-green-200',
  rechazada: 'bg-red-100 text-red-700 border-red-200',
  cancelada: 'bg-gray-100 text-gray-600 border-gray-200',
}

const ESTADO_LABEL = {
  pendiente: 'En revisión',
  aceptada: 'Aceptada',
  rechazada: 'Rechazada',
  cancelada: 'Cancelada',
}

function formatFechaHora(utcString) {
  return new Intl.DateTimeFormat('es-MX', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(utcString))
}

function CardSkeleton() {
  return (
    <div className="animate-pulse rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="mb-3 h-5 w-3/5 rounded bg-gray-200" />
      <div className="mb-2 h-4 w-4/5 rounded bg-gray-100" />
      <div className="mb-4 h-4 w-2/5 rounded bg-gray-100" />
      <div className="h-6 w-20 rounded-full bg-gray-200" />
    </div>
  )
}

function formatFechaHoraAlternativa(utcString) {
  return new Intl.DateTimeFormat('es-MX', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(utcString))
}

function SolicitudCard({ s, tenantSlug, token, onAceptada }) {
  const [aceptandoId, setAceptandoId] = useState(null)
  const [errorAlt, setErrorAlt] = useState(null)
  const [exitoFolio, setExitoFolio] = useState(null)

  const aceptarAlternativa = async (alt) => {
    setAceptandoId(alt.id)
    setErrorAlt(null)
    setExitoFolio(null)
    const { data, error: fetchErr } = await client.POST(
      '/api/v2/{tenant_slug}/mis-solicitudes/{solicitud_id}/alternativas/{alternativa_id}/aceptar',
      {
        params: {
          path: {
            tenant_slug: tenantSlug,
            solicitud_id: s.id,
            alternativa_id: alt.id,
          },
        },
        headers: { Authorization: `Bearer ${token}` },
      },
    )
    setAceptandoId(null)
    if (fetchErr) {
      const msg =
        fetchErr?.codigo === 'franja_ocupada' || fetchErr?.codigo === 'cupo_agotado'
          ? 'Ese horario ya no está disponible — intenta con otra opción de la lista.'
          : fetchErr?.codigo === 'alternativa_ya_resuelta'
            ? 'Ya aceptaste una alternativa para esta solicitud.'
            : fetchErr?.codigo === 'solicitud_no_rechazada'
              ? 'Esta solicitud ya no está disponible para aceptar.'
              : errorMensaje(fetchErr)
      setErrorAlt(msg)
      return
    }
    setExitoFolio(data?.folio_reserva)
    onAceptada?.()
  }

  const mostrarAlternativas =
    s.estado === 'rechazada' &&
    s.alternativa_aceptada_id == null &&
    s.alternativas?.length > 0

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:shadow-md">
      <div className="mb-1 flex items-start justify-between gap-2">
        <h3 className="text-base font-semibold text-gray-900">
          {s.servicio_nombre ?? 'Servicio'}
        </h3>
        <span
          className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${
            BADGE[s.estado] ?? 'bg-gray-100 text-gray-600 border-gray-200'
          }`}
        >
          {ESTADO_LABEL[s.estado] ?? s.estado}
        </span>
      </div>

      <p className="mb-2 text-sm text-gray-600">
        {formatFechaHora(s.fecha_hora_propuesta)}
      </p>

      {s.notas_cliente && (
        <p className="mb-3 text-sm text-gray-500">
          <span className="font-medium text-gray-700">Notas:</span> {s.notas_cliente}
        </p>
      )}

      {s.estado === 'rechazada' && s.motivo_rechazo && (
        <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          <span className="font-medium">Motivo:</span> {s.motivo_rechazo}
        </p>
      )}

      {mostrarAlternativas && (
        <div className="mb-3">
          <p className="mb-2 text-sm font-medium text-gray-700">
            El negocio te sugiere estas alternativas:
          </p>
          <div className="space-y-2">
            {s.alternativas.map((alt) => (
              <div
                key={alt.id}
                className="flex flex-col gap-2 rounded-lg border border-gray-200 bg-gray-50 p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <p className="text-sm text-gray-700">
                  {formatFechaHoraAlternativa(alt.fecha_hora)}
                </p>
                <button
                  type="button"
                  onClick={() => aceptarAlternativa(alt)}
                  disabled={aceptandoId === alt.id}
                  className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {aceptandoId === alt.id ? 'Aceptando...' : 'Aceptar esta fecha'}
                </button>
              </div>
            ))}
          </div>
          {errorAlt && (
            <p className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {errorAlt}
            </p>
          )}
        </div>
      )}

      {s.estado === 'rechazada' && s.alternativa_aceptada_id != null && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
          Aceptaste una fecha alternativa — revisa <Link to="/mis-reservas" className="font-medium underline hover:text-green-800">Mis reservas</Link> para verla.
        </div>
      )}

      {exitoFolio && (
        <div className="mb-3 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
          Reserva creada ({exitoFolio}).
        </div>
      )}

      {s.estado === 'aceptada' && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
          Aceptada — revisa <Link to="/mis-reservas" className="font-medium underline hover:text-green-800">Mis reservas</Link> para verla.
        </div>
      )}
    </div>
  )
}

export default function MisSolicitudes() {
  const navigate = useNavigate()
  const tenantSlug = sessionStorage.getItem('tenantSlug')
  const token = sessionStorage.getItem('token')

  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchSolicitudes = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { data, error: fetchErr } = await client.GET(
      '/api/v2/{tenant_slug}/mis-solicitudes',
      {
        params: { path: { tenant_slug: tenantSlug } },
        headers: { Authorization: `Bearer ${token}` },
      },
    )
    setLoading(false)
    if (fetchErr) {
      setError(errorMensaje(fetchErr))
      return
    }
    setItems(data ?? [])
  }, [tenantSlug, token])

  useEffect(() => {
    fetchSolicitudes()
  }, [fetchSolicitudes])

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-gray-900">Mis solicitudes</h2>
        <div className="flex items-center gap-4">
          {tenantSlug && (
            <button
              type="button"
              onClick={() => navigate(`/t/${tenantSlug}`)}
              className="text-sm text-blue-600 hover:underline"
            >
              Agendar nueva sesión
            </button>
          )}
          <button
            type="button"
            onClick={() => navigate('/mis-reservas')}
            className="text-sm text-blue-600 hover:underline"
          >
            Mis reservas
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-center">
          <p className="mb-1 text-sm text-red-700">{error}</p>
          <button
            type="button"
            onClick={fetchSolicitudes}
            className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-red-700"
          >
            Intentar de nuevo
          </button>
        </div>
      )}

      {loading && (
        <div className="space-y-3">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      )}

      {!loading && !error && items.length === 0 && (
        <p className="py-12 text-center text-gray-500">
          No tienes solicitudes registradas.
        </p>
      )}

      {!loading && !error && items.length > 0 && (
        <div className="space-y-3">
          {items.map((s) => (
            <SolicitudCard
              key={s.id}
              s={s}
              tenantSlug={tenantSlug}
              token={token}
              onAceptada={fetchSolicitudes}
            />
          ))}
        </div>
      )}
    </div>
  )
}
