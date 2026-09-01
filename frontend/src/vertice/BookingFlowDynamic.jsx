import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import client from '../api/client'
import {
  Button,
  Stepper,
  ActionBar,
  CalendarMonth,
  SlotCard,
  PlanCard,
} from '../design-system'

export function BookingFlowDynamic() {
  const { servicioId, tenantSlug } = useParams()
  const navigate = useNavigate()

  const [paso, setPaso] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Estado de datos
  const [servicio, setServicio] = useState(null)
  const [disponibilidad, setDisponibilidad] = useState({})

  // Estado de selección
  const [fechaSeleccionada, setFechaSeleccionada] = useState(null)
  const [horarioSeleccionado, setHorarioSeleccionado] = useState(null)
  const [planSeleccionado, setPlanSeleccionado] = useState(null)

  // Estado del usuario invitado (no autenticado)
  const [nombreInvitado, setNombreInvitado] = useState('')
  const [emailInvitado, setEmailInvitado] = useState('')
  const [telefonoInvitado, setTelefonoInvitado] = useState('')

  // Planes del servicio si existen, si no usar confirmación directa
  const tienePaquetes = servicio?.paquetes?.length > 0
  const planes = tienePaquetes ? servicio.paquetes : []

  // Cargar datos del servicio
  useEffect(() => {
    const fetchServicio = async () => {
      try {
        setLoading(true)
        const { data: srv, error: srvErr } = await client.GET(
          '/api/v2/{tenant_slug}/servicios',
          {
            params: { path: { tenant_slug: tenantSlug } },
          }
        )
        if (srvErr) throw srvErr

        const service = srv?.find((s) => s.id == servicioId)
        if (!service) throw new Error('Servicio no encontrado')
        setServicio(service)
        setError(null)
      } catch (err) {
        setError(err.message || 'Error al cargar servicio')
        console.error('Error:', err)
      } finally {
        setLoading(false)
      }
    }

    if (tenantSlug && servicioId) {
      fetchServicio()
    }
  }, [tenantSlug, servicioId])

  // Cargar disponibilidad cuando se selecciona fecha
  useEffect(() => {
    if (!fechaSeleccionada || !servicioId) return

    const fetchDisponibilidad = async () => {
      try {
        // Formato RFC3339 con offset de timezone: 2026-08-01T00:00:00-06:00
        const offset = -fechaSeleccionada.getTimezoneOffset()
        const hours = Math.floor(Math.abs(offset) / 60)
        const minutes = Math.abs(offset) % 60
        const sign = offset >= 0 ? '+' : '-'
        const tzOffset = `${sign}${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
        const isoDate = fechaSeleccionada.toISOString().split('T')[0]
        const fecha = `${isoDate}T00:00:00${tzOffset}`

        // Intentar obtener disponibilidad del API con tenant_slug
        const { data: disp, error: dispErr } = await client.GET(
          '/api/v2/{tenant_slug}/servicios/{servicio_id}/disponibilidad',
          {
            params: {
              path: { tenant_slug: tenantSlug, servicio_id: servicioId },
              query: { fecha },
            },
          }
        )

        if (dispErr) {
          console.error('Error del API:', dispErr)
          throw dispErr
        }

        if (disp?.slots) {
          // Transformar datos del API al formato esperado por el frontend
          const sesionesTransformadas = disp.slots.map(slot => ({
            fecha_hora_inicio: slot.fecha_hora_inicio,
            fecha_hora_fin: slot.fecha_hora_fin,
            rango: new Date(slot.fecha_hora_inicio).toLocaleTimeString('es-MX', {
              hour: '2-digit',
              minute: '2-digit',
            }),
            disponible: slot.disponible,
            estado: slot.disponible ? 'Disponible' : (slot.motivo_no_disponible === 'cupo_lleno' ? 'Lleno' : 'No disponible'),
            asesor: slot.asesor,
            cupo_disponible: slot.cupo_disponible,
            motivo_no_disponible: slot.motivo_no_disponible,
          }))
          setDisponibilidad({
            ...disp,
            sesiones: sesionesTransformadas,
          })
        } else if (disp?.sesiones) {
          // Fallback para API antiguo
          setDisponibilidad(disp)
        } else {
          // Sin datos disponibles
          setDisponibilidad({
            sesiones: [],
          })
        }
      } catch (err) {
        console.error('Error cargando disponibilidad:', err)
        setDisponibilidad({
          sesiones: [],
        })
      }
    }

    fetchDisponibilidad()
  }, [fechaSeleccionada, servicioId, tenantSlug])

  const handlePasoSelect = (n) => {
    if (n <= paso) setPaso(n)
  }

  const handleProximo = async () => {
    if (paso === 1 && (!fechaSeleccionada || horarioSeleccionado === null)) return
    if (paso === 2) {
      if (!nombreInvitado.trim()) {
        setError('Por favor ingresa tu nombre')
        return
      }
      if (!emailInvitado.trim()) {
        setError('Por favor ingresa tu correo')
        return
      }
      if (tienePaquetes && !planSeleccionado) return
    }

    if (paso < 2) {
      setPaso(paso + 1)
    } else {
      // Crear reserva
      try {
        const sesiones = disponibilidad.sesiones || []
        const slot = sesiones[horarioSeleccionado]

        // Usar fecha_hora_inicio directamente del slot si existe, si no construirla
        let fecha_hora_inicio = slot.fecha_hora_inicio
        if (!fecha_hora_inicio) {
          const dateStr = fechaSeleccionada.toISOString().split('T')[0]
          const offset = -fechaSeleccionada.getTimezoneOffset()
          const hours = Math.floor(Math.abs(offset) / 60)
          const minutes = Math.abs(offset) % 60
          const sign = offset >= 0 ? '+' : '-'
          const tzOffset = `${sign}${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
          fecha_hora_inicio = `${dateStr}T${slot.rango}:00${tzOffset}`
        }

        // Intentar obtener token si existe
        const token = localStorage.getItem('acceso_token') || sessionStorage.getItem('acceso_token')
        const headers = token ? { Authorization: `Bearer ${token}` } : {}

        console.log('POST /reservas body:', {
          servicio_id: parseInt(servicioId),
          fecha_hora_inicio,
          nombre_invitado: nombreInvitado.trim(),
          email_invitado: emailInvitado.trim(),
          telefono_invitado: telefonoInvitado.trim() || undefined,
        })

        const { data: response, error: reservaErr } = await client.POST(
          '/api/v2/{tenant_slug}/reservas',
          {
            params: {
              path: { tenant_slug: tenantSlug },
            },
            headers,
            body: {
              servicio_id: parseInt(servicioId),
              fecha_hora_inicio,
              nombre_invitado: nombreInvitado.trim(),
              email_invitado: emailInvitado.trim(),
              ...(telefonoInvitado.trim() && { telefono_invitado: telefonoInvitado.trim() }),
            },
          }
        )

        if (reservaErr) {
          console.error('Error del API:', reservaErr)
          throw reservaErr
        }

        console.log('Response completo:', response)
        console.log('Response keys:', Object.keys(response || {}))

        const reserva = response.reserva || response
        const checkout = response.checkout
        const accesoTokenPlano = response.acceso_token_plano

        console.log('Reserva:', reserva)
        console.log('Checkout:', checkout)
        console.log('AccesoTokenPlano:', accesoTokenPlano)
        console.log('¿Tiene token de activación?:', !!accesoTokenPlano)
        console.log('¿Tiene URL de pago?:', !!checkout?.url)
        console.log('Estado de reserva:', reserva?.estado)
        console.log('Estado de pago:', reserva?.estado_pago)

        // Guardar el token de activación si se proporcionó (para usuarios invitados)
        if (accesoTokenPlano) {
          sessionStorage.setItem('acceso_token', accesoTokenPlano)
          console.log('✓ Token JWT guardado en sessionStorage')
          console.log('Token primeros 50 chars:', accesoTokenPlano.substring(0, 50))
        } else {
          console.warn('⚠️ ADVERTENCIA: No se recibió token de activación en la respuesta')
          console.warn('AccesoTokenPlano value:', accesoTokenPlano)
        }

        // Si hay checkout (pago requerido), redirigir al checkout externo
        if (checkout?.url) {
          console.log('Redirigiendo a URL de pago externa:', checkout.url)
          window.location.href = checkout.url
        } else if (reserva?.folio) {
          // Si no hay checkout.url, verificar si la reserva requiere pago
          // Estado EN_ESPERA significa que está esperando pago online
          // Estado PENDIENTE_PAGO o estado_pago === PENDIENTE también requieren pago
          if (
            reserva.estado === 'en_espera' ||
            reserva.estado_pago === 'pendiente'
          ) {
            console.log('Redirigiendo a CheckoutDynamic para folio:', reserva.folio)
            navigate(`/t/${tenantSlug}/checkout/${reserva.folio}`, { state: { reserva } })
          } else {
            // Ir a confirmación (reserva completamente confirmada)
            console.log('Redirigiendo a pantalla de confirmación')
            navigate(
              `/t/${tenantSlug}/confirmar/${reserva.folio}`,
              { state: { reserva } }
            )
          }
        }
      } catch (err) {
        setError(err.message || err.detail?.detail || 'Error al crear reserva')
        console.error('Error creando reserva:', err)
      }
    }
  }

  const handleAnterior = () => {
    if (paso > 1) {
      setPaso(paso - 1)
    } else {
      navigate(`/t/${tenantSlug}`)
    }
  }

  const sesiones = disponibilidad.sesiones || []

  const resumenPaso = {
    1: fechaSeleccionada && horarioSeleccionado !== null
      ? `${fechaSeleccionada.getDate()}/${fechaSeleccionada.getMonth() + 1} - ${sesiones[horarioSeleccionado]?.rango}`
      : 'Selecciona fecha y hora',
    2: tienePaquetes
      ? (planSeleccionado ? planes.find(p => p.id === planSeleccionado)?.nombre : 'Selecciona plan')
      : 'Listo para confirmar',
  }

  const botonDeshabilitado = {
    1: !fechaSeleccionada || horarioSeleccionado === null,
    2: !nombreInvitado.trim() || !emailInvitado.trim() || (tienePaquetes && !planSeleccionado),
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <p style={{ fontSize: 'var(--text-body)' }}>Cargando...</p>
      </div>
    )
  }

  if (error && !servicio) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ color: 'var(--color-warn)', fontSize: 'var(--text-body)' }}>Error: {error}</p>
          <Button variant="primary" onClick={() => navigate(`/t/${tenantSlug}`)}>
            Volver al catálogo
          </Button>
        </div>
      </div>
    )
  }

  // Si el servicio requiere confirmación manual, mostrar mensaje informativo
  if (servicio?.requiere_confirmacion) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          backgroundColor: 'var(--color-bg)',
          padding: 'var(--gutter-movil)',
        }}
      >
        <div
          style={{
            maxWidth: 500,
            textAlign: 'center',
            animation: 'riseIn var(--dur-enter) var(--ease-out)',
          }}
        >
          <div style={{ fontSize: 60, marginBottom: 'var(--space-6)' }}>📋</div>

          <h1
            style={{
              fontSize: 'var(--text-display-sm)',
              fontWeight: 'var(--weight-bold)',
              margin: '0 0 var(--space-3) 0',
              color: 'var(--color-text)',
            }}
          >
            Este servicio requiere confirmación
          </h1>

          <p
            style={{
              fontSize: 'var(--text-body)',
              color: 'var(--color-text-muted)',
              margin: '0 0 var(--space-8) 0',
              lineHeight: 'var(--leading-normal)',
            }}
          >
            Para este servicio, debes enviar una solicitud con tu fecha y hora propuesta. El equipo la revisará y te confirmará.
          </p>

          <p
            style={{
              fontSize: 'var(--text-body)',
              color: 'var(--color-text)',
              margin: '0 0 var(--space-8) 0',
              fontWeight: 'var(--weight-semibold)',
            }}
          >
            Acceso disponible para usuarios autenticados
          </p>

          <div
            style={{
              display: 'flex',
              gap: 'var(--space-4)',
              flexDirection: 'column',
            }}
          >
            <Button
              variant="ghost"
              onClick={() => navigate(`/t/${tenantSlug}`)}
              block
            >
              Volver al catálogo
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100vh',
        backgroundColor: 'var(--color-bg)',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: 'var(--gutter-movil)',
          borderBottom: 'var(--border-hairline)',
          backgroundColor: 'var(--color-surface)',
        }}
      >
        <h1
          style={{
            fontSize: 'var(--text-h2)',
            fontWeight: 'var(--weight-semibold)',
            margin: 0,
            marginBottom: 'var(--space-3)',
          }}
        >
          Reservar
        </h1>
        <p
          style={{
            fontSize: 'var(--text-body-sm)',
            color: 'var(--color-text-muted)',
            margin: 0,
            marginBottom: 'var(--space-4)',
          }}
        >
          {servicio?.nombre}
        </p>
        <Stepper
          steps={['Fecha y Hora', 'Plan']}
          current={paso}
          onSelect={handlePasoSelect}
        />
      </div>

      {/* Contenido */}
      <div
        style={{
          flex: 1,
          padding: 'var(--gutter-movil)',
          maxWidth: 'var(--width-content)',
          width: '100%',
          margin: '0 auto',
        }}
      >
        {error && (
          <div
            style={{
              backgroundColor: 'var(--color-warn-100)',
              color: 'var(--color-warn)',
              padding: 'var(--space-4)',
              borderRadius: 'var(--radius-md)',
              marginBottom: 'var(--space-6)',
            }}
          >
            {error}
          </div>
        )}

        {paso === 1 && (
          <div>
            <h2 style={{ fontSize: 'var(--text-h3)', margin: '0 0 var(--space-5) 0' }}>
              Elige fecha y hora
            </h2>

            <CalendarMonth
              month={new Date()}
              selected={fechaSeleccionada}
              minDate={new Date()}
              onSelect={setFechaSeleccionada}
              availability={() => 2}
              footer="Selecciona una fecha para ver horarios disponibles"
            />

            {fechaSeleccionada && (
              <div style={{ marginTop: 'var(--space-8)' }}>
                <h3 style={{ fontSize: 'var(--text-title)', margin: '0 0 var(--space-4) 0' }}>
                  {fechaSeleccionada?.toLocaleDateString('es-MX', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                  })}
                </h3>

                {sesiones.length === 0 ? (
                  <p style={{ color: 'var(--color-text-muted)' }}>
                    No hay horarios disponibles para esta fecha.
                  </p>
                ) : (
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                      gap: 'var(--space-3)',
                    }}
                  >
                    {sesiones.map((slot, idx) => (
                      <SlotCard
                        key={idx}
                        rango={slot.rango}
                        estado={slot.estado}
                        disponible={slot.disponible !== false}
                        selected={horarioSeleccionado === idx}
                        onClick={() => setHorarioSeleccionado(idx)}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {paso === 2 && (
          <div>
            <h2 style={{ fontSize: 'var(--text-h3)', margin: '0 0 var(--space-5) 0' }}>
              Confirmar
            </h2>

            {/* Formulario de datos personales */}
            <div
              style={{
                border: 'var(--border-hairline)',
                borderRadius: 'var(--radius-xl)',
                padding: 'var(--space-6)',
                backgroundColor: 'var(--color-surface)',
                marginBottom: 'var(--space-6)',
              }}
            >
              <h3 style={{ fontSize: 'var(--text-title)', margin: '0 0 var(--space-4) 0' }}>
                Tu información
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                <input
                  type="text"
                  placeholder="Nombre completo"
                  value={nombreInvitado}
                  onChange={(e) => setNombreInvitado(e.target.value)}
                  style={{
                    padding: 'var(--space-3)',
                    border: 'var(--border-hairline)',
                    borderRadius: 'var(--radius-md)',
                    fontSize: 'var(--text-body)',
                    fontFamily: 'var(--font-body)',
                  }}
                />
                <input
                  type="email"
                  placeholder="Correo electrónico"
                  value={emailInvitado}
                  onChange={(e) => setEmailInvitado(e.target.value)}
                  style={{
                    padding: 'var(--space-3)',
                    border: 'var(--border-hairline)',
                    borderRadius: 'var(--radius-md)',
                    fontSize: 'var(--text-body)',
                    fontFamily: 'var(--font-body)',
                  }}
                />
                <input
                  type="tel"
                  placeholder="Teléfono (opcional)"
                  value={telefonoInvitado}
                  onChange={(e) => setTelefonoInvitado(e.target.value)}
                  style={{
                    padding: 'var(--space-3)',
                    border: 'var(--border-hairline)',
                    borderRadius: 'var(--radius-md)',
                    fontSize: 'var(--text-body)',
                    fontFamily: 'var(--font-body)',
                  }}
                />
              </div>
            </div>

            {tienePaquetes && (
              <div style={{ marginBottom: 'var(--space-6)' }}>
                {planes.map((plan, idx) => (
                  <PlanCard
                    key={idx}
                    nombre={plan.nombre}
                    precio={`$${plan.precio}`}
                    nota={plan.descripcion}
                    selected={planSeleccionado === plan.id}
                    onClick={() => setPlanSeleccionado(plan.id)}
                  />
                ))}
              </div>
            )}

            {/* Resumen */}
            <div
              style={{
                border: 'var(--border-hairline)',
                borderRadius: 'var(--radius-2xl)',
                padding: 'var(--space-6)',
                backgroundColor: 'var(--color-surface)',
              }}
            >
              <h3 style={{ fontSize: 'var(--text-title)', margin: '0 0 var(--space-4) 0' }}>
                Resumen
              </h3>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
                <span>Servicio:</span>
                <span style={{ fontWeight: 'var(--weight-semibold)' }}>{servicio?.nombre}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
                <span>Fecha y hora:</span>
                <span style={{ fontWeight: 'var(--weight-semibold)' }}>
                  {fechaSeleccionada && horarioSeleccionado !== null
                    ? `${fechaSeleccionada.getDate()}/${fechaSeleccionada.getMonth() + 1} a las ${sesiones[horarioSeleccionado]?.rango}`
                    : '-'}
                </span>
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  paddingTop: 'var(--space-3)',
                  borderTop: 'var(--border-hairline)',
                }}
              >
                <span style={{ fontWeight: 'var(--weight-semibold)' }}>Total:</span>
                <span style={{ fontSize: 'var(--text-h3)', fontWeight: 'var(--weight-bold)' }}>
                  ${
                    tienePaquetes
                      ? planes.find(p => p.id === planSeleccionado)?.precio || servicio?.precio || '0'
                      : servicio?.precio || '0'
                  }
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Action Bar */}
      <ActionBar
        summary={resumenPaso[paso]}
        action={
          <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
            <Button variant="ghost" onClick={handleAnterior}>
              Atrás
            </Button>
            <Button
              variant="primary"
              onClick={handleProximo}
              disabled={botonDeshabilitado[paso]}
            >
              {paso === 2 ? 'Confirmar' : 'Siguiente'}
            </Button>
          </div>
        }
        gutter="var(--gutter-movil)"
      />
    </div>
  )
}
