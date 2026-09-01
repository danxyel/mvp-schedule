import React from 'react'

const SIZES = {
  sm: { height: 'var(--control-sm)', padding: '0 var(--space-6)', font: 'var(--text-caption)' },
  md: { height: 'var(--control-md)', padding: '0 var(--space-7)', font: 'var(--text-body-sm)' },
  lg: { height: 'var(--control-lg)', padding: '0 var(--space-9)', font: 'var(--text-body)' },
}

export function Button({
  variant = 'primary',
  size = 'md',
  block = false,
  disabled = false,
  icon,
  onClick,
  children,
  className,
  ...rest
}) {
  const [hover, setHover] = React.useState(false)
  const [down, setDown] = React.useState(false)
  const s = SIZES[size] || SIZES.md

  const skin = () => {
    if (variant === 'primary') {
      return {
        background: down ? 'var(--color-accent-700)' : hover ? 'var(--color-accent-600)' : 'var(--color-accent)',
        color: 'var(--color-text-invert)',
        border: '1px solid transparent',
        fontWeight: 'var(--weight-semibold)',
      }
    }
    if (variant === 'secondary') {
      return {
        background: down ? 'var(--color-accent-200)' : hover ? 'var(--color-accent-100)' : 'var(--color-surface)',
        color: 'var(--color-accent-700)',
        border: '1px solid var(--color-accent-300)',
        fontWeight: 'var(--weight-semibold)',
      }
    }
    return {
      background: down ? 'var(--color-neutral-300)' : hover ? 'var(--color-neutral-200)' : 'transparent',
      color: 'var(--color-text)',
      border: '1px solid transparent',
      fontWeight: 'var(--weight-medium)',
    }
  }

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => {
        setHover(false)
        setDown(false)
      }}
      onMouseDown={() => setDown(true)}
      onMouseUp={() => setDown(false)}
      style={{
        display: block ? 'flex' : 'inline-flex',
        width: block ? '100%' : 'auto',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 'var(--space-3)',
        height: s.height,
        padding: s.padding,
        fontSize: s.font,
        fontFamily: 'var(--font-body)',
        lineHeight: 1,
        borderRadius: 'var(--radius-pill)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        outlineOffset: 2,
        transition: 'background var(--dur-fast) var(--ease-out)',
        whiteSpace: 'nowrap',
        ...skin(),
      }}
      className={className}
      {...rest}
    >
      {icon ? <span style={{ fontSize: '1.1em', lineHeight: 1 }}>{icon}</span> : null}
      {children}
    </button>
  )
}
