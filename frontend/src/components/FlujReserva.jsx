import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import client from '../api/client'
const ERROR_MESSAGES = {
  cupo_agotado: 'Este lugar ya no está disponible.',
  reserva_duplicada: 'Ya tienes una reserva en esta sesión.',
  conflicto_concurrencia: 'Intenta de nuevo.',
  identidad_requerida: 'Inicia sesión para continuar.',
}

function toLocalTime(utcString, timezone) {
  return new Intl.DateTimeFormat('es-MX', {
    hour: 'numeric', minute: '2-digit', hour12: true, timeZone: timezone,
  }).format(new Date(utcString))
}

function formatDateLong(utcString, timezone) {
  return new Intl.DateTimeFormat('es-MX', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: timezone,
  }).format(new Date(utcString))
}

function utcToOffset(utcString) {
  const date = new Date(utcString)
  const offsetMin = -date.getTimezoneOffset()
  const local = new Date(date.getTime() + offsetMin * 60000)
  const sign = offsetMin >= 0 ? '+' : '-'
  const abs = Math.abs(offsetMin)
  const hours = String(Math.floor(abs / 60)).padStart(2, '0')
  const mins = String(abs % 60).padStart(2, '0')
  const iso = local.toISOString().replace('Z', '')
  return `${iso}${sign}${hours}:${mins}`
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
  if (remaining <= 0) return <span className="font-semibold text-red-600">Tiempo agotado</span>

  const mins = Math.floor(remaining / 60000)
  const secs = Math.floor((remaining % 60000) / 1000)
  return (
    <span className="font-mono text-lg font-bold">
      {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
    </span>
  )
}

export default function FlujReserva() {
  const { tenantSlug, servicioId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const slot = location.state?.slot
  const token = sessionStorage.getItem('token')
  const usuarioSesion = token ? JSON.parse(sessionStorage.getItem('usuario') || 'null') : null

  const [servicio, setServicio] = useState(null)
  const [step, setStep] = useState(1)
  const [form, setForm] = useState({ email: '', nombre: '', telefono: '', notas: '' })
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [resultado, setResultado] = useState(null)
  const [errorReserva, setErrorReserva] = useState(null)
  const retryRef = useRef(false)
  const submitLockRef = useRef(false)

  const timezone = 'America/Mexico_City'

  // Obtener datos del servicio
  useEffect(() => {
    const fetchServicio = async () => {
      const { data, error } = await client.GET(
        '/api/v2/{tenant_slug}/servicios/{servicio_id}',
        {
          params: { path: { tenant_slug: tenantSlug, servicio_id: servicioId } },
        },
      )
      if (!error) {
        setServicio(data)
      }
    }
    fetchServicio()
  }, [tenantSlug, servicioId])

  const validar = () => {
    if (usuarioSesion) return true
    const errs = {}
    if (!form.nombre.trim()) errs.nombre = 'El nombre es obligatorio'
    if (!form.email.trim()) {
      errs.email = 'El email es obligatorio'
    } else if (!/\S+@\S+\.\S+/.test(form.email)) {
      errs.email = 'Email inválido'
    }
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const hacerReserva = useCallback(async () => {
    const body = {
      servicio_id: servicioId,
      fecha_hora_inicio: utcToOffset(slot.fecha_hora_inicio),
      sesion_id: slot.sesion_existente_id ?? null,
      email_invitado: form.email,
      nombre_invitado: form.nombre,
      telefono_invitado: form.telefono || null,
      notas_cliente: form.notas || null,
      canal: 'web',
    }

    const { data, error } = await client.POST(
      '/api/v2/{tenant_slug}/reservas',
      {
        params: { path: { tenant_slug: tenantSlug } },
        body,
        ...(token ? { headers: { Authorization: `Bearer ${token}` } } : {}),
      },
    )

    return { data, error }
  }, [tenantSlug, token, slot, servicioId, form])

  const handleSubmit = async () => {
    if (!validar() || submitLockRef.current) return

    submitLockRef.current = true
    setSubmitting(true)
    setErrorReserva(null)

    try {
      let { data, error } = await hacerReserva()

      if (error?.codigo === 'conflicto_concurrencia' && !retryRef.current) {
        retryRef.current = true
        ;({ data, error } = await hacerReserva())
      }

      if (error) {
        setErrorReserva(error)
        setStep(3)
        return
      }

      setResultado(data)
      setStep(3)
    } finally {
      setSubmitting(false)
      submitLockRef.current = false
    }
  }

  const handleChange = (field) => (e) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }))
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }))
  }

  if (step === 1) {
    return (
      <div className="mx-auto max-w-md">
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Confirmar reserva</h2>

          <div className="mb-4 space-y-2 text-sm text-gray-700">
            <p>
              <span className="font-medium text-gray-500">Fecha:</span>{' '}
              {formatDateLong(slot.fecha_hora_inicio, timezone)}
            </p>
            <p>
              <span className="font-medium text-gray-500">Horario:</span>{' '}
              {toLocalTime(slot.fecha_hora_inicio, timezone)} &mdash;{' '}
              {toLocalTime(slot.fecha_hora_fin, timezone)}
            </p>
            {slot.asesor && (
              <p>
                <span className="font-medium text-gray-500">Asesor:</span> {slot.asesor.nombre}
              </p>
            )}
            {servicio && (
              <p>
                <span className="font-medium text-gray-500">Servicio:</span> {servicio.nombre}
              </p>
            )}
            {servicio?.precio && (
              <p>
                <span className="font-medium text-gray-500">Precio:</span>{' '}
                {servicio.moneda === 'MXN' ? '$' : servicio.moneda}{' '}
                {new Intl.NumberFormat('es-MX').format(servicio.precio)}
              </p>
            )}
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
            >
              Volver
            </button>
            <button
              type="button"
              onClick={() => setStep(2)}
              className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
            >
              Confirmar reserva
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (step === 2) {
    return (
      <div className="mx-auto max-w-md">
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Tus datos</h2>

          <div className="mb-4 space-y-3">
            {usuarioSesion ? (
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
                Vas a reservar como <span className="font-medium">{usuarioSesion.nombre}</span>.
              </div>
            ) : (
              <>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Nombre <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.nombre}
                    onChange={handleChange('nombre')}
                    className={`w-full rounded-lg border px-3 py-2 text-sm outline-none transition focus:ring-2 focus:ring-blue-500 ${
                      errors.nombre ? 'border-red-400' : 'border-gray-300'
                    }`}
                    placeholder="Tu nombre"
                  />
                  {errors.nombre && (
                    <p className="mt-1 text-xs text-red-500">{errors.nombre}</p>
                  )}
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={handleChange('email')}
                    className={`w-full rounded-lg border px-3 py-2 text-sm outline-none transition focus:ring-2 focus:ring-blue-500 ${
                      errors.email ? 'border-red-400' : 'border-gray-300'
                    }`}
                    placeholder="correo@ejemplo.com"
                  />
                  {errors.email && (
                    <p className="mt-1 text-xs text-red-500">{errors.email}</p>
                  )}
                </div>
              </>
            )}

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Teléfono <span className="text-gray-400">(opcional)</span>
              </label>
              <input
                type="tel"
                value={form.telefono}
                onChange={handleChange('telefono')}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none transition focus:ring-2 focus:ring-blue-500"
                placeholder="55 1234 5678"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Notas <span className="text-gray-400">(opcional)</span>
              </label>
              <textarea
                value={form.notas}
                onChange={handleChange('notas')}
                rows={3}
                className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none transition focus:ring-2 focus:ring-blue-500"
                placeholder="Algo que debamos saber..."
              />
            </div>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
            >
              Atrás
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? 'Reservando...' : 'Reservar'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // El backend envuelve errores de negocio como HTTPException(status, {codigo, mensaje}),
  // que FastAPI serializa como {"detail": {"codigo": ..., "mensaje": ...}}. openapi-fetch
  // no desenvuelve `detail`, así que el código/mensaje real vive en errorReserva.detail,
  // no en el nivel superior.
  const errorCodigo = errorReserva?.detail?.codigo ?? errorReserva?.codigo
  const errorMensaje =
    ERROR_MESSAGES[errorCodigo] ??
    errorReserva?.detail?.mensaje ??
    errorReserva?.mensaje ??
    'Ocurrió un error inesperado.'
  const esConfirmada = resultado?.reserva?.estado === 'confirmada'
  const esEnEspera = resultado?.reserva?.estado === 'en_espera'
  const esNuevoEstadoPendiente = resultado?.reserva?.estado === 'pendiente'
  const reserva = resultado?.reserva
  const checkout = resultado?.checkout

  return (
    <div className="mx-auto max-w-md">
      <div
        className={`rounded-xl border p-6 shadow-sm ${
          errorReserva
            ? 'border-red-200 bg-red-50'
            : esConfirmada
              ? 'border-green-200 bg-green-50'
              : esEnEspera
                ? 'border-yellow-200 bg-yellow-50'
                : 'border-blue-200 bg-blue-50'
        }`}
      >
        {errorReserva && (
          <>
            <h2 className="mb-2 text-lg font-semibold text-red-800">
              {errorCodigo === 'cupo_agotado' ? 'Ya no hay lugar' : 'No pudimos completar la reserva'}
            </h2>
            <p className="mb-4 text-sm text-red-700">{errorMensaje}</p>
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="w-full rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700"
            >
              {errorCodigo === 'cupo_agotado' || errorCodigo === 'reserva_duplicada'
                ? 'Elegir otro horario'
                : 'Volver'}
            </button>
          </>
        )}

        {esConfirmada && (
          <>
            <div className="mb-2 flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-green-200 text-green-700 text-lg font-bold">
                ✓
              </span>
              <h2 className="text-lg font-semibold text-green-800">Reserva confirmada</h2>
            </div>
            <div className="mb-4 space-y-1 text-sm text-green-700">
              <p>
                <span className="font-medium">Folio:</span> {reserva.folio}
              </p>
              <p>
                <span className="font-medium">Código:</span> {reserva.codigo_confirmacion}
              </p>
              {reserva.meet_url && (
                <p>
                  <a
                    href={reserva.meet_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-blue-700 underline"
                  >
                    Unirse a la videollamada
                  </a>
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="w-full rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-green-700"
            >
              Volver al calendario
            </button>
          </>
        )}

        {esNuevoEstadoPendiente && (
          <>
            <div className="mb-2 flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-200 text-blue-700 text-lg font-bold">
                📋
              </span>
              <h2 className="text-lg font-semibold text-blue-800">Solicitud recibida</h2>
            </div>
            <p className="mb-3 text-sm text-blue-700">
              Tu solicitud fue recibida. Te confirmaremos el asesor y horario en breve.
            </p>
            <div className="mb-4 space-y-1 text-sm text-blue-700">
              <p>
                <span className="font-medium">Folio:</span> {reserva.folio}
              </p>
              <p>
                <span className="font-medium">Código:</span> {reserva.codigo_confirmacion}
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
            >
              Volver al calendario
            </button>
          </>
        )}

        {esEnEspera && (
          <>
            <div className="mb-2 flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-yellow-200 text-yellow-700 text-lg font-bold">
                ⏳
              </span>
              <h2 className="text-lg font-semibold text-yellow-800">Pago pendiente</h2>
            </div>
            <p className="mb-1 text-sm text-yellow-700">
              Tu reserva está en espera de pago.
            </p>
            {reserva.hold_expira_en && (
              <div className="mb-4 text-center">
                <p className="mb-1 text-xs text-yellow-600">Tiempo restante:</p>
                <CountdownTimer expiraEn={reserva.hold_expira_en} />
              </div>
            )}
            {checkout?.url && (
              <a
                href={checkout.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mb-2 block w-full rounded-lg bg-yellow-600 px-4 py-2 text-center text-sm font-medium text-white transition hover:bg-yellow-700"
              >
                Ir a pagar
              </a>
            )}
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="w-full rounded-lg border border-yellow-300 px-4 py-2 text-sm font-medium text-yellow-800 transition hover:bg-yellow-100"
            >
              Volver al calendario
            </button>
          </>
        )}
      </div>
    </div>
  )
}
