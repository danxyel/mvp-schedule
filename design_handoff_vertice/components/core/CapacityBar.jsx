import React from 'react';

const TINT = {
  accent: 'var(--color-accent)',
  accent2: 'var(--color-accent-2)',
  neutral: 'var(--color-neutral-500)',
};

export function CapacityBar({ ocupados = 0, cupo = 1, tone = 'accent', showCount = true, style }) {
  const ilimitado = cupo <= 1;
  const pct = ilimitado ? 0 : Math.min(100, Math.round((ocupados / cupo) * 100));
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', minWidth: 0, ...style }}>
      <span style={{
        flex: 1, minWidth: 50, maxWidth: 110, height: 6,
        borderRadius: 'var(--radius-pill)', background: 'var(--color-neutral-300)',
        display: 'block', overflow: 'hidden',
      }}>
        <span style={{ display: 'block', height: '100%', width: `${pct}%`, background: TINT[tone] || TINT.accent }} />
      </span>
      {showCount ? (
        <span style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text-muted)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
          {ilimitado ? 'Agenda abierta' : `${ocupados}/${cupo}`}
        </span>
      ) : null}
    </span>
  );
}
