import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import client from '../api/client'
import Modal from './common/Modal'
const BADGE = {
  confirmada: 'bg-green-100 text-green-700 border-green-200',
  en_espera: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  pendiente: 'bg-gray-100 text-gray-600 border-gray-200',
  cancelada: 'bg-red-100 text-red-700 border-red-200',
  completada: 'bg-blue-100 text-blue-700 border-blue-200',
  no_show: 'bg-red-200 text-red-800 border-red-300',
}

const ESTADO_LABEL = {
  confirmada: 'Confirmada',
  en_espera: 'En espera de pago',
  pendiente: 'Procesando...',
  cancelada: 'Cancelada',
  completada: 'Completada',
  no_show: 'No asistió',
}

const PAGO_LABEL = {
  pendiente: 'Pago pendiente',
  completado: 'Pagado',
  reembolsado: 'Reembolsado',
  exento: 'Sin costo',
}

const MODALIDAD_ICON = {
  presencial: '📍',
  virtual: '💻',
  hibrida: '🔄',
}

function toLocalTime(utcString, timezone) {
  return new Intl.DateTimeFormat('es-MX', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: timezone,
  }).format(new Date(utcString))
}

function CountdownTimer({ expiraEn }) {
  const [remaining, setRemaining] = useState(null)

  useEffect(() => {
    if (!expiraEn) return

    function tick() {
      const diff = new Date(expiraEn) - new Date()
      setRemaining(Math.max(0, diff))
    }

    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [expiraEn])

  if (remaining === null) return null
  if (remaining <= 0) return <span className="text-sm font-semibold text-red-600">Tiempo agotado</span>

  const mins = Math.floor(remaining / 60000)
  const secs = Math.floor((remaining % 60000) / 1000)
  return (
    <div className="rounded-lg border border-yellow-200 bg-yellow-50 px-3 py-2 text-center">
      <p className="text-xs text-yellow-600">Tiempo restante para pagar:</p>
      <span className="font-mono text-lg font-bold text-yellow-700">
        {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
      </span>
    </div>
  )
}

function DetalleSkeleton() {
  return (
    <div className="mx-auto max-w-lg animate-pulse">
      <div className="mb-6 h-5 w-20 rounded bg-gray-200" />
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="mb-4 h-6 w-3/4 rounded bg-gray-200" />
        <div className="space-y-3">
          <div className="h-4 w-1/2 rounded bg-gray-100" />
          <div className="h-4 w-2/3 rounded bg-gray-100" />
          <div className="h-4 w-1/3 rounded bg-gray-100" />
          <div className="h-4 w-3/5 rounded bg-gray-100" />
          <div className="h-4 w-1/2 rounded bg-gray-100" />
        </div>
      </div>
    </div>
  )
}

const ESTADOS_CANCELABLES = ['pendiente', 'en_espera', 'confirmada']

export default function DetalleReserva() {
  const { tenantSlug, folio } = useParams()
  const navigate = useNavigate()
  const token = sessionStorage.getItem('token')
  
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [cancelando, setCancelando] = useState(false)
  const [cancelError, setCancelError] = useState(null)

  const fetchReserva = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data: result, error: fetchErr } = await client.GET(
        '/api/v2/{tenant_slug}/reservas/{folio}',
        {
          params: { path: { tenant_slug: tenantSlug, folio } },
          headers: { Authorization: `Bearer ${token}` },
        },
      )
      if (fetchErr) {
        setError(fetchErr)
        return
      }
      setData(result)
    } catch (err) {
      setError(err)
    } finally {
      setLoading(false)
    }
  }, [tenantSlug, folio, token])

  useEffect(() => {
    fetchReserva()
  }, [fetchReserva])

  const handleCancelar = async () => {
    setCancelando(true)
    setCancelError(null)
    try {
      const { error: cancelErr } = await client.POST(
        '/api/v2/{tenant_slug}/reservas/{folio}/cancelar',
        {
          params: { path: { tenant_slug: tenantSlug, folio } },
          headers: { Authorization: `Bearer ${token}` },
          body: { motivo: motivo || null },
        },
      )
      if (cancelErr) {
        setCancelError(cancelErr)
        return
      }
      setShowModal(false)
      navigate('/mis-reservas')
    } catch (err) {
      setCancelError(err)
    } finally {
      setCancelando(false)
    }
  }

  const cerrarModal = () => {
    setShowModal(false)
    setCancelError(null)
    setMotivo('')
  }

  const CANCEL_ERROR_MESSAGES = {
    fuera_de_politica: 'El plazo para cancelar ya venció.',
    estado_no_cancelable: 'Esta reserva no se puede cancelar.',
    permiso_denegado: 'No tienes permiso para esta acción.',
  }

  if (loading) {
    return <DetalleSkeleton />
  }

  if (error) {
    return (
      <div className="mx-auto max-w-lg">
        <button
          type="button"
          onClick={() => navigate('/mis-reservas')}
          className="mb-4 text-sm font-medium text-blue-600 transition hover:text-blue-800"
        >
          &larr; Volver
        </button>
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
          <p className="mb-1 font-semibold text-red-700">Error al cargar la reserva</p>
          <p className="mb-4 text-sm text-red-600">
            {error?.message ?? JSON.stringify(error)}
          </p>
          <button
            type="button"
            onClick={fetchReserva}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700"
          >
            Intentar de nuevo
          </button>
        </div>
      </div>
    )
  }

  const r = data
  const esCancelable = ESTADOS_CANCELABLES.includes(r.estado)

  return (
    <div className="mx-auto max-w-lg">
      <button
        type="button"
        onClick={() => navigate('/mis-reservas')}
        className="mb-4 text-sm font-medium text-blue-600 transition hover:text-blue-800"
      >
        &larr; Volver
      </button>

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Reserva {r.folio}</h2>
            <p className="text-xs text-gray-500">
              Código: {r.codigo_confirmacion}
            </p>
          </div>
          <span
            className={`inline-flex shrink-0 rounded-full border px-3 py-1 text-xs font-medium ${
              BADGE[r.estado] ?? 'bg-gray-100 text-gray-600'
            }`}
          >
            {ESTADO_LABEL[r.estado] ?? r.estado}
          </span>
        </div>

        <div className="space-y-3 text-sm">
          {r.servicio_nombre && (
            <div>
              <span className="font-medium text-gray-500">Servicio:</span>{' '}
              <span className="text-gray-800">{r.servicio_nombre}</span>
            </div>
          )}

          <div>
            <span className="font-medium text-gray-500">Fecha y hora:</span>{' '}
            <span className="text-gray-800">
              {toLocalTime(r.fecha_hora_inicio, r.timezone)}
            </span>
          </div>

          {r.modalidad && (
            <div>
              <span className="font-medium text-gray-500">Modalidad:</span>{' '}
              <span className="text-gray-800">
                {MODALIDAD_ICON[r.modalidad] ?? ''} {r.modalidad}
              </span>
            </div>
          )}

          {r.asesor && (
            <div className="flex items-center gap-2">
              <span className="font-medium text-gray-500">Asesor:</span>
              {r.asesor.avatar_url ? (
                <img
                  src={r.asesor.avatar_url}
                  alt={r.asesor.nombre}
                  className="h-5 w-5 rounded-full object-cover"
                />
              ) : (
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-[10px] font-bold text-blue-600">
                  {r.asesor.nombre.charAt(0)}
                </span>
              )}
              <span className="text-gray-800">{r.asesor.nombre}</span>
            </div>
          )}

          {r.sede && (
            <div>
              <span className="font-medium text-gray-500">Sede:</span>{' '}
              <span className="text-gray-800">{r.sede.nombre}</span>
              {r.sede.direccion && (
                <p className="mt-0.5 text-xs text-gray-400">{r.sede.direccion}</p>
              )}
            </div>
          )}

          {r.precio_final && (
            <div>
              <span className="font-medium text-gray-500">Precio:</span>{' '}
              <span className="text-gray-800">
                {r.moneda === 'MXN' ? '$' : ''}
                {new Intl.NumberFormat('es-MX').format(r.precio_final)}{' '}
                {r.moneda}
              </span>
              <span
                className={`ml-2 text-xs ${
                  r.estado_pago === 'completado'
                    ? 'text-green-600'
                    : r.estado_pago === 'pendiente'
                      ? 'text-yellow-600'
                      : 'text-gray-500'
                }`}
              >
                ({PAGO_LABEL[r.estado_pago] ?? r.estado_pago})
              </span>
            </div>
          )}

          {r.notas_cliente && (
            <div>
              <span className="font-medium text-gray-500">Notas:</span>{' '}
              <span className="text-gray-600 italic">{r.notas_cliente}</span>
            </div>
          )}
        </div>

        {r.estado === 'en_espera' && r.hold_expira_en && (
          <div className="mt-4">
            <CountdownTimer expiraEn={r.hold_expira_en} />
          </div>
        )}

        {r.estado === 'confirmada' && r.meet_url && (
          <a
            href={r.meet_url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 block w-full rounded-lg bg-green-600 px-4 py-2.5 text-center text-sm font-medium text-white transition hover:bg-green-700"
          >
            Unirse a la sesión
          </a>
        )}

        {esCancelable && (
          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="mt-6 w-full rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 transition hover:bg-red-100"
          >
            Cancelar reserva
          </button>
        )}
      </div>

      {showModal && (
        <Modal title="Cancelar reserva" onClose={cerrarModal} maxWidth="max-w-sm">
            <p className="mb-4 text-sm text-gray-600">
              ¿Estás seguro de cancelar la reserva <strong>{r.folio}</strong>?
            </p>

            <div className="mb-4">
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Motivo <span className="text-gray-400">(opcional)</span>
              </label>
              <textarea
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                rows={3}
                className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none transition focus:ring-2 focus:ring-red-500"
                placeholder="Ej: No podré asistir..."
              />
            </div>

            {cancelError && (
              <p className="mb-3 text-sm text-red-600">
                {CANCEL_ERROR_MESSAGES[cancelError.codigo] ??
                  cancelError.mensaje ??
                  'Error al cancelar.'}
              </p>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={cerrarModal}
                className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
              >
                No, volver
              </button>
              <button
                type="button"
                onClick={handleCancelar}
                disabled={cancelando}
                className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {cancelando ? 'Cancelando...' : 'Sí, cancelar'}
              </button>
            </div>
        </Modal>
      )}
    </div>
  )
}
