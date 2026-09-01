import React from 'react'
import { Badge } from './Badge'
import { CapacityBar } from './CapacityBar'

const TINT = {
  accent: {
    base: 'var(--color-accent)',
    soft: 'var(--color-accent-100)',
    deep: 'var(--color-accent-700)',
    line: 'var(--color-accent-300)',
  },
  accent2: {
    base: 'var(--color-accent-2)',
    soft: 'var(--color-accent-2-100)',
    deep: 'var(--color-accent-2-800)',
    line: 'var(--color-accent-2-300)',
  },
  neutral: {
    base: 'var(--color-neutral-500)',
    soft: 'var(--color-neutral-200)',
    deep: 'var(--color-neutral-700)',
    line: 'var(--color-neutral-400)',
  },
}

export function ServiceRow({
  nombre,
  desc,
  precio,
  tipo = 'Grupal',
  modalidad,
  duracion,
  ocupados = 0,
  cupo = 1,
  tone = 'accent',
  onClick,
  className,
  ...rest
}) {
  const [hover, setHover] = React.useState(false)
  const c = TINT[tone] || TINT.accent
  const libre = cupo - ocupados

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: '100%',
        textAlign: 'left',
        background: hover ? 'var(--color-neutral-100)' : 'none',
        border: 'none',
        borderTop: 'var(--border-hairline)',
        padding: 'var(--space-6) var(--space-3) var(--space-6) 0',
        cursor: 'pointer',
        fontFamily: 'var(--font-body)',
        color: 'var(--color-text)',
        outlineOffset: 2,
        transition: 'background var(--dur-fast) var(--ease-out)',
      }}
      className={className}
      {...rest}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-4)' }}>
        <span
          style={{
            width: 9,
            height: 9,
            marginTop: 6,
            borderRadius: 'var(--radius-round)',
            flex: 'none',
            background: c.base,
          }}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              justifyContent: 'space-between',
              gap: 'var(--space-4)',
              flexWrap: 'wrap',
            }}
          >
            <span
              style={{
                fontFamily: 'var(--font-heading)',
                fontSize: 'var(--text-h3)',
                fontWeight: 'var(--weight-semibold)',
                letterSpacing: 'var(--track-title)',
              }}
            >
              {nombre}
            </span>
            <span
              style={{
                fontSize: 'var(--text-title)',
                fontWeight: 'var(--weight-semibold)',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {precio}
            </span>
          </div>
          {desc ? (
            <div
              style={{
                fontSize: 'var(--text-meta)',
                lineHeight: 'var(--leading-snug)',
                color: 'var(--color-text-muted)',
                marginTop: 'var(--space-1)',
              }}
            >
              {desc}
            </div>
          ) : null}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-4)',
              marginTop: 'var(--space-3)',
              flexWrap: 'wrap',
            }}
          >
            <Badge tone={tone === 'neutral' ? 'idle' : tone === 'accent2' ? 'positive' : 'accent'}>
              {tipo}
            </Badge>
            <span
              style={{
                whiteSpace: 'nowrap',
                fontSize: 'var(--text-caption)',
                color: 'var(--color-text-muted)',
              }}
            >
              {modalidad} · {duracion}
            </span>
            <CapacityBar libre={libre} cupo={cupo} />
          </div>
        </div>
      </div>
    </button>
  )
}
