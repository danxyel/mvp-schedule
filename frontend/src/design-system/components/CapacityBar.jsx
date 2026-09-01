import React from 'react'

export function CapacityBar({ libre = 0, cupo = 1, className, ...rest }) {
  const ocupacion = cupo > 0 ? 1 - (libre / cupo) : 0

  if (cupo <= 1) {
    return (
      <span
        style={{
          fontSize: 'var(--text-meta)',
          color: 'var(--color-text-muted)',
          fontWeight: 'var(--weight-regular)',
        }}
        className={className}
        {...rest}
      >
        Agenda abierta
      </span>
    )
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-2)',
      }}
      className={className}
      {...rest}
    >
      <div
        style={{
          flex: 1,
          height: 'var(--space-3)',
          borderRadius: 'var(--radius-pill)',
          backgroundColor: 'var(--color-border)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${ocupacion * 100}%`,
            backgroundColor: ocupacion > 0.8 ? 'var(--color-warn)' : 'var(--color-accent-2)',
            transition: 'width var(--dur-normal) var(--ease-out)',
          }}
        />
      </div>
      <span
        style={{
          fontSize: 'var(--text-caption)',
          color: 'var(--color-text-muted)',
          fontWeight: 'var(--weight-medium)',
          flex: 'none',
        }}
      >
        {libre}/{cupo}
      </span>
    </div>
  )
}
