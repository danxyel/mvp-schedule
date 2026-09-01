import React from 'react';

export function MovementRow({ fecha, concepto, importe, style, ...rest }) {
  const negativo = typeof importe === 'string' && importe.trim().startsWith('-');
  return (
    <div style={{
      display: 'flex', alignItems: 'baseline', gap: 'var(--space-5)',
      padding: 'var(--space-5) 0', borderTop: 'var(--border-hairline)', ...style,
    }} {...rest}>
      <span style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text-muted)', width: 80, flex: 'none', fontVariantNumeric: 'tabular-nums' }}>{fecha}</span>
      <span style={{ flex: 1, minWidth: 0, fontSize: 'var(--text-body-sm)' }}>{concepto}</span>
      <span style={{
        fontSize: 'var(--text-body-sm)', fontWeight: 'var(--weight-semibold)',
        fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap',
        color: negativo ? 'var(--color-accent-2-800)' : 'var(--color-text)',
      }}>{importe}</span>
    </div>
  );
}
