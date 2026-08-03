import { useState, useEffect, useCallback } from 'react'
import client from '../../api/client'
import Modal from '../common/Modal'
import { getLocalOffset } from '../../utils/fechas'

const FRECUENCIAS = [
  { value: 'semanal', label: 'Semanal' },
  { value: 'quincenal', label: 'Quincenal' },
  { value: 'mensual', label: 'Mensual' },
]

const DIAS_SEMANA = [
  { value: 0, label: 'Lunes' },
  { value: 1, label: 'Martes' },
  { value: 2, label: 'Miércoles' },
  { value: 3, label: 'Jueves' },
  { value: 4, label: 'Viernes' },
  { value: 5, label: 'Sábado' },
  { value: 6, label: 'Domingo' },
]

const METODOS_PAGO = [
  { value: 'online', label: 'Online' },
  { value: 'local', label: 'Local (efectivo/transferencia)' },
  { value: 'registro', label: 'Registro' },
]

function errorMensaje(err) {
  return err?.mensaje ?? err?.detail ?? err?.message ?? JSON.stringify(err)
}

function toDateInputValue(date) {
  const offset = date.getTimezoneOffset() * 60000
  const local = new Date(date.getTime() - offset)
  return local.toISOString().slice(0, 10)
}

function horaDesdeStringUTC(utcString) {
  const d = new Date(utcString)
  return d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', hour12: false })
}

