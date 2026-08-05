import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import client from '../api/client'
import { errorMensaje } from '../utils/errores'

// "online" no se ofrece todavía: el backend siempre lo rechaza con
// pago_en_linea_no_disponible hasta que exista pago en línea real
// (PROMPT_G). No tiene sentido ofrecer una opción que nunca puede tener éxito.
const METODOS_PAGO = [
  { value: 'local', label: 'Local (efectivo/transferencia)' },
  { value: 'registro', label: 'Registro' },
]

const FRECUENCIA_LABEL = {
  semanal: 'Semanal',
  quincenal: 'Quincenal',
  mensual: 'Mensual',
}

const DIA_LABEL = {
  0: 'Lunes', 1: 'Martes', 2: 'Miércoles', 3: 'Jueves', 4: 'Viernes', 5: 'Sábado', 6: 'Domingo',
}

function formatFecha(fecha) {
  if (!fecha) return '—'
  return new Date(fecha).toLocaleDateString('es-MX', { year: 'numeric', month: 'short', day: 'numeric' })
}

function CardSkeleton() {
  return (
    <div className="animate-pulse rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="mb-3 h-5 w-3/5 rounded bg-gray-200" />
      <div className="mb-2 h-4 w-4/5 rounded bg-gray-100" />
      <div className="h-4 w-2/5 rounded bg-gray-100" />
    </div>
  )
}

