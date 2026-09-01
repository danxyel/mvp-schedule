import React, { useState } from 'react'
import { BookingRow, Button, Badge } from '../design-system'

export function MyReservations() {
  const [reservas] = useState([
    {
      id: 1,
      hora: '10:00',
      dia: 'Hoy',
      titulo: 'Sesión Individual',
      lugar: 'Online',
      estado: 'Confirmada',
      tone: 'positive',
      codigo: 'RES-2026-001',
    },
    {
      id: 2,
      hora: '14:30',
      dia: 'Mañana',
      titulo: 'Clase Grupal',
      lugar: 'Presencial · Sala A',
      estado: 'Confirmada',
      tone: 'positive',
      codigo: 'RES-2026-002',
    },
    {
      id: 3,
      hora: '15:00',
      dia: '3 sept',
      titulo: 'Consultoría',
      lugar: 'Online',
      estado: 'En espera de pago',
      tone: 'warn',
      codigo: 'RES-2026-003',
    },
    {
      id: 4,
      hora: '09:00',
      dia: '25 ago',
      titulo: 'Sesión Individual',
      lugar: 'Online',
      estado: 'Completada',
      tone: 'idle',
      codigo: 'RES-2026-004',
    },
  ])

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: 'var(--color-bg)',
      }}
    >
      {/* Header */}
      <div
        style={{
          backgroundColor: 'var(--color-surface)',
          borderBottom: 'var(--border-hairline)',
          padding: 'var(--gutter-movil)',
        }}
      >
        <h1
          style={{
            fontSize: 'var(--text-h1-sm)',
            fontWeight: 'var(--weight-semibold)',
            margin: 0,
            letterSpacing: 'var(--track-h1)',
          }}
        >
          Mis reservas
        </h1>
      </div>

      {/* Contenido */}
      <div
        style={{
          maxWidth: 'var(--width-content)',
          width: '100%',
          margin: '0 auto',
          padding: 'var(--gutter-movil)',
        }}
      >
        {reservas.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              padding: 'var(--space-12) var(--gutter-movil)',
              color: 'var(--color-text-muted)',
            }}
          >
            <p style={{ fontSize: 'var(--text-body)', margin: 0 }}>
              No tienes reservas aún.
            </p>
            <Button variant="primary" style={{ marginTop: 'var(--space-6)' }}>
              Hacer una reserva
            </Button>
          </div>
        ) : (
          <div>
            {/* Filtros */}
            <div
              style={{
                display: 'flex',
                gap: 'var(--space-3)',
                marginBottom: 'var(--space-6)',
                flexWrap: 'wrap',
              }}
            >
              {['Todas', 'Próximas', 'Pasadas'].map((filtro) => (
                <button
                  key={filtro}
                  type="button"
                  style={{
                    padding: 'var(--space-2) var(--space-4)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-pill)',
                    backgroundColor: 'transparent',
                    cursor: 'pointer',
                    fontSize: 'var(--text-body-sm)',
                    fontFamily: 'var(--font-body)',
                    color: 'var(--color-text)',
                  }}
                >
                  {filtro}
                </button>
              ))}
            </div>

            {/* Listado */}
            <div
              style={{
                border: 'var(--border-hairline)',
                borderRadius: 'var(--radius-2xl)',
                backgroundColor: 'var(--color-surface)',
                overflow: 'hidden',
              }}
            >
              {reservas.map((r, idx) => (
                <div
                  key={r.id}
                  style={{
                    padding: 'var(--gutter-movil)',
                    borderBottom: idx < reservas.length - 1 ? 'var(--border-hairline)' : 'none',
                    cursor: 'pointer',
                    transition: 'background var(--dur-fast) var(--ease-out)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--color-neutral-100)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent'
                  }}
                >
                  <BookingRow {...r} />
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--space-4)',
                      marginTop: 'var(--space-3)',
                      fontSize: 'var(--text-caption)',
                      color: 'var(--color-text-muted)',
                    }}
                  >
                    <span>{r.codigo}</span>
                    <button
                      type="button"
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--color-accent)',
                        cursor: 'pointer',
                        fontSize: 'var(--text-caption)',
                        padding: 0,
                      }}
                    >
                      Copiar código
                    </button>
                    <span style={{ marginLeft: 'auto' }}>
                      <button
                        type="button"
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--color-accent)',
                          cursor: 'pointer',
                          fontSize: 'var(--text-body-sm)',
                          padding: 0,
                        }}
                      >
                        Ver detalles →
                      </button>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
