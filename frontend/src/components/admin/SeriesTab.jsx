import { useState, useEffect, useCallback } from 'react'
import client from '../../api/client'
import Modal from '../common/Modal'
import InscribirClientesSerieModal from './InscribirClientesSerieModal'

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

const ESTADO_INSCRIPCION_LABEL = {
  invitada: 'Invitación pendiente',
  confirmada: 'Confirmada',
  cancelada: 'Invitación cancelada',
}

const ESTADO_INSCRIPCION_BADGE = {
  invitada: 'border-yellow-200 bg-yellow-100 text-yellow-700',
  confirmada: 'border-green-200 bg-green-100 text-green-700',
  cancelada: 'border-gray-200 bg-gray-100 text-gray-600',
}

const ESTADO_PAGO_LABEL = {
  pendiente: 'Pago pendiente',
  parcial: 'Pago parcial',
  completo: 'Pagado',
  exento: 'Sin costo',
}

const ESTADO_PAGO_BADGE = {
  pendiente: 'border-yellow-200 bg-yellow-100 text-yellow-700',
  parcial: 'border-orange-200 bg-orange-100 text-orange-700',
  completo: 'border-green-200 bg-green-100 text-green-700',
  exento: 'border-gray-200 bg-gray-100 text-gray-600',
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
  const [inscribirSerie, setInscribirSerie] = useState(null)
  const [pagoModal, setPagoModal] = useState(null)
  const [montoPago, setMontoPago] = useState('')
  const [metodoPago, setMetodoPago] = useState('efectivo')
  const [pagoLoading, setPagoLoading] = useState(false)
  const [pagoError, setPagoError] = useState(null)
  const [pagoExito, setPagoExito] = useState(null)
  const [cancelandoId, setCancelandoId] = useState(null)

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

  const abrirPago = (inscripcion) => {
    setPagoModal(inscripcion)
    setMontoPago(detalleSerie?.precio_paquete || '')
    setMetodoPago('efectivo')
    setPagoError(null)
    setPagoExito(null)
  }

  const registrarPago = async () => {
    if (!pagoModal) return

    if (pagoModal.modalidad_cobro === 'paquete' && (!montoPago || parseFloat(montoPago) <= 0)) {
      setPagoError('Ingresa un monto válido')
      return
    }

    setPagoLoading(true)
    setPagoError(null)
    setPagoExito(null)

    const { data, error: fetchErr } = await client.POST(
      '/api/v2/{tenant_slug}/admin/series/{serie_id}/inscripciones/{inscripcion_id}/pago-local',
      {
        params: {
          path: {
            tenant_slug: tenantSlug,
            serie_id: pagoModal.serie_id,
            inscripcion_id: pagoModal.id,
          },
        },
        body: {
          metodo: metodoPago,
          monto: montoPago ? parseFloat(montoPago) : null,
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
      if (detalleSerie && detalleSerie.id === pagoModal.serie_id) {
        abrirDetalle(detalleSerie)
      }
    }, 2000)
  }

  const cancelarInvitacion = async (ins) => {
    setCancelandoId(ins.id)
    const { error: fetchErr } = await client.POST(
      '/api/v2/{tenant_slug}/admin/series/{serie_id}/inscripciones/{inscripcion_id}/cancelar',
      {
        params: {
          path: {
            tenant_slug: tenantSlug,
            serie_id: ins.serie_id,
            inscripcion_id: ins.id,
          },
        },
        headers: { Authorization: `Bearer ${token}` },
      }
    )
    setCancelandoId(null)
    if (fetchErr) {
      setError(errorMensaje(fetchErr))
      return
    }
    fetchSeries()
    if (detalleSerie) abrirDetalle(detalleSerie)
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
              <th className="px-4 py-3 font-medium">Servicio</th>
              <th className="px-4 py-3 font-medium">Frecuencia</th>
              <th className="px-4 py-3 font-medium">Repeticiones</th>
              <th className="px-4 py-3 font-medium">Inscritos</th>
              <th className="px-4 py-3 font-medium">Estado</th>
              <th className="px-4 py-3 text-right font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {series.map((s) => (
              <tr key={s.id} className="transition hover:bg-gray-50">
                <td className="px-4 py-3 text-gray-700">{s.servicio_nombre}</td>
                <td className="px-4 py-3 text-gray-700">
                  {FRECUENCIA_LABEL[s.frecuencia]} - {DIA_LABEL[s.dia_semana]}
                </td>
                <td className="px-4 py-3 text-gray-700">
                  {s.num_reservas_creadas_total}/{s.num_repeticiones}
                </td>
                <td className="px-4 py-3 text-gray-700">{s.num_inscripciones}</td>
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
                      onClick={() => setInscribirSerie(s)}
                      className="rounded-lg border border-blue-300 px-2.5 py-1 text-xs font-medium text-blue-700 transition hover:bg-blue-50"
                    >
                      Invitar
                    </button>
                    <button
                      type="button"
                      onClick={() => abrirDetalle(s)}
                      className="rounded-lg border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-700 transition hover:bg-gray-50"
                    >
                      Ver detalle
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal de inscripción */}
      {inscribirSerie && (
        <InscribirClientesSerieModal
          serie={inscribirSerie}
          onClose={() => setInscribirSerie(null)}
          onCreado={() => {
            setInscribirSerie(null)
            fetchSeries()
          }}
        />
      )}

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
                <p className="text-xs font-medium text-gray-500">Servicio</p>
                <p className="text-sm text-gray-900">{detalleSerie.servicio_nombre}</p>
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
                <p className="text-xs font-medium text-gray-500">Reservas creadas</p>
                <p className="text-sm text-gray-900">
                  {detalleSerie.num_reservas_creadas_total} de {detalleSerie.num_repeticiones * (detalleSerie.num_inscripciones || 0)}
                </p>
              </div>
            </div>

            {/* Inscripciones */}
            <div className="border-t pt-4">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-medium text-gray-500">Inscripciones</p>
                <button
                  type="button"
                  onClick={() => {
                    setDetalleSerie(null)
                    setInscribirSerie(detalleSerie)
                  }}
                  className="rounded-lg border border-blue-300 px-2 py-1 text-xs font-medium text-blue-700 transition hover:bg-blue-50"
                >
                  Invitar cliente
                </button>
              </div>

              {detalleSerie.inscripciones?.length === 0 ? (
                <p className="text-sm text-gray-500">No hay inscripciones todavía.</p>
              ) : (
                <div className="space-y-2">
                  {detalleSerie.inscripciones?.map((ins) => (
                    <div
                      key={ins.id}
                      className="flex flex-col gap-2 rounded-lg border border-gray-200 bg-gray-50 p-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div>
                        <p className="text-sm font-medium text-gray-900">{ins.nombre_cliente}</p>
                        <p className="text-xs text-gray-500">{ins.email_cliente}</p>
                        {ins.estado === 'confirmada' ? (
                          <p className="mt-1 text-xs text-gray-600">
                            {MODALIDAD_LABEL[ins.modalidad_cobro]}{" "}
                            {ins.modalidad_cobro === 'paquete' && detalleSerie.precio_paquete && (
                              <span>- ${detalleSerie.precio_paquete}</span>
                            )}
                            {" "}· {ins.num_reservas_creadas} reservas
                            {ins.num_reservas_omitidas > 0 && (
                              <span className="text-orange-600"> ({ins.num_reservas_omitidas} omitidas)</span>
                            )}
                          </p>
                        ) : (
                          <p className="mt-1 text-xs text-gray-500">
                            Todavía no elige modalidad — esperando que confirme desde su portal.
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                            ESTADO_INSCRIPCION_BADGE[ins.estado] || 'border-gray-200 bg-gray-100 text-gray-600'
                          }`}
                        >
                          {ESTADO_INSCRIPCION_LABEL[ins.estado] || ins.estado}
                        </span>
                        {ins.estado === 'confirmada' && (
                          <span
                            className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                              ESTADO_PAGO_BADGE[ins.estado_pago] || 'border-gray-200 bg-gray-100 text-gray-600'
                            }`}
                          >
                            {ESTADO_PAGO_LABEL[ins.estado_pago] || ins.estado_pago}
                          </span>
                        )}
                        {ins.estado === 'confirmada' && ins.modalidad_cobro === 'paquete' && ins.estado_pago !== 'completo' && ins.estado_pago !== 'exento' && (
                          <button
                            type="button"
                            onClick={() => abrirPago(ins)}
                            className="rounded-lg border border-green-300 px-2.5 py-1 text-xs font-medium text-green-700 transition hover:bg-green-50"
                          >
                            Registrar pago
                          </button>
                        )}
                        {ins.estado === 'invitada' && (
                          <button
                            type="button"
                            disabled={cancelandoId === ins.id}
                            onClick={() => cancelarInvitacion(ins)}
                            className="rounded-lg border border-red-300 px-2.5 py-1 text-xs font-medium text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {cancelandoId === ins.id ? 'Cancelando...' : 'Cancelar invitación'}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </Modal>
      )}

      {/* Modal de pago */}
      {pagoModal && (
        <Modal
          title={`Registrar pago - ${pagoModal.nombre_cliente}`}
          onClose={() => setPagoModal(null)}
          maxWidth="max-w-md"
        >
          <div className="space-y-4">
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
              <p className="text-sm font-medium text-blue-900">
                Serie #{pagoModal.serie_id}
              </p>
              <p className="text-xs text-blue-700">
                {pagoModal.num_reservas_creadas} reservas · {MODALIDAD_LABEL[pagoModal.modalidad_cobro]}
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
                placeholder={detalleSerie?.precio_paquete || 'Ej: 1500.00'}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
              {detalleSerie?.precio_paquete && (
                <p className="mt-1 text-xs text-gray-500">
                  Precio del paquete de la serie: ${detalleSerie.precio_paquete}
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
