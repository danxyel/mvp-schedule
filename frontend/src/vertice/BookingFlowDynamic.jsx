import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import client from '../api/client'
import {
  Button,
  Stepper,
  ActionBar,
  Chip,
  ServiceRow,
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
  const [servicios, setServicios] = useState([])
  const [planes, setPlanes] = useState([])
  const [slots, setSlots] = useState([])

  // Estado de selección
  const [servicioSeleccionado, setServicioSeleccionado] = useState(servicioId || null)
  const [fechaSeleccionada, setFechaSeleccionada] = useState(null)
  const [horarioSeleccionado, setHorarioSeleccionado] = useState(null)
  const [planSeleccionado, setPlanSeleccionado] = useState(null)
  const [filtro, setFiltro] = useState('Todos')

  // Cargar datos del API
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        const { data: srvs, error: srvErr } = await client.GET(
          '/api/v2/{tenant_slug}/servicios',
          {
            params: { path: { tenant_slug: tenantSlug } },
          }
        )
        if (srvErr) throw srvErr
        setServicios(srvs || [])

        // Cargar planes - si el endpoint existe
        try {
          const { data: plns } = await client.GET(
            '/api/v2/{tenant_slug}/planes',
            {
              params: { path: { tenant_slug: tenantSlug } },
            }
          )
          setPlanes(plns || [])
        } catch {
          // Si no hay endpoint de planes, usar planes por defecto
          setPlanes([
            { id: 1, nombre: 'Sesión suelta', precio: 0, descripcion: 'Pago único' },
            { id: 2, nombre: 'Paquete de 5', precio: 0, descripcion: 'Ahorra' },
            { id: 3, nombre: 'Paquete de 10', precio: 0, descripcion: 'Ahorra más' },
          ])
        }

        setError(null)
      } catch (err) {
        setError(err.message || 'Error al cargar datos')
        console.error('Error cargando datos:', err)
      } finally {
        setLoading(false)
      }
    }

    if (tenantSlug) {
      fetchData()
    }
  }, [tenantSlug])

  // Cargar slots cuando se selecciona servicio y fecha
  useEffect(() => {
    const fetchSlots = async () => {
      if (!servicioSeleccionado || !fechaSeleccionada) return

      try {
        const fecha = fechaSeleccionada.toISOString().split('T')[0]
        const { data: slts } = await client.GET(
          `/api/v1/servicios/${servicioSeleccionado}/slots`,
          {
            params: { query: { fecha, tenant_slug: tenantSlug } },
          }
        )
        setSlots(slts || [])
      } catch (err) {
        console.error('Error cargando slots:', err)
      }
    }

    fetchSlots()
  }, [servicioSeleccionado, fechaSeleccionada, tenantSlug])

  const handlePasoSelect = (n) => {
    if (n <= paso) setPaso(n)
  }

  const handleProximo = async () => {
    if (paso === 1 && !servicioSeleccionado) return
    if (paso === 2 && !horarioSeleccionado) return
    if (paso === 3 && !planSeleccionado) return

    if (paso < 3) {
      setPaso(paso + 1)
    } else {
      // Crear reserva
      try {
        const slot = slots[horarioSeleccionado]

        const { data: reserva, error: reservaErr } = await client.POST(
          '/reservas',
          {
            body: {
              servicio_id: servicioSeleccionado,
              fecha_inicio: `${fechaSeleccionada.toISOString().split('T')[0]}T${slot.rango}`,
            },
          }
        )

        if (reservaErr) throw reservaErr

        navigate(
          `/t/${tenantSlug}/confirmar/${reserva.codigo_reserva}`,
          { state: { reserva } }
        )
      } catch (err) {
        setError(err.message || 'Error al crear reserva')
      }
    }
  }

  const handleAnterior = () => {
    if (paso > 1) setPaso(paso - 1)
  }

  const resumenPaso = {
    1: servicioSeleccionado
      ? servicios.find((s) => s.id === servicioSeleccionado)?.nombre
      : 'Elige un servicio',
    2: fechaSeleccionada
      ? `${fechaSeleccionada.getDate()}/${fechaSeleccionada.getMonth() + 1}`
      : 'Elige fecha y hora',
    3: planSeleccionado
      ? planes[planSeleccionado - 1]?.nombre
      : 'Elige un plan',
  }

  const botonDeshabilitado = {
    1: !servicioSeleccionado,
    2: !horarioSeleccionado,
    3: !planSeleccionado,
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <p style={{ fontSize: 'var(--text-body)' }}>Cargando...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ color: 'var(--color-warn)', fontSize: 'var(--text-body)' }}>Error: {error}</p>
          <Button variant="primary" onClick={() => window.location.reload()}>
            Reintentar
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
            marginBottom: 'var(--space-6)',
          }}
        >
          Reservar
        </h1>
        <Stepper
          steps={['Servicio', 'Fecha y hora', 'Pago']}
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
        {paso === 1 && (
          <div>
            <h2 style={{ fontSize: 'var(--text-h3)', margin: '0 0 var(--space-5) 0' }}>
              Elige un servicio
            </h2>

            {/* Filtro */}
            <div
              style={{
                display: 'flex',
                gap: 'var(--space-3)',
                marginBottom: 'var(--space-6)',
                overflowX: 'auto',
                paddingBottom: 'var(--space-2)',
              }}
            >
              {['Todos', 'Individual', 'Grupal'].map((f) => (
                <Chip
                  key={f}
                  selected={filtro === f}
                  onClick={() => setFiltro(f)}
                >
                  {f}
                </Chip>
              ))}
            </div>

            {/* Listado de servicios */}
            <div>
              {servicios.length === 0 ? (
                <p style={{ color: 'var(--color-text-muted)' }}>
                  No hay servicios disponibles
                </p>
              ) : (
                servicios.map((s) => (
                  <ServiceRow
                    key={s.id}
                    id={s.id}
                    nombre={s.nombre}
                    desc={s.descripcion || ''}
                    precio={`$${s.precio}`}
                    tipo={s.tipo}
                    modalidad={s.modalidad}
                    duracion={`${s.duracion_minutos} min`}
                    ocupados={s.sesiones_confirmadas || 0}
                    cupo={s.cupo || 10}
                    tone="accent"
                    onClick={() => setServicioSeleccionado(s.id)}
                    style={{
                      opacity: servicioSeleccionado === s.id ? 1 : 0.7,
                      backgroundColor:
                        servicioSeleccionado === s.id ? 'var(--color-accent-100)' : 'transparent',
                      borderLeft:
                        servicioSeleccionado === s.id ? '3px solid var(--color-accent)' : 'none',
                      paddingLeft:
                        servicioSeleccionado === s.id ? 'var(--space-3)' : 'var(--space-5)',
                    }}
                  />
                ))
              )}
            </div>
          </div>
        )}

        {paso === 2 && (
          <div>
            <h2 style={{ fontSize: 'var(--text-h3)', margin: '0 0 var(--space-5) 0' }}>
              Elige fecha y hora
            </h2>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                gap: 'var(--space-6)',
              }}
            >
              {/* Calendario */}
              <div>
                <CalendarMonth
                  month={new Date()}
                  selected={fechaSeleccionada}
                  minDate={new Date()}
                  onSelect={setFechaSeleccionada}
                  availability={(d) => Math.floor(Math.random() * 3)}
                  footer="Elige una fecha para ver horarios disponibles"
                />
              </div>

              {/* Horarios */}
              <div>
                <h3
                  style={{
                    fontSize: 'var(--text-title)',
                    margin: '0 0 var(--space-4) 0',
                  }}
                >
                  Horarios disponibles
                </h3>
                {slots.length === 0 ? (
                  <p style={{ color: 'var(--color-text-muted)' }}>
                    Selecciona una fecha para ver horarios
                  </p>
                ) : (
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                      gap: 'var(--space-3)',
                    }}
                  >
                    {slots.map((slot, idx) => (
                      <SlotCard
                        key={idx}
                        rango={slot.rango || slot.hora}
                        estado={slot.estado || 'Disponible'}
                        disponible={slot.disponible !== false}
                        selected={horarioSeleccionado === idx}
                        onClick={() => setHorarioSeleccionado(idx)}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {paso === 3 && (
          <div>
            <h2 style={{ fontSize: 'var(--text-h3)', margin: '0 0 var(--space-5) 0' }}>
              Elige tu plan
            </h2>

            <div style={{ marginBottom: 'var(--space-6)' }}>
              {planes.length === 0 ? (
                <p style={{ color: 'var(--color-text-muted)' }}>No hay planes disponibles</p>
              ) : (
                planes.map((plan, idx) => (
                  <PlanCard
                    key={idx}
                    nombre={plan.nombre}
                    precio={`$${plan.precio}`}
                    nota={plan.descripcion || ''}
                    selected={planSeleccionado === idx + 1}
                    onClick={() => setPlanSeleccionado(idx + 1)}
                  />
                ))
              )}
            </div>

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
                <span style={{ fontWeight: 'var(--weight-semibold)' }}>
                  {servicios.find((s) => s.id === servicioSeleccionado)?.nombre}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
                <span>Fecha y hora:</span>
                <span style={{ fontWeight: 'var(--weight-semibold)' }}>
                  {fechaSeleccionada && horarioSeleccionado !== null
                    ? `${fechaSeleccionada.getDate()}/${fechaSeleccionada.getMonth() + 1} a las ${slots[horarioSeleccionado]?.rango}`
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
                  ${planes[planSeleccionado - 1]?.precio || '0'}
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
            <Button variant="ghost" onClick={handleAnterior} disabled={paso === 1}>
              Atrás
            </Button>
            <Button
              variant="primary"
              onClick={handleProximo}
              disabled={botonDeshabilitado[paso]}
            >
              {paso === 3 ? 'Confirmar' : 'Siguiente'}
            </Button>
          </div>
        }
        gutter="var(--gutter-movil)"
      />
    </div>
  )
}
