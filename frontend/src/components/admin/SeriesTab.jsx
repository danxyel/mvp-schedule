import { useState, useEffect, useCallback } from 'react'
import client from '../../api/client'
import Modal from '../common/Modal'

const FRECUENCIA_LABEL = {
  semanal: 'Semanal',
  quincenal: 'Quincenal',
  mensual: 'Mensual',
}

const DIA_LABEL = {
  0: 'Lunes',
  1: 'Martes',
  2: 'Miércoles',
  3: 'Jueves',
  4: 'Viernes',
  5: 'Sábado',
  6: 'Domingo',
}

const ESTADO_BADGE = {
  activa: 'border-green-200 bg-green-100 text-green-700',
  completada: 'border-blue-200 bg-blue-100 text-blue-700',
  cancelada: 'border-gray-200 bg-gray-100 text-gray-600',
}

const MODALIDAD_LABEL = {
  sesion: 'Por sesión',
  paquete: 'Por paquete',
}

function errorMensaje(err) {
  return err?.mensaje ?? err?.detail ?? err?.message ?? JSON.stringify(err)
}

function formatFecha(fecha) {
  if (!fecha) return '—'
  return new Date(fecha).toLocaleDateString('es-MX', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export default function SeriesTab({ tenantSlug, token }) {
  const [series, setSeries] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [detalleSerie, setDetalleSerie] = useState(null)
  const [pagoModal, setPagoModal] = useState(null)
  const [montoPago, setMontoPago] = useState('')
  const [metodoPago, setMetodoPago] = useState('efectivo')
  const [pagoLoading, setPagoLoading] = useState(false)
  const [pagoError, setPagoError] = useState(null)
  const [pagoExito, setPagoExito] = useState(null)

  const fetchSeries = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { data, error: fetchErr } = await client.GET(
      '/api/v2/{tenant_slug}/admin/series',
      {
        params: { path: { tenant_slug: tenantSlug } },
        headers: { Authorization: `Bearer ${token}` },
      }
    )
    if (fetchErr) {
      setError(errorMensaje(fetchErr))
      setLoading(false)
      return
    }
    setSeries(data ?? [])
    setLoading(false)
  }, [tenantSlug, token])

  useEffect(() => {
    fetchSeries()
  }, [fetchSeries])

  const reintentar = () => {
    setLoading(true)
    setError(null)
    fetchSeries()
  }

  const abrirDetalle = async (serie) => {
    const { data, error: fetchErr } = await client.GET(
      '/api/v2/{tenant_slug}/admin/series/{serie_id}',
      {
        params: { path: { tenant_slug: tenantSlug, serie_id: serie.id } },
        headers: { Authorization: `Bearer ${token}` },
      }
    )
    if (fetchErr) {
      setError(errorMensaje(fetchErr))
      return
    }
    setDetalleSerie(data)
  }

  const abrirPago = (serie) => {
    setPagoModal(serie)
    setMontoPago(serie.precio_paquete || '')
    setMetodoPago('efectivo')
    setPagoError(null)
    setPagoExito(null)
  }

  const registrarPago = async () => {
    if (!montoPago || parseFloat(montoPago) <= 0) {
      setPagoError('Ingresa un monto válido')
      return
    }

    setPagoLoading(true)
    setPagoError(null)
    setPagoExito(null)

    const { data, error: fetchErr } = await client.POST(
      '/api/v2/{tenant_slug}/admin/reservas/serie/{serie_id}/pago-local',
      {
        params: { path: { tenant_slug: tenantSlug, serie_id: pagoModal.id } },
        body: {
          metodo: metodoPago,
          monto: parseFloat(montoPago),
        },
        headers: { Authorization: `Bearer ${token}` },
      }
    )

    setPagoLoading(false)

    if (fetchErr) {
      setPagoError(errorMensaje(fetchErr))
      return
    }

    setPagoExito(`Pago registrado para ${data.detalle.num_reservas} reservas`)
    setTimeout(() => {
      setPagoModal(null)
      fetchSeries()
      if (detalleSerie && detalleSerie.id === pagoModal.id) {
        abrirDetalle(pagoModal)
      }
    }, 2000)
  }

  if (loading) {
    return (
      <div className="animate-pulse space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-16 rounded-lg bg-gray-100" />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
        <p className="mb-1 font-semibold text-red-700">Error al cargar series</p>
        <p className="mb-4 text-sm text-red-600">{error}</p>
        <button
          type="button"
          onClick={reintentar}
          className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700"
        >
          Intentar de nuevo
        </button>
      </div>
    )
  }

  if (series.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-10 text-center">
        <p className="text-gray-500">No hay series de reservas registradas.</p>
        <p className="mt-2 text-xs text-gray-400">
          Crea una serie desde un servicio con tipo_agenda="recurrente"
        </p>
      </div>
    )
  }

  return (
    <div className="mx-auto min-w-0 max-w-4xl">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Series de Reservas</h2>
        <button
          type="button"
          onClick={fetchSeries}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
        >
          Actualizar
        </button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <th className="px-4 py-3 font-medium">Cliente</th>
              <th className="px-4 py-3 font-medium">Servicio</th>
              <th className="px-4 py-3 font-medium">Frecuencia</th>
              <th className="px-4 py-3 font-medium">Repeticiones</th>
              <th className="px-4 py-3 font-medium">Modalidad</th>
              <th className="px-4 py-3 font-medium">Estado</th>
              <th className="px-4 py-3 text-right font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {series.map((s) => (
              <tr key={s.id} className="transition hover:bg-gray-50">
                <td className="px-4 py-3">
                  <p className="font-medium text-gray-900">{s.nombre_cliente}</p>
                  <p className="text-xs text-gray-500">ID: {s.cliente_usuario_id}</p>
                </td>
                <td className="px-4 py-3 text-gray-700">{s.servicio_nombre}</td>
                <td className="px-4 py-3 text-gray-700">
                  {FRECUENCIA_LABEL[s.frecuencia]} - {DIA_LABEL[s.dia_semana]}
                </td>
                <td className="px-4 py-3 text-gray-700">
                  {s.num_reservas_creadas}/{s.num_repeticiones}
                  {s.num_reservas_omitidas > 0 && (
                    <span className="ml-1 text-xs text-orange-600">
                      ({s.num_reservas_omitidas} omitidas)
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-gray-700">
                  {MODALIDAD_LABEL[s.modalidad_cobro] || s.modalidad_cobro}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                      ESTADO_BADGE[s.estado] || 'border-gray-200 bg-gray-100 text-gray-600'
                    }`}
                  >
                    {s.estado}
                  </span>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => abrirDetalle(s)}
                      className="rounded-lg border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-700 transition hover:bg-gray-50"
                    >
                      Ver detalle
                    </button>
                    {s.cobro_por_paquete_habilitado && s.estado === 'activa' && (
                      <button
                        type="button"
                        onClick={() => abrirPago(s)}
                        className="rounded-lg border border-green-300 px-2.5 py-1 text-xs font-medium text-green-700 transition hover:bg-green-50"
                      >
                        Registrar pago
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal de detalle */}
      {detalleSerie && (
        <Modal
          title={`Serie #${detalleSerie.id} - ${detalleSerie.servicio_nombre}`}
          onClose={() => setDetalleSerie(null)}
          maxWidth="max-w-3xl"
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-medium text-gray-500">Cliente</p>
                <p className="text-sm text-gray-900">{detalleSerie.nombre_cliente}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500">Asesor</p>
                <p className="text-sm text-gray-900">{detalleSerie.nombre_asesor || 'Sin asignar'}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500">Frecuencia</p>
                <p className="text-sm text-gray-900">
                  {FRECUENCIA_LABEL[detalleSerie.frecuencia]} - {DIA_LABEL[detalleSerie.dia_semana]}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500">Hora</p>
                <p className="text-sm text-gray-900">{detalleSerie.hora_inicio}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500">Fecha inicio</p>
                <p className="text-sm text-gray-900">{formatFecha(detalleSerie.fecha_inicio)}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500">Duración</p>
                <p className="text-sm text-gray-900">{detalleSerie.duracion_minutos} min</p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500">Modalidades habilitadas</p>
                <p className="text-sm text-gray-900">
                  {detalleSerie.cobro_por_sesion_habilitado && 'Sesión '}
                  {detalleSerie.cobro_por_paquete_habilitado && 'Paquete'}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500">Modalidad elegida</p>
                <p className="text-sm text-gray-900">
                  {MODALIDAD_LABEL[detalleSerie.modalidad_cobro] || detalleSerie.modalidad_cobro}
                </p>
              </div>
            </div>

            <div className="border-t pt-4">
              <p className="text-xs font-medium text-gray-500">Reservas creadas</p>
              <p className="text-sm text-gray-900">
                {detalleSerie.num_reservas_creadas} de {detalleSerie.num_repeticiones}
              </p>
            </div>

            {detalleSerie.num_reservas_omitidas > 0 && (
              <div className="border-t pt-4">
                <p className="text-xs font-medium text-orange-700">
                  Fechas omitidas ({detalleSerie.num_reservas_omitidas})
                </p>
                {detalleSerie.fechas_omitidas && detalleSerie.fechas_omitidas.length > 0 ? (
                  <ul className="mt-2 space-y-1">
                    {detalleSerie.fechas_omitidas.map((f, i) => (
                      <li key={i} className="text-xs text-gray-700">
                        <span className="font-mono">{f.fecha}</span> - {f.razon}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1 text-xs text-gray-500">
                    No hay detalles de las fechas omitidas
                  </p>
                )}
              </div>
            )}

            {detalleSerie.precio_paquete && (
              <div className="border-t pt-4">
                <p className="text-xs font-medium text-gray-500">Precio del paquete</p>
                <p className="text-lg font-bold text-gray-900">
                  ${detalleSerie.precio_paquete} {detalleSerie.moneda || 'MXN'}
                </p>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Modal de pago */}
      {pagoModal && (
        <Modal
          title={`Registrar pago de paquete - Serie #${pagoModal.id}`}
          onClose={() => setPagoModal(null)}
          maxWidth="max-w-md"
        >
          <div className="space-y-4">
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
              <p className="text-sm font-medium text-blue-900">
                Cliente: {pagoModal.nombre_cliente}
              </p>
              <p className="text-xs text-blue-700">
                {pagoModal.num_reservas_creadas} reservas - {pagoModal.servicio_nombre}
              </p>
            </div>

            {pagoError && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                <p className="text-sm text-red-700">{pagoError}</p>
              </div>
            )}

            {pagoExito && (
              <div className="rounded-lg border border-green-200 bg-green-50 p-3">
                <p className="text-sm text-green-700">{pagoExito}</p>
              </div>
            )}

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Método de pago
              </label>
              <select
                value={metodoPago}
                onChange={(e) => setMetodoPago(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="efectivo">Efectivo</option>
                <option value="transferencia">Transferencia</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Monto del paquete
              </label>
              <input
                type="number"
                value={montoPago}
                onChange={(e) => setMontoPago(e.target.value)}
                min="0"
                step="0.01"
                placeholder={pagoModal.precio_paquete || 'Ej: 1500.00'}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
              {pagoModal.precio_paquete && (
                <p className="mt-1 text-xs text-gray-500">
                  Precio capturado al crear la serie: ${pagoModal.precio_paquete}
                </p>
              )}
            </div>

            <div className="flex gap-2 pt-4">
              <button
                type="button"
                onClick={() => setPagoModal(null)}
                disabled={pagoLoading}
                className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={registrarPago}
                disabled={pagoLoading}
                className="flex-1 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {pagoLoading ? 'Registrando...' : 'Registrar pago'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
