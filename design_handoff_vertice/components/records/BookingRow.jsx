import React from 'react';
import { Badge } from '../core/Badge.jsx';

export function BookingRow({ hora, dia, titulo, lugar, estado, tone = 'positive', style, ...rest }) {
  return (
    <div style={{
      display: 'flex', gap: 'var(--space-6)',
      padding: 'var(--space-7) 0', borderTop: 'var(--border-hairline)', ...style,
    }} {...rest}>
      <div style={{ width: 64, flex: 'none', fontVariantNumeric: 'tabular-nums' }}>
        <div style={{ fontFamily: 'var(--font-heading)', fontSize: 'var(--text-h3)', fontWeight: 'var(--weight-semibold)' }}>{hora}</div>
        <div style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text-muted)', marginTop: 'var(--space-1)' }}>{dia}</div>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: 'var(--font-heading)', fontSize: 'var(--text-title)', fontWeight: 'var(--weight-semibold)', letterSpacing: 'var(--track-title)' }}>{titulo}</div>
        {lugar ? <div style={{ fontSize: 'var(--text-meta)', color: 'var(--color-text-muted)', marginTop: 'var(--space-1)' }}>{lugar}</div> : null}
        <div style={{ marginTop: 'var(--space-3)' }}><Badge tone={tone}>{estado}</Badge></div>
      </div>
    </div>
  );
}
