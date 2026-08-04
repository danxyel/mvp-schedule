import { useState, useEffect } from 'react'
import client from '../../api/client'
import Modal from '../common/Modal'

const METODOS_PAGO = [
  { value: 'local', label: 'Local (efectivo/transferencia)' },
  { value: 'registro', label: 'Registro' },
  { value: 'online', label: 'Online' },
]

function errorMensaje(err) {
  return err?.mensaje ?? err?.detail ?? err?.message ?? JSON.stringify(err)
}

export default function InscribirClientesSerieModal({ serie, onClose, onCreado }) {
  const [clientes, setClientes] = useState([])
  const [clientesSeleccionados, setClientesSeleccionados] = useState([])
  const [configs, setConfigs] = useState({})
  const [loading, setLoading] = useState(false)
  const [cargandoClientes, setCargandoClientes] = useState(true)
  const [errorGlobal, setErrorGlobal] = useState(null)
  const [resultados, setResultados] = useState([])

  useEffect(() => {
    const cargarClientes = async () => {
      const tenantSlug = sessionStorage.getItem('tenantSlug')
      const token = sessionStorage.getItem('token')
      const { data, error: fetchErr } = await client.GET(
        '/api/v2/{tenant_slug}/admin/usuarios',
        {
          params: { path: { tenant_slug: tenantSlug } },
          headers: { Authorization: `Bearer ${token}` },
        }
      )
      if (fetchErr) {
        setErrorGlobal('No se pudo cargar la lista de clientes')
      } else if (data) {
        setClientes(data.filter(u => u.rol === 'cliente'))
      }
      setCargandoClientes(false)
    }
    cargarClientes()
  }, [])

  const toggleCliente = (usuarioId) => {
    setClientesSeleccionados(prev => {
      const existe = prev.includes(usuarioId)
      if (existe) {
        return prev.filter(id => id !== usuarioId)
      }
      return [...prev, usuarioId]
    })
  }

  const actualizarConfig = (usuarioId, campo, valor) => {
    setConfigs(prev => ({
      ...prev,
      [usuarioId]: {
        ...prev[usuarioId],
        [campo]: valor,
      },
    }))
  }

  const getConfig = (usuarioId) => {
    const defaultModalidad = serie.cobro_por_sesion_habilitado ? 'sesion' : 'paquete'
    return configs[usuarioId] ?? {
      modalidad_cobro: defaultModalidad,
      precio_paquete: '',
      metodo_pago: 'local',
    }
  }

  const validar = () => {
    for (const usuarioId of clientesSeleccionados) {
      const cfg = getConfig(usuarioId)
      const cliente = clientes.find(c => c.usuario_id === usuarioId)
      const nombre = cliente?.nombre ?? `Cliente ${usuarioId}`

      if (cfg.modalidad_cobro === 'paquete') {
        if (!serie.cobro_por_paquete_habilitado) {
          return `${nombre}: modalidad 'paquete' no está habilitada para esta serie`
        }
        if (!cfg.precio_paquete || parseFloat(cfg.precio_paquete) <= 0) {
          return `${nombre}: ingresa un precio de paquete válido`
        }
      }
      if (cfg.modalidad_cobro === 'sesion' && !serie.cobro_por_sesion_habilitado) {
        return `${nombre}: modalidad 'sesión' no está habilitada para esta serie`
      }
    }
    return null
  }

  const handleSubmit = async () => {
    if (clientesSeleccionados.length === 0) {
      setErrorGlobal('Selecciona al menos un cliente')
      return
    }
    const validacion = validar()
    if (validacion) {
      setErrorGlobal(validacion)
      return
    }

    setLoading(true)
    setErrorGlobal(null)
    setResultados([])

    const tenantSlug = sessionStorage.getItem('tenantSlug')
    const token = sessionStorage.getItem('token')

    const nuevosResultados = []

    for (const usuarioId of clientesSeleccionados) {
      const cfg = getConfig(usuarioId)
      const cliente = clientes.find(c => c.usuario_id === usuarioId)

      const { data, error: fetchErr } = await client.POST(
        '/api/v2/{tenant_slug}/admin/series/{serie_id}/inscripciones',
        {
          params: {
            path: {
              tenant_slug: tenantSlug,
              serie_id: serie.id,
            },
          },
          body: {
            cliente_usuario_id: usuarioId,
            modalidad_cobro: cfg.modalidad_cobro,
            precio_paquete: cfg.modalidad_cobro === 'paquete' ? parseFloat(cfg.precio_paquete) : null,
            metodo_pago: cfg.metodo_pago,
          },
          headers: { Authorization: `Bearer ${token}` },
        }
      )

      if (fetchErr) {
        nuevosResultados.push({
          usuarioId,
          nombre: cliente?.nombre,
          error: errorMensaje(fetchErr),
        })
      } else {
        nuevosResultados.push({
          usuarioId,
          nombre: cliente?.nombre,
          exito: true,
          reservasCreadas: data.num_reservas_creadas ?? 0,
          reservasOmitidas: data.num_reservas_omitidas ?? 0,
        })
      }
      setResultados([...nuevosResultados])
    }

    setLoading(false)

    const exitosos = nuevosResultados.filter(r => r.exito)
    if (exitosos.length > 0) {
      setTimeout(() => {
        onCreado?.()
        if (exitosos.length === nuevosResultados.length) {
          onClose()
        }
      }, 1500)
    }
  }

  if (cargandoClientes) {
    return (
      <Modal title="Inscribir clientes a serie" onClose={onClose} maxWidth="max-w-2xl">
        <div className="py-6 text-center text-sm text-gray-500">Cargando clientes...</div>
      </Modal>
    )
  }

  return (
    <Modal title={`Inscribir clientes a serie #${serie.id}`} onClose={onClose} maxWidth="max-w-3xl">
      <div className="space-y-4">
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
          <p className="text-sm font-medium text-blue-900">{serie.servicio_nombre}</p>
          <p className="text-xs text-blue-700">
            Modalidades habilitadas:{" "}
            {serie.cobro_por_sesion_habilitado && 'Por sesión '}
            {serie.cobro_por_paquete_habilitado && 'Por paquete'}
          </p>
        </div>

        {errorGlobal && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3">
            <p className="text-sm text-red-700">{errorGlobal}</p>
          </div>
        )}

        {/* Lista de clientes */}
        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700">
            Clientes <span className="text-red-500">*</span>
          </label>
          <div className="max-h-40 overflow-y-auto rounded-lg border border-gray-200 bg-white p-2">
            {clientes.length === 0 ? (
              <p className="p-2 text-sm text-gray-500">No hay clientes en este tenant.</p>
            ) : (
              clientes.map(c => (
                <label key={c.usuario_id} className="flex items-center gap-2 p-1.5 hover:bg-gray-50">
                  <input
                    type="checkbox"
                    checked={clientesSeleccionados.includes(c.usuario_id)}
                    onChange={() => toggleCliente(c.usuario_id)}
                    disabled={loading}
                    className="rounded border-gray-300"
                  />
                  <span className="text-sm text-gray-700">{c.nombre} ({c.email})</span>
                </label>
              ))
            )}
          </div>
        </div>

        {/* Configuración por cliente */}
        {clientesSeleccionados.length > 0 && (
          <div className="space-y-3">
            <p className="text-sm font-medium text-gray-700">Configuración por cliente</p>
            {clientesSeleccionados.map(usuarioId => {
              const cliente = clientes.find(c => c.usuario_id === usuarioId)
              const cfg = getConfig(usuarioId)
              return (
                <div key={usuarioId} className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                  <p className="mb-2 text-sm font-medium text-gray-900">{cliente?.nombre}</p>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-600">Modalidad</label>
                      <select
                        value={cfg.modalidad_cobro}
                        onChange={(e) => actualizarConfig(usuarioId, 'modalidad_cobro', e.target.value)}
                        disabled={loading}
                        className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
                      >
                        {serie.cobro_por_sesion_habilitado && <option value="sesion">Por sesión</option>}
                        {serie.cobro_por_paquete_habilitado && <option value="paquete">Por paquete</option>}
                      </select>
                    </div>
                    {cfg.modalidad_cobro === 'paquete' && (
                      <div>
                        <label className="mb-1 block text-xs font-medium text-gray-600">Precio paquete</label>
                        <input
                          type="number"
                          value={cfg.precio_paquete}
                          onChange={(e) => actualizarConfig(usuarioId, 'precio_paquete', e.target.value)}
                          min="0"
                          step="0.01"
                          disabled={loading}
                          placeholder="Ej: 1500"
                          className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
                        />
                      </div>
                    )}
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-600">Método de pago</label>
                      <select
                        value={cfg.metodo_pago}
                        onChange={(e) => actualizarConfig(usuarioId, 'metodo_pago', e.target.value)}
                        disabled={loading}
                        className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
                      >
                        {METODOS_PAGO.map(m => (
                          <option key={m.value} value={m.value}>{m.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Resultados */}
        {resultados.length > 0 && (
          <div className="space-y-2">
            {resultados.map((r, i) => (
              <div
                key={i}
                className={`rounded-lg border p-2 text-sm ${
                  r.exito
                    ? 'border-green-200 bg-green-50 text-green-700'
                    : 'border-red-200 bg-red-50 text-red-700'
                }`}
              >
                <span className="font-medium">{r.nombre ?? `Cliente ${r.usuarioId}`}:</span>{" "}
                {r.exito
                  ? `${r.reservasCreadas} reservas creadas${r.reservasOmitidas > 0 ? ` (${r.reservasOmitidas} omitidas)` : ''}`
                  : r.error}
              </div>
            ))}
          </div>
        )}

        {/* Botones */}
        <div className="flex gap-2 pt-4">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Cerrar
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading || clientesSeleccionados.length === 0}
            className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? 'Inscribiendo...' : 'Inscribir clientes'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
