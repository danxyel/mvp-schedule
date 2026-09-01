import React from 'react';
import { StepArrow } from '../navigation/StepArrow.jsx';

const DOW = ['Lu','Ma','Mi','Ju','Vi','Sá','Do'];
const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);
const key = (d) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

export function CalendarMonth({
  month, selected, minDate, onSelect, onMonthChange, availability, footer, style,
}) {
  const mes = month || new Date();
  const primero = new Date(mes.getFullYear(), mes.getMonth(), 1);
  const offset = (primero.getDay() + 6) % 7;
  const dias = new Date(mes.getFullYear(), mes.getMonth() + 1, 0).getDate();
  const tope = minDate || null;

  const celdas = [];
  for (let i = 0; i < offset; i++) celdas.push(null);
  for (let d = 1; d <= dias; d++) celdas.push(new Date(mes.getFullYear(), mes.getMonth(), d));

  const puedeAtras = !tope || mes.getFullYear() > tope.getFullYear() ||
    (mes.getFullYear() === tope.getFullYear() && mes.getMonth() > tope.getMonth());
  const salta = (n) => onMonthChange && onMonthChange(new Date(mes.getFullYear(), mes.getMonth() + n, 1));

  return (
    <div style={style}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-3)' }}>
        <StepArrow direction="prev" disabled={!puedeAtras} onClick={() => salta(-1)} label="Mes anterior" />
        <div style={{ fontFamily: 'var(--font-heading)', fontSize: 'var(--text-h3)', fontWeight: 'var(--weight-semibold)' }}>
          {cap(new Intl.DateTimeFormat('es-MX', { month: 'long', year: 'numeric' }).format(mes))}
        </div>
        <StepArrow direction="next" onClick={() => salta(1)} label="Mes siguiente" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 3, marginTop: 'var(--space-5)' }}>
        {DOW.map((w) => (
          <div key={w} style={{ textAlign: 'center', fontSize: 'var(--text-eyebrow)', letterSpacing: '.14em', textTransform: 'uppercase', fontWeight: 'var(--weight-semibold)', color: 'var(--color-text-muted)', paddingBottom: 'var(--space-1)' }}>{w}</div>
        ))}
        {celdas.map((d, i) => {
          if (!d) return <span key={`v${i}`} style={{ height: 42 }} />;
          const pasado = tope && d < tope;
          const activo = selected && key(d) === key(selected);
          const libres = pasado ? 0 : (availability ? availability(d) : 0);
          return (
            <button key={key(d)} type="button" disabled={pasado}
              onClick={() => onSelect && onSelect(d)}
              aria-current={activo ? 'date' : undefined}
              style={{
                position: 'relative', height: 42, borderRadius: 'var(--radius-lg)',
                cursor: pasado ? 'not-allowed' : 'pointer', outlineOffset: 2,
                fontFamily: 'var(--font-body)', fontSize: 'var(--text-body-sm)',
                fontVariantNumeric: 'tabular-nums',
                background: activo ? 'var(--color-text)' : 'transparent',
                color: activo ? 'var(--color-bg)' : pasado ? 'var(--color-text-subtle)' : 'var(--color-text)',
                border: `1px solid ${activo ? 'var(--color-text)' : pasado ? 'transparent' : 'var(--color-border)'}`,
                fontWeight: activo ? 'var(--weight-semibold)' : 'var(--weight-regular)',
              }}>
              {d.getDate()}
              {libres > 0 ? (
                <span style={{
                  position: 'absolute', left: '50%', bottom: 4, transform: 'translateX(-50%)',
                  width: Math.min(libres, 4) * 4, height: 2,
                  background: activo ? 'var(--color-bg)' : 'var(--color-accent)',
                }} />
              ) : null}
            </button>
          );
        })}
      </div>

      {footer ? (
        <div style={{ marginTop: 'var(--space-6)', paddingTop: 'var(--space-5)', borderTop: 'var(--border-hairline)', fontSize: 'var(--text-meta)', lineHeight: 'var(--leading-snug)', color: 'var(--color-text-muted)' }}>{footer}</div>
      ) : null}
    </div>
  );
}