function InvitacionCard({ inv, onConfirmado, tenantSlug, token }) {
  const [modalidad, setModalidad] = useState(
    inv.cobro_por_sesion_habilitado ? 'sesion' : 'paquete'
  )
  const [metodoPago, setMetodoPago] = useState('local')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const confirmar = async () => {
    setLoading(true)
    setError(null)
    const { error: fetchErr } = await client.POST('/api/v2/{tenant_slug}/mis-series/{inscripcion_id}/confirmar', {
      params: { path: { tenant_slug: tenantSlug, inscripcion_id: inv.id } },
      body: { modalidad_cobro: modalidad, metodo_pago: metodoPago },
      headers: { Authorization: `Bearer ${token}` },
    })
    setLoading(false)
    if (fetchErr) {
      setError(errorMensaje(fetchErr))
      return
    }
    onConfirmado()
  }

  return (
    <div className="rounded-xl border border-orange-200 bg-white p-5 shadow-sm">
      <h3 className="text-base font-semibold text-gray-900">{inv.servicio_nombre ?? 'Servicio'}</h3>
      <p className="mt-1 text-sm text-gray-600">
        {FRECUENCIA_LABEL[inv.frecuencia] ?? inv.frecuencia} · {DIA_LABEL[inv.dia_semana] ?? ''} · {inv.hora_inicio?.slice(0, 5)}
      </p>
      <p className="text-xs text-gray-500">
        {inv.num_repeticiones} sesiones a partir del {formatFecha(inv.fecha_inicio)}
      </p>

      <div className="mt-4 space-y-3 border-t border-gray-100 pt-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">¿Cómo quieres pagar?</label>
          <div className="space-y-2">
            {inv.cobro_por_sesion_habilitado && (
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="radio"
                  name={`modalidad-${inv.id}`}
                  checked={modalidad === 'sesion'}
                  onChange={() => setModalidad('sesion')}
                />
                Por sesión{inv.precio_sesion ? ` — $${inv.precio_sesion} c/u` : ''}
              </label>
            )}
            {inv.cobro_por_paquete_habilitado && (
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="radio"
                  name={`modalidad-${inv.id}`}
                  checked={modalidad === 'paquete'}
                  onChange={() => setModalidad('paquete')}
                />
                Paquete completo{inv.precio_paquete ? ` — $${inv.precio_paquete} total` : ''}
              </label>
            )}
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Método de pago</label>
          <select
            value={metodoPago}
            onChange={(e) => setMetodoPago(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none transition focus:ring-2 focus:ring-blue-500"
          >
            {METODOS_PAGO.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </div>

        {error && (
          <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <button
          type="button"
          disabled={loading}
          onClick={confirmar}
          className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? 'Confirmando...' : 'Confirmar'}
        </button>
      </div>
    </div>
  )
}

function ConfirmadaCard({ inv, navigate }) {
  const [pagarLoading, setPagarLoading] = useState(false)
  const [pagarError, setPagarError] = useState(null)
  const tenantSlug = sessionStorage.getItem('tenantSlug')
  const token = sessionStorage.getItem('token')
  const esPaquete = inv.modalidad_cobro === 'paquete'
  const faltaPagar = esPaquete && inv.estado_pago !== 'completo' && inv.estado_pago !== 'exento'

  const pagar = async () => {
    setPagarLoading(true)
    setPagarError(null)
    const { data, error: fetchErr } = await client.POST(
      '/api/v2/{tenant_slug}/inscripciones/{inscripcion_id}/checkout',
      {
        params: { path: { tenant_slug: tenantSlug, inscripcion_id: inv.id } },
        headers: { Authorization: `Bearer ${token}` },
      }
    )
    setPagarLoading(false)
    if (fetchErr || !data?.url) {
      setPagarError(errorMensaje(fetchErr) || 'No se pudo iniciar el pago')
      return
    }
    window.location.href = data.url
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-base font-semibold text-gray-900">{inv.servicio_nombre ?? 'Servicio'}</h3>
        <span className="inline-flex shrink-0 items-center rounded-full border border-green-200 bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">
          Confirmada
        </span>
      </div>
      <p className="mt-1 text-sm text-gray-600">
        {esPaquete ? 'Por paquete' : 'Por sesión'} · {inv.num_reservas_creadas} reservas creadas
      </p>

      {faltaPagar && (
        <div className="mt-3">
          <button
            type="button"
            onClick={pagar}
            disabled={pagarLoading}
            className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pagarLoading ? 'Cargando...' : `Pagar paquete ${inv.precio_paquete ? `— $${inv.precio_paquete}` : ''}`}
          </button>
        </div>
      )}

      {pagarError && (
        <p className="mt-2 text-xs text-red-600">{pagarError}</p>
      )}

      <button
        type="button"
        onClick={() => navigate('/mis-reservas')}
        className="mt-3 text-xs font-medium text-blue-600 transition hover:text-blue-800"
      >
        Ver mis reservas &rarr;
      </button>
    </div>
  )
}

export default function MisSeries() {
  const navigate = useNavigate()
  const tenantSlug = sessionStorage.getItem('tenantSlug')
  const token = sessionStorage.getItem('token')

  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchSeries = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { data: result, error: fetchErr } = await client.GET('/api/v2/{tenant_slug}/mis-series', {
      params: { path: { tenant_slug: tenantSlug } },
      headers: { Authorization: `Bearer ${token}` },
    })
    if (fetchErr) {
      setError(errorMensaje(fetchErr))
      setLoading(false)
      return
    }
    setData(result ?? [])
    setLoading(false)
  }, [tenantSlug, token])

  useEffect(() => {
    fetchSeries()
  }, [fetchSeries])

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl">
        <h2 className="mb-6 text-lg font-semibold text-gray-900">Mis series</h2>
        <div className="grid gap-4">
          <CardSkeleton />
          <CardSkeleton />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="mx-auto max-w-2xl">
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
          <p className="mb-1 font-semibold text-red-700">Error al cargar tus series</p>
          <p className="mb-4 text-sm text-red-600">{error}</p>
          <button
            type="button"
            onClick={fetchSeries}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700"
          >
            Intentar de nuevo
          </button>
        </div>
      </div>
    )
  }

  const invitaciones = (data ?? []).filter((i) => i.estado === 'invitada')
  const confirmadas = (data ?? []).filter((i) => i.estado === 'confirmada')

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Mis series</h2>
        <button
          type="button"
          onClick={() => navigate('/mis-reservas')}
          className="text-sm text-blue-600 hover:underline"
        >
          Mis reservas &rarr;
        </button>
      </div>

      {invitaciones.length === 0 && confirmadas.length === 0 && (
        <p className="py-12 text-center text-gray-500">No tienes series de sesiones recurrentes.</p>
      )}

      {invitaciones.length > 0 && (
        <div className="mb-6">
          <h3 className="mb-3 text-sm font-medium text-gray-700">Invitaciones pendientes</h3>
          <div className="grid gap-4">
            {invitaciones.map((inv) => (
              <InvitacionCard
                key={inv.id}
                inv={inv}
                tenantSlug={tenantSlug}
                token={token}
                onConfirmado={fetchSeries}
              />
            ))}
          </div>
        </div>
      )}

      {confirmadas.length > 0 && (
        <div>
          <h3 className="mb-3 text-sm font-medium text-gray-700">Series confirmadas</h3>
          <div className="grid gap-4">
            {confirmadas.map((inv) => (
              <ConfirmadaCard key={inv.id} inv={inv} navigate={navigate} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
