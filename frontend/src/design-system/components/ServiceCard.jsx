import React from 'react'
import { Button } from './Button'
import { Badge } from './Badge'
import { CapacityBar } from './CapacityBar'

export function ServiceCard({
  nombre,
  descripcion,
  precio,
  tipo,
  modalidad,
  duracion,
  sesionesConfirmadas = 0,
  cupo = 10,
  onReservar,
}) {
  const getTipoBadge = () => {
    const tones = {
      individual: 'accent',
      grupal: 'accent2',
      recurrente: 'warn',
    }
    return tones[tipo] || 'accent'
  }

  const getModalidadIcon = () => {
    return modalidad === 'virtual' ? '💻' : '📍'
  }

  return (
    <div
      style={{
        border: 'var(--border-hairline)',
        borderRadius: 'var(--radius-2xl)',
        backgroundColor: 'var(--color-surface)',
        padding: 'var(--space-6)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-4)',
        transition: 'all var(--dur-fast) var(--ease-out)',
        cursor: 'pointer',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = 'var(--elevation-md)'
        e.currentTarget.style.transform = 'translateY(-2px)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = 'none'
        e.currentTarget.style.transform = 'translateY(0)'
      }}
    >
      {/* Header */}
      <div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'start',
            marginBottom: 'var(--space-2)',
            gap: 'var(--space-3)',
          }}
        >
          <h3
            style={{
              fontSize: 'var(--text-title)',
              fontWeight: 'var(--weight-semibold)',
              margin: 0,
              flex: 1,
            }}
          >
            {nombre}
          </h3>
          <Badge tone={getTipoBadge()}>{tipo}</Badge>
        </div>
        <p
          style={{
            fontSize: 'var(--text-body-sm)',
            color: 'var(--color-text-muted)',
            margin: 0,
            lineHeight: 'var(--leading-snug)',
          }}
        >
          {descripcion}
        </p>
      </div>

      {/* Metadatos */}
      <div
        style={{
          display: 'flex',
          gap: 'var(--space-4)',
          fontSize: 'var(--text-meta)',
          color: 'var(--color-text-muted)',
          flexWrap: 'wrap',
        }}
      >
        <span title="Duración">⏱️ {duracion} min</span>
        <span title="Modalidad">
          {getModalidadIcon()} {modalidad}
        </span>
      </div>

      {/* Capacidad */}
      <div>
        <p
          style={{
            fontSize: 'var(--text-caption)',
            color: 'var(--color-text-muted)',
            margin: '0 0 var(--space-2) 0',
            textTransform: 'uppercase',
            letterSpacing: 'var(--track-eyebrow)',
          }}
        >
          Disponibilidad
        </p>
        <CapacityBar libre={cupo - sesionesConfirmadas} cupo={cupo} />
      </div>

      {/* Precio y acción */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingTop: 'var(--space-4)',
          borderTop: 'var(--border-hairline)',
        }}
      >
        <div>
          <p
            style={{
              fontSize: 'var(--text-caption)',
              color: 'var(--color-text-muted)',
              margin: 0,
              textTransform: 'uppercase',
              letterSpacing: 'var(--track-eyebrow)',
            }}
          >
            Precio
          </p>
          <p
            style={{
              fontSize: 'var(--text-h3)',
              fontWeight: 'var(--weight-bold)',
              margin: 0,
              color: 'var(--color-accent)',
            }}
          >
            ${precio}
          </p>
        </div>
        <Button variant="primary" size="md" onClick={onReservar}>
          Agendar
        </Button>
      </div>
    </div>
  )
}
