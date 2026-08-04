import { useState, useEffect } from 'react'
import client from '../../api/client'
import Modal from '../common/Modal'
import { errorMensaje } from '../../utils/errores'

export default function InscribirClientesSerieModal({ serie, onClose, onCreado }) {
  const [clientes, setClientes] = useState([])
  const [clientesSeleccionados, setClientesSeleccionados] = useState([])
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

  const handleSubmit = async () => {
    if (clientesSeleccionados.length === 0) {
      setErrorGlobal('Selecciona al menos un cliente')
      return
    }

    setLoading(true)
    setErrorGlobal(null)
    setResultados([])

    const tenantSlug = sessionStorage.getItem('tenantSlug')
    const token = sessionStorage.getItem('token')

    const nuevosResultados = []

    for (const usuarioId of clientesSeleccionados) {
      const cliente = clientes.find(c => c.usuario_id === usuarioId)

      const { error: fetchErr } = await client.POST(
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
      <Modal title="Invitar clientes a serie" onClose={onClose} maxWidth="max-w-2xl">
        <div className="py-6 text-center text-sm text-gray-500">Cargando clientes...</div>
      </Modal>
    )
  }

  return (
    <Modal title={`Invitar clientes a serie #${serie.id}`} onClose={onClose} maxWidth="max-w-2xl">
      <div className="space-y-4">
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
          <p className="text-sm font-medium text-blue-900">{serie.servicio_nombre}</p>
          <p className="text-xs text-blue-700">
            Cada cliente elegirá su modalidad de cobro y método de pago desde su propio portal
            ("Mis series") al aceptar la invitación.
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
            Clientes a invitar <span className="text-red-500">*</span>
          </label>
          <div className="max-h-60 overflow-y-auto rounded-lg border border-gray-200 bg-white p-2">
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
                {r.exito ? 'Invitación enviada' : r.error}
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
            {loading ? 'Invitando...' : 'Invitar clientes'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
