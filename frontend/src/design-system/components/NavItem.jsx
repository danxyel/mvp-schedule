import React from 'react'

export function NavItem({ mode = 'sidebar', icon, label, badge, active = false, onClick, className, ...rest }) {
  const [hover, setHover] = React.useState(false)
  const bar = mode === 'bar'
  const rail = mode === 'rail'

  const base = {
    display: 'flex',
    alignItems: 'center',
    cursor: 'pointer',
    fontFamily: 'var(--font-body)',
    border: 'none',
    outlineOffset: 2,
    background: 'transparent',
    transition: 'background var(--dur-fast) var(--ease-out)',
  }

  const skin = bar
    ? {
        flex: 1,
        minHeight: 'var(--touch-nav)',
        flexDirection: 'column',
        justifyContent: 'center',
        gap: 'var(--space-1)',
        color: active ? 'var(--color-accent-700)' : 'var(--color-text-muted)',
      }
    : {
        width: '100%',
        minHeight: rail ? 56 : 40,
        borderRadius: 'var(--radius-lg)',
        padding: rail ? '0 var(--space-1)' : '0 var(--space-4)',
        flexDirection: rail ? 'column' : 'row',
        justifyContent: rail ? 'center' : 'flex-start',
        gap: rail ? 'var(--space-1)' : 'var(--space-4)',
        textAlign: 'left',
        fontSize: 'var(--text-body-sm)',
        background: active ? 'var(--color-neutral-200)' : hover ? 'var(--color-neutral-100)' : 'transparent',
        color: active ? 'var(--color-text)' : 'var(--color-text-muted)',
        fontWeight: active ? 'var(--weight-semibold)' : 'var(--weight-regular)',
      }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{ ...base, ...skin }}
      className={className}
      {...rest}
    >
      <span style={{ fontSize: bar ? 15 : 16, lineHeight: 1 }}>{icon}</span>
      <span
        style={
          bar || rail
            ? { fontSize: 'var(--text-eyebrow)', letterSpacing: '.06em', textAlign: 'center' }
            : { flex: 1 }
        }
      >
        {label}
      </span>
      {badge && !bar && !rail ? (
        <span
          style={{
            fontSize: 'var(--text-caption)',
            color: 'var(--color-text-muted)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {badge}
        </span>
      ) : null}
    </button>
  )
}
