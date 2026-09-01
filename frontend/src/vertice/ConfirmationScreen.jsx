import React from 'react'
import { Button } from '../design-system'

export function ConfirmationScreen({ codigoReserva = 'RES-2026-0001', onClose }) {
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
        textAlign: 'center',
      }}
    >
      <div
        style={{
          animation: 'riseIn var(--dur-enter) var(--ease-out)',
          maxWidth: 500,
        }}
      >
        {/* Icono de éxito */}
        <div
          style={{
            fontSize: 60,
            marginBottom: 'var(--space-6)',
          }}
        >
          ✓
        </div>

        {/* Título */}
        <h1
          style={{
            fontSize: 'var(--text-display-sm)',
            fontWeight: 'var(--weight-bold)',
            margin: '0 0 var(--space-3) 0',
            color: 'var(--color-text)',
            letterSpacing: 'var(--track-display)',
          }}
        >
          Lugar asegurado
        </h1>

        {/* Descripción */}
        <p
          style={{
            fontSize: 'var(--text-body)',
            color: 'var(--color-text-muted)',
            margin: '0 0 var(--space-8) 0',
            lineHeight: 'var(--leading-normal)',
          }}
        >
          Tu reserva ha sido confirmada. Recibirás un correo de confirmación en los próximos minutos.
        </p>

        {/* Código de reserva */}
        <div
          style={{
            border: 'var(--border-hairline)',
            borderRadius: 'var(--radius-xl)',
            padding: 'var(--space-6)',
            backgroundColor: 'var(--color-surface)',
            marginBottom: 'var(--space-8)',
          }}
        >
          <div
            style={{
              fontSize: 'var(--text-caption)',
              color: 'var(--color-text-muted)',
              textTransform: 'uppercase',
              letterSpacing: 'var(--track-eyebrow)',
              marginBottom: 'var(--space-2)',
            }}
          >
            Código de reserva
          </div>
          <div
            style={{
              fontFamily: 'monospace',
              fontSize: 'var(--text-h2)',
              fontWeight: 'var(--weight-bold)',
              fontVariantNumeric: 'tabular-nums',
              color: 'var(--color-accent)',
              wordBreak: 'break-all',
            }}
          >
            {codigoReserva}
          </div>
        </div>

        {/* Acciones */}
        <div
          style={{
            display: 'flex',
            gap: 'var(--space-4)',
            flexDirection: 'column',
          }}
        >
          <Button variant="ghost" onClick={onClose} block>
            Ir a mis reservas
          </Button>
          <Button variant="ghost" onClick={onClose} block>
            Volver al inicio
          </Button>
        </div>
      </div>
    </div>
  )
}
