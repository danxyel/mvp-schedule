import React from 'react'

export function Chip({ selected = false, onClick, children, className, ...rest }) {
  const [hover, setHover] = React.useState(false)
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        flex: 'none',
        height: 'var(--control-md)',
        padding: '0 var(--space-7)',
        borderRadius: 'var(--radius-pill)',
        fontFamily: 'var(--font-body)',
        fontSize: 'var(--text-meta)',
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        outlineOffset: 2,
        transition: 'background var(--dur-fast) var(--ease-out)',
        background: selected ? 'var(--color-accent)' : hover ? 'var(--color-accent-100)' : 'transparent',
        color: selected ? 'var(--color-text-invert)' : 'var(--color-text)',
        border: `1px solid ${selected ? 'var(--color-accent)' : 'var(--color-border-strong)'}`,
        fontWeight: selected ? 'var(--weight-semibold)' : 'var(--weight-regular)',
      }}
      className={className}
      {...rest}
    >
      {children}
    </button>
  )
}
