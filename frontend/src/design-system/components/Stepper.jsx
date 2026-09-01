import React from 'react'

export function Stepper({ steps = [], current = 1, onSelect, className, ...rest }) {
  return (
    <div
      style={{
        display: 'flex',
        gap: 'var(--space-2)',
      }}
      className={className}
      {...rest}
    >
      {steps.map((label, i) => {
        const n = i + 1
        const alcanzado = n <= current
        const activo = n === current
        return (
          <button
            key={label}
            type="button"
            disabled={!alcanzado}
            onClick={() => alcanzado && onSelect && onSelect(n)}
            style={{
              flex: 1,
              padding: 'var(--space-3) var(--space-4)',
              border: 'none',
              borderTop: `2px solid ${alcanzado ? 'var(--color-accent)' : 'var(--color-border-strong)'}`,
              background: 'none',
              textAlign: 'left',
              outlineOffset: 2,
              cursor: alcanzado ? 'pointer' : 'default',
              fontFamily: 'var(--font-body)',
              color: activo ? 'var(--color-text)' : 'var(--color-text-muted)',
              transition: 'color var(--dur-fast) var(--ease-out)',
            }}
          >
            <span
              style={{
                display: 'block',
                fontSize: 'var(--text-eyebrow)',
                letterSpacing: '.14em',
                textTransform: 'uppercase',
                opacity: 0.7,
              }}
            >
              {String(n).padStart(2, '0')}
            </span>
            <span
              style={{
                display: 'block',
                fontSize: 'var(--text-meta)',
                fontWeight: 'var(--weight-semibold)',
                marginTop: 3,
              }}
            >
              {label}
            </span>
          </button>
        )
      })}
    </div>
  )
}
