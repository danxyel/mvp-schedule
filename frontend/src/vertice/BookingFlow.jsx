import React, { useState } from 'react'
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

export function BookingFlow({ onComplete }) {
  const [paso, setPaso] = useState(1)
  const [servicioSeleccionado, setServicioSeleccionado] = useState(null)
  const [fechaSeleccionada, setFechaSeleccionada] = useState(null)
  const [horarioSeleccionado, setHorarioSeleccionado] = useState(null)
  const [planSeleccionado, setPlanSeleccionado] = useState(null)
  const [filtro, setFiltro] = useState('Todos')

  // Mock data
  const servicios = [
    {
      id: 1,
      nombre: 'Sesión Individual',
      desc: 'Sesión 1:1 personalizada',
      precio: '$150',
      tipo: 'Individual',
      modalidad: 'Online',
      duracion: '50 min',
      ocupados: 2,
      cupo: 4,
      tone: 'accent',
    },
    {
      id: 2,
      nombre: 'Clase Grupal',
      desc: 'Clase completa con grupo',
      precio: '$50',
      tipo: 'Grupal',
      modalidad: 'Presencial',
      duracion: '60 min',
      ocupados: 8,
      cupo: 12,
      tone: 'accent2',
    },
  ]

  const slots = [
    { rango: '09:00', estado: 'Disponible', disponible: true },
    { rango: '10:00', estado: 'Disponible', disponible: true },
    { rango: '11:00', estado: 'Lleno', disponible: false },
    { rango: '14:00', estado: 'Disponible', disponible: true },
  ]

  const planes = [
    { nombre: 'Sesión suelta', precio: '$150', nota: 'Pago único' },
    { nombre: 'Paquete de 5', precio: '$675', nota: 'Ahorra $75' },
    { nombre: 'Paquete de 10', precio: '$1,275', nota: 'Ahorra $225' },
  ]

  const handlePasoSelect = (n) => {
    if (n <= paso) setPaso(n)
  }

  const handleProximo = () => {
    if (paso === 1 && !servicioSeleccionado) return
    if (paso === 2 && !horarioSeleccionado) return
    if (paso === 3 && !planSeleccionado) return
    if (paso < 3) setPaso(paso + 1)
    else if (onComplete) onComplete({ servicioSeleccionado, fechaSeleccionada, horarioSeleccionado, planSeleccionado })
  }

  const handleAnterior = () => {
    if (paso > 1) setPaso(paso - 1)
  }

  const resumenPaso = {
    1: servicioSeleccionado ? servicios.find(s => s.id === servicioSeleccionado)?.nombre : 'Elige un servicio',
    2: fechaSeleccionada ? `${fechaSeleccionada.getDate()}/${fechaSeleccionada.getMonth() + 1}` : 'Elige fecha y hora',
    3: planSeleccionado ? planes[planSeleccionado - 1]?.nombre : 'Elige un plan',
  }

  const botonDeshabilitado = {
    1: !servicioSeleccionado,
    2: !horarioSeleccionado,
    3: !planSeleccionado,
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
              {servicios.map((s) => (
                <ServiceRow
                  key={s.id}
                  {...s}
                  onClick={() => setServicioSeleccionado(s.id)}
                  style={{
                    opacity: servicioSeleccionado === s.id ? 1 : 0.7,
                    backgroundColor:
                      servicioSeleccionado === s.id ? 'var(--color-accent-100)' : 'transparent',
                    borderLeft: servicioSeleccionado === s.id ? '3px solid var(--color-accent)' : 'none',
                    paddingLeft: servicioSeleccionado === s.id ? 'var(--space-3)' : 'var(--space-5)',
                  }}
                />
              ))}
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
                      {...slot}
                      selected={horarioSeleccionado === idx}
                      onClick={() => setHorarioSeleccionado(idx)}
                    />
                  ))}
                </div>
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
              {planes.map((plan, idx) => (
                <PlanCard
                  key={idx}
                  {...plan}
                  selected={planSeleccionado === idx + 1}
                  onClick={() => setPlanSeleccionado(idx + 1)}
                />
              ))}
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
                  {servicios.find(s => s.id === servicioSeleccionado)?.nombre}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
                <span>Fecha y hora:</span>
                <span style={{ fontWeight: 'var(--weight-semibold)' }}>
                  {fechaSeleccionada && horarioSeleccionado !== null
                    ? `${fechaSeleccionada.getDate()}/${fechaSeleccionada.getMonth() + 1} a las ${slots[horarioSeleccionado].rango}`
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
                  {planes[planSeleccionado - 1]?.precio}
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
