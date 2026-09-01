import React from 'react'
import { Badge } from './Badge'

export function SlotCard({
  rango,
  estado,
  disponible = true,
  selected = false,
  onClick,
  className,
  ...rest
}) {
  const [hover, setHover] = React.useState(false)
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!disponible}
      aria-pressed={selected}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        textAlign: 'left',
        padding: 'var(--space-5) var(--space-6)',
        minHeight: 64,
        borderRadius: 'var(--radius-xl)',
        outlineOffset: 2,
        cursor: disponible ? 'pointer' : 'not-allowed',
        background: selected ? 'var(--color-accent-100)' : hover && disponible ? 'var(--color-neutral-100)' : 'var(--color-surface)',
        border: `1px solid ${selected ? 'var(--color-accent)' : 'var(--color-border)'}`,
        color: 'var(--color-text)',
        opacity: disponible ? 1 : 0.5,
        fontFamily: 'var(--font-body)',
        transition: 'background var(--dur-fast) var(--ease-out)',
        width: '100%',
      }}
      className={className}
      {...rest}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 'var(--space-3)',
        }}
      >
        <span
          style={{
            fontSize: 'var(--text-title)',
            fontWeight: 'var(--weight-semibold)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {rango}
        </span>
        <Badge tone={disponible ? 'accent' : 'idle'}>{estado}</Badge>
      </div>
    </button>
  )
}
