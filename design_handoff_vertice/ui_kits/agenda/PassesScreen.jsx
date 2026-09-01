import React from 'react';
import { StatCard } from '../../components/records/StatCard.jsx';
import { MovementRow } from '../../components/records/MovementRow.jsx';

export function PassesScreen({ modo, bono }) {
  const movil = modo === 'movil';
  return (
    <div style={{ padding: movil ? 'var(--space-7) var(--gutter-movil) var(--space-10)' : 'var(--space-10) var(--gutter-escritorio) var(--space-11)', maxWidth: 'var(--width-content)', width: '100%' }}>
      <h1 style={{ margin: 0, fontFamily: 'var(--font-heading)', fontSize: movil ? 'var(--text-h1-sm)' : 'var(--text-h1)', fontWeight: 'var(--weight-bold)', letterSpacing: 'var(--track-h1)' }}>Bonos y pagos</h1>
      <p style={{ margin: 'var(--space-3) 0 var(--space-7)', fontSize: 'var(--text-body)', color: 'var(--color-text-muted)' }}>
        Saldo, vigencia y movimientos de tus paquetes.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 'var(--space-5)' }}>
        <StatCard label="Saldo disponible" value={`${bono} clases`} nota="Academia Vértice · vence el 30 nov" />
        <StatCard label="Gasto del mes" value="$2,160" nota="3 sesiones y 1 paquete" />
      </div>
      <div style={{ marginTop: 'var(--space-9)' }}>
        <div style={{ fontSize: 'var(--text-eyebrow)', letterSpacing: 'var(--track-eyebrow)', textTransform: 'uppercase', fontWeight: 'var(--weight-semibold)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-2)' }}>Movimientos</div>
        <MovementRow fecha="12 ago" concepto="Paquete de 10 · Matemáticas" importe="$2,720" />
        <MovementRow fecha="08 ago" concepto="Sesión suelta · Fisioterapia" importe="$850" />
        <MovementRow fecha="28 jul" concepto="Reembolso · clase cancelada" importe="- $320" />
      </div>
    </div>
  );
}
