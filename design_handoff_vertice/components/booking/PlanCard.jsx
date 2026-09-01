import React from 'react';

export function PlanCard({ nombre, precio, nota, selected = false, onClick, style, ...rest }) {
  const [hover, setHover] = React.useState(false);
  return (
    <button type="button" onClick={onClick} aria-pressed={selected}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        display: 'block', width: '100%', textAlign: 'left',
        padding: 'var(--space-7) var(--space-8)', marginBottom: 'var(--space-4)',
        borderRadius: 'var(--radius-xl)', cursor: 'pointer', outlineOffset: 2,
        fontFamily: 'var(--font-body)', color: 'var(--color-text)',
        background: selected ? 'var(--color-accent-100)' : hover ? 'var(--color-neutral-100)' : 'var(--color-surface)',
        border: `1px solid ${selected ? 'var(--color-accent)' : 'var(--color-border)'}`,
        transition: 'background var(--dur-fast) var(--ease-out)', ...style,
      }} {...rest}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 'var(--space-5)' }}>
        <span style={{ fontFamily: 'var(--font-heading)', fontSize: 'var(--text-h3)', fontWeight: 'var(--weight-semibold)' }}>{nombre}</span>
        <span style={{ fontSize: 'var(--text-h3)', fontWeight: 'var(--weight-semibold)', fontVariantNumeric: 'tabular-nums' }}>{precio}</span>
      </div>
      {nota ? <div style={{ fontSize: 'var(--text-meta)', color: 'var(--color-text-muted)', marginTop: 'var(--space-2)' }}>{nota}</div> : null}
    </button>
  );
}
