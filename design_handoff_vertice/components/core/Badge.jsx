import React from 'react';

const TONES = {
  accent:   ['var(--color-accent-100)',   'var(--color-accent-700)',   'var(--color-accent-300)'],
  positive: ['var(--state-positive-fill)','var(--state-positive-ink)', 'var(--state-positive-border)'],
  warn:     ['var(--state-warn-fill)',    'var(--state-warn-ink)',     'var(--state-warn-border)'],
  idle:     ['var(--state-idle-fill)',    'var(--state-idle-ink)',     'var(--state-idle-border)'],
};

export function Badge({ tone = 'idle', children, style, ...rest }) {
  const [bg, fg, bd] = TONES[tone] || TONES.idle;
  return (
    <span style={{
      display: 'inline-block', flex: 'none', padding: 'var(--space-1) var(--space-4)',
      borderRadius: 'var(--radius-pill)',
      fontSize: 'var(--text-eyebrow)', fontWeight: 'var(--weight-semibold)',
      letterSpacing: 'var(--track-badge)', textTransform: 'uppercase',
      whiteSpace: 'nowrap', background: bg, color: fg, border: `1px solid ${bd}`, ...style,
    }} {...rest}>{children}</span>
  );
}
