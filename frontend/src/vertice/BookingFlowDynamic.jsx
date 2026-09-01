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

        if (disp?.sesiones) {
          setDisponibilidad(disp)
        } else {
          // Fallback: mock data si no hay respuesta
          setDisponibilidad({
            sesiones: [
              { rango: '09:00', estado: 'Disponible', disponible: true },
              { rango: '10:00', estado: 'Disponible', disponible: true },
              { rango: '11:00', estado: 'Lleno', disponible: false },
              { rango: '14:00', estado: 'Disponible', disponible: true },
              { rango: '15:00', estado: 'Disponible', disponible: true },
            ],
          })
        }
      } catch (err) {
        console.error('Error cargando disponibilidad:', err)
        // Mock data de fallback
        setDisponibilidad({
          sesiones: [
            { rango: '09:00', estado: 'Disponible', disponible: true },
            { rango: '10:00', estado: 'Disponible', disponible: true },
            { rango: '11:00', estado: 'Lleno', disponible: false },
            { rango: '14:00', estado: 'Disponible', disponible: true },
            { rango: '15:00', estado: 'Disponible', disponible: true },
          ],
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
    if (paso === 2 && tienePaquetes && !planSeleccionado) return

    if (paso < 2) {
      setPaso(paso + 1)
    } else {
      // Crear reserva
      try {
        const sesiones = disponibilidad.sesiones || []
        const slot = sesiones[horarioSeleccionado]

        // Construir fecha_hora_inicio correctamente
        const dateStr = fechaSeleccionada.toISOString().split('T')[0]
        const offset = -fechaSeleccionada.getTimezoneOffset()
        const hours = Math.floor(Math.abs(offset) / 60)
        const minutes = Math.abs(offset) % 60
        const sign = offset >= 0 ? '+' : '-'
        const tzOffset = `${sign}${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
        const fecha_hora_inicio = `${dateStr}T${slot.rango}:00${tzOffset}`

        const { data: reserva, error: reservaErr } = await client.POST(
          '/api/v2/{tenant_slug}/reservas',
          {
            params: {
              path: { tenant_slug: tenantSlug },
            },
            body: {
              servicio_id: parseInt(servicioId),
              fecha_hora_inicio,
            },
          }
        )

        if (reservaErr) throw reservaErr

        navigate(
          `/t/${tenantSlug}/confirmar/${reserva.codigo_confirmacion}`,
          { state: { reserva } }
        )
      } catch (err) {
        setError(err.message || 'Error al crear reserva')
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
    2: tienePaquetes ? !planSeleccionado : false,
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