export default function CrearSerieModal({ servicio, solicitud = null, onClose, onCreado }) {
  const [clientes, setClientes] = useState([])
  const [asesores, setAsesores] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [exito, setExito] = useState(null)

  const fechaBase = solicitud ? new Date(solicitud.fecha_hora_propuesta) : null
  const [form, setForm] = useState({
    cliente_usuario_id: solicitud ? String(solicitud.cliente_usuario_id) : '',
    asesor_id: solicitud?.asesor_id ? String(solicitud.asesor_id) : '',
    frecuencia: 'semanal',
    dia_semana: fechaBase ? (fechaBase.getDay() + 6) % 7 : 0,
    hora_inicio: fechaBase ? horaDesdeStringUTC(solicitud.fecha_hora_propuesta) : '10:00',
    duracion_minutos: servicio?.duracion_minutos || 60,
    num_repeticiones: 8,
    fecha_inicio: fechaBase ? toDateInputValue(fechaBase) : '',
    cobro_por_sesion_habilitado: true,
    cobro_por_paquete_habilitado: false,
    precio_paquete: '',
    modalidad_cobro: 'sesion',
    metodo_pago: 'local',
  })

  // Validar que al menos una modalidad esté habilitada
  const modalidadesValidas = form.cobro_por_sesion_habilitado || form.cobro_por_paquete_habilitado
  
  // Si solo una modalidad está habilitada, forzar modalidad_cobro
  useEffect(() => {
    if (form.cobro_por_sesion_habilitado && !form.cobro_por_paquete_habilitado) {
      setForm(prev => ({ ...prev, modalidad_cobro: 'sesion' }))
    } else if (!form.cobro_por_sesion_habilitado && form.cobro_por_paquete_habilitado) {
      setForm(prev => ({ ...prev, modalidad_cobro: 'paquete' }))
    }
  }, [form.cobro_por_sesion_habilitado, form.cobro_por_paquete_habilitado])

  // Cargar clientes y asesores
  useEffect(() => {
    const cargarDatos = async () => {
      const tenantSlug = sessionStorage.getItem('tenantSlug')

      // Cargar clientes
      const { data: clientesData, error: clientesErr } = await client.GET(
        '/api/v2/{tenant_slug}/admin/usuarios',
        { params: { path: { tenant_slug: tenantSlug } } }
      )
      if (!clientesErr && clientesData) {
        setClientes(clientesData.filter(u => u.rol === 'cliente'))
      }

      // Cargar asesores
      const { data: asesoresData, error: asesoresErr } = await client.GET(
        '/api/v2/{tenant_slug}/admin/usuarios',
        { params: { path: { tenant_slug: tenantSlug } } }
      )
      if (!asesoresErr && asesoresData) {
        setAsesores(asesoresData.filter(u => u.rol === 'asesor' || u.rol === 'admin'))
      }
    }
    cargarDatos()
  }, [])

  const handleChange = (campo) => (e) => {
    const valor = e.target.type === 'checkbox' ? e.target.checked : e.target.value
    setForm(prev => ({ ...prev, [campo]: valor }))
  }

  const handleSubmit = async () => {
    if (!form.cliente_usuario_id) {
      setError('Selecciona un cliente')
      return
    }
    if (!form.fecha_inicio) {
      setError('Selecciona una fecha de inicio')
      return
    }
    if (!modalidadesValidas) {
      setError('Debes habilitar al menos una modalidad de cobro')
      return
    }
    if (form.modalidad_cobro === 'paquete' && !form.precio_paquete) {
      setError('Ingresa el precio del paquete')
      return
    }

    setLoading(true)
    setError(null)
    setExito(null)

    const tenantSlug = sessionStorage.getItem('tenantSlug')
    const token = sessionStorage.getItem('token')

    const basePayload = {
      frecuencia: form.frecuencia,
      dia_semana: parseInt(form.dia_semana),
      hora_inicio: form.hora_inicio,
      duracion_minutos: parseInt(form.duracion_minutos),
      num_repeticiones: parseInt(form.num_repeticiones),
      asesor_id: form.asesor_id ? parseInt(form.asesor_id) : null,
      cobro_por_sesion_habilitado: form.cobro_por_sesion_habilitado,
      cobro_por_paquete_habilitado: form.cobro_por_paquete_habilitado,
      precio_paquete: form.precio_paquete ? parseFloat(form.precio_paquete) : null,
      modalidad_cobro: form.modalidad_cobro,
      metodo_pago: form.metodo_pago,
    }

    const esDesdeSolicitud = solicitud != null
    const payload = esDesdeSolicitud
      ? basePayload
      : {
          ...basePayload,
          servicio_id: servicio.id,
          cliente_usuario_id: parseInt(form.cliente_usuario_id),
          fecha_inicio: `${form.fecha_inicio}T00:00:00${getLocalOffset()}`,
        }

    const endpoint = esDesdeSolicitud
      ? '/api/v2/{tenant_slug}/admin/solicitudes/{solicitud_id}/confirmar-serie'
      : '/api/v2/{tenant_slug}/admin/series'

    const params = esDesdeSolicitud
      ? { path: { tenant_slug: tenantSlug, solicitud_id: solicitud.id } }
      : { path: { tenant_slug: tenantSlug } }

    const { data, error: fetchErr } = await client.POST(
      endpoint,
      {
        params,
        body: payload,
        headers: { Authorization: `Bearer ${token}` },
      }
    )

    setLoading(false)

    if (fetchErr) {
      setError(errorMensaje(fetchErr))
      return
    }

    setExito(`Serie creada exitosamente: ${data.num_reservas_creadas} reservas creadas, ${data.num_reservas_omitidas} omitidas`)
    setTimeout(() => {
      onCreado?.(data)
      onClose()
    }, 2000)
  }

  return (
    <Modal title="Crear Serie de Reservas Recurrentes" onClose={onClose} maxWidth="max-w-2xl">
      <div className="space-y-4">
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
          <p className="text-sm font-medium text-blue-900">Servicio: {servicio?.nombre}</p>
          <p className="text-xs text-blue-700">Duración: {servicio?.duracion_minutos} min</p>
        </div>

        {solicitud?.notas_cliente && (
          <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-3">
            <p className="text-xs font-medium text-yellow-800">Notas del cliente</p>
            <p className="text-sm text-yellow-900">{solicitud.notas_cliente}</p>
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {exito && (
          <div className="rounded-lg border border-green-200 bg-green-50 p-3">
            <p className="text-sm text-green-700">{exito}</p>
          </div>
        )}

        {/* Cliente */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Cliente <span className="text-red-500">*</span>
          </label>
          <select
            value={form.cliente_usuario_id}
            onChange={handleChange('cliente_usuario_id')}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">Selecciona un cliente</option>
            {clientes.map(c => (
              <option key={c.usuario_id} value={c.usuario_id}>
                {c.nombre} ({c.email})
              </option>
            ))}
          </select>
        </div>

        {/* Asesor */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Asesor (opcional)
          </label>
          <select
            value={form.asesor_id}
            onChange={handleChange('asesor_id')}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">Sin asesor específico</option>
            {asesores.map(a => (
              <option key={a.id} value={a.id}>
                {a.nombre}
              </option>
            ))}
          </select>
        </div>

        {/* Frecuencia y día */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Frecuencia <span className="text-red-500">*</span>
            </label>
            <select
              value={form.frecuencia}
              onChange={handleChange('frecuencia')}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              {FRECUENCIAS.map(f => (
                <option key={f.value} value={f.value}>{f.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Día de la semana <span className="text-red-500">*</span>
            </label>
            <select
              value={form.dia_semana}
              onChange={handleChange('dia_semana')}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              {DIAS_SEMANA.map(d => (
                <option key={d.value} value={d.value}>{d.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Hora y duración */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Hora de inicio <span className="text-red-500">*</span>
            </label>
            <input
              type="time"
              value={form.hora_inicio}
              onChange={handleChange('hora_inicio')}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Duración (min) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              value={form.duracion_minutos}
              onChange={handleChange('duracion_minutos')}
              min="1"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
        </div>

        {/* Fecha inicio y repeticiones */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Fecha de inicio <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={form.fecha_inicio}
              onChange={handleChange('fecha_inicio')}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Número de repeticiones <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              value={form.num_repeticiones}
              onChange={handleChange('num_repeticiones')}
              min="1"
              max="50"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
        </div>

        {/* Modalidades de cobro (checkboxes independientes) */}
        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700">
            Modalidades de cobro disponibles
          </label>
          <div className="space-y-2">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.cobro_por_sesion_habilitado}
                onChange={handleChange('cobro_por_sesion_habilitado')}
                className="rounded border-gray-300"
              />
              <span className="text-sm text-gray-700">Ofrecer pago por sesión</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.cobro_por_paquete_habilitado}
                onChange={handleChange('cobro_por_paquete_habilitado')}
                className="rounded border-gray-300"
              />
              <span className="text-sm text-gray-700">Ofrecer pago por paquete</span>
            </label>
          </div>
          {!modalidadesValidas && (
            <p className="mt-1 text-xs text-red-600">Debes habilitar al menos una modalidad</p>
          )}
        </div>

        {/* Selector de modalidad elegida (solo si ambas están habilitadas) */}
        {form.cobro_por_sesion_habilitado && form.cobro_por_paquete_habilitado && (
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Modalidad elegida para esta serie <span className="text-red-500">*</span>
            </label>
            <select
              value={form.modalidad_cobro}
              onChange={handleChange('modalidad_cobro')}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="sesion">Por sesión</option>
              <option value="paquete">Por paquete</option>
            </select>
            <p className="mt-1 text-xs text-gray-500">
              Informada por las notas del cliente si viene de una solicitud
            </p>
          </div>
        )}

        {/* Precio paquete (solo si es paquete) */}
        {form.modalidad_cobro === 'paquete' && (
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Precio del paquete <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              value={form.precio_paquete}
              onChange={handleChange('precio_paquete')}
              min="0"
              step="0.01"
              placeholder="Ej: 1500.00"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
        )}

        {/* Método de pago */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Método de pago <span className="text-red-500">*</span>
          </label>
          <select
            value={form.metodo_pago}
            onChange={handleChange('metodo_pago')}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          >
            {METODOS_PAGO.map(m => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </div>

        {/* Botones */}
        <div className="flex gap-2 pt-4">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading}
            className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? 'Creando...' : 'Crear Serie'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
