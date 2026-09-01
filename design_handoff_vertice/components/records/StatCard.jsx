import React from 'react';

export function StatCard({ label, value, nota, style, ...rest }) {
  return (
    <div style={{
      border: 'var(--border-hairline)', borderRadius: 'var(--radius-2xl)',
      padding: 'var(--space-8) var(--space-9)', background: 'var(--color-surface)', ...style,
    }} {...rest}>
      <div style={{ fontSize: 'var(--text-eyebrow)', letterSpacing: 'var(--track-eyebrow)', textTransform: 'uppercase', fontWeight: 'var(--weight-semibold)', color: 'var(--color-text-muted)' }}>{label}</div>
      <div style={{ fontFamily: 'var(--font-heading)', fontSize: 34, fontWeight: 'var(--weight-bold)', marginTop: 'var(--space-3)', fontVariantNumeric: 'tabular-nums' }}>{value}</div>
      {nota ? <div style={{ fontSize: 'var(--text-meta)', color: 'var(--color-text-muted)', marginTop: 'var(--space-2)' }}>{nota}</div> : null}
    </div>
  );
}
