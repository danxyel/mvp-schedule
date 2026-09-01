import React from 'react';
import { Chip } from '../../components/core/Chip.jsx';
import { Stepper } from '../../components/navigation/Stepper.jsx';
import { ServiceRow } from '../../components/booking/ServiceRow.jsx';

export function CatalogScreen({ modo, servicios, filtro, onFiltro, onAbrir, paso, onPaso }) {
  const movil = modo === 'movil';
  const visibles = servicios.filter((s) => filtro === 'Todos' || s.tipo === filtro);

  return (
    <div style={{ padding: movil ? 'var(--space-7) var(--gutter-movil) var(--space-10)' : 'var(--space-10) var(--gutter-escritorio) var(--space-11)', maxWidth: 'var(--width-content)', width: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
        <h1 style={{ margin: 0, fontFamily: 'var(--font-heading)', fontSize: movil ? 'var(--text-h1-sm)' : 'var(--text-h1)', fontWeight: 'var(--weight-bold)', letterSpacing: 'var(--track-h1)' }}>Reservar</h1>
        <span style={{ marginLeft: 'auto', whiteSpace: 'nowrap', fontSize: 'var(--text-caption)', color: 'var(--color-text-muted)', fontVariantNumeric: 'tabular-nums' }}>Paso {paso} de 3</span>
      </div>
      <Stepper steps={['Servicio', 'Fecha y hora', 'Pago']} current={paso} onSelect={onPaso} style={{ marginTop: 'var(--space-5)' }} />

      <div style={movil
        ? { display: 'flex', gap: 'var(--space-3)', marginTop: 'var(--space-8)', overflowX: 'auto', paddingBottom: 2 }
        : { display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', marginTop: 'var(--space-9)', alignItems: 'center' }}>
        {['Todos', 'Individual', 'Grupal', 'Recurrente'].map((f) => (
          <Chip key={f} selected={f === filtro} onClick={() => onFiltro(f)}>{f}</Chip>
        ))}
        <span style={{ marginLeft: 'auto', alignSelf: 'center', whiteSpace: 'nowrap', fontSize: 'var(--text-caption)', color: 'var(--color-text-muted)', fontVariantNumeric: 'tabular-nums' }}>
          {visibles.length} de {servicios.length}
        </span>
      </div>

      <div style={movil
        ? { display: 'grid', gridTemplateColumns: '1fr', marginTop: 'var(--space-2)' }
        : { display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(320px,1fr))', gap: '0 28px', marginTop: 'var(--space-2)' }}>
        {visibles.map((s) => (
          <ServiceRow key={s.id} nombre={s.nombre} desc={s.desc} precio={s.precio}
            tipo={s.tipo} modalidad={s.modalidad} duracion={`${s.dur} min`}
            ocupados={s.ocupados} cupo={s.cupo} tone={s.tone}
            onClick={() => onAbrir(s.id)} />
        ))}
      </div>
    </div>
  );
}
