import React from 'react';
import { Button } from '../../components/core/Button.jsx';
import { Stepper } from '../../components/navigation/Stepper.jsx';
import { ActionBar } from '../../components/navigation/ActionBar.jsx';
import { CalendarMonth } from '../../components/booking/CalendarMonth.jsx';
import { SlotCard } from '../../components/booking/SlotCard.jsx';

const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);
const fmtFecha = (d) => cap(new Intl.DateTimeFormat('es-MX', { weekday: 'long', day: 'numeric', month: 'long' }).format(d));

export function ScheduleScreen({
  modo, servicio, mes, fecha, slot, slots, minDate,
  onMes, onFecha, onSlot, onAvanzar, paso, onPaso, availability,
}) {
  const movil = modo === 'movil', escritorio = modo === 'escritorio';
  const elegido = slots.find((s) => s.id === slot) || null;
  const libres = slots.filter((s) => s.libre).length;

  return (
    <>
      <div style={{ padding: movil ? 'var(--space-7) var(--gutter-movil) var(--space-10)' : 'var(--space-10) var(--gutter-escritorio) var(--space-11)', maxWidth: 'var(--width-content)', width: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
          <h1 style={{ margin: 0, fontFamily: 'var(--font-heading)', fontSize: movil ? 'var(--text-h1-sm)' : 'var(--text-h1)', fontWeight: 'var(--weight-bold)', letterSpacing: 'var(--track-h1)' }}>Reservar</h1>
          <span style={{ marginLeft: 'auto', whiteSpace: 'nowrap', fontSize: 'var(--text-caption)', color: 'var(--color-text-muted)', fontVariantNumeric: 'tabular-nums' }}>Paso {paso} de 3</span>
        </div>
        <Stepper steps={['Servicio', 'Fecha y hora', 'Pago']} current={paso} onSelect={onPaso} style={{ marginTop: 'var(--space-5)' }} />

        <div style={movil
          ? { display: 'flex', flexDirection: 'column', gap: 'var(--space-9)', marginTop: 'var(--space-7)' }
          : { display: 'flex', gap: escritorio ? 'var(--space-11)' : 'var(--space-9)', flexWrap: 'wrap', alignItems: 'flex-start', marginTop: 'var(--space-8)' }}>
          <CalendarMonth month={mes} selected={fecha} minDate={minDate}
            onSelect={onFecha} onMonthChange={onMes} availability={availability}
            footer={`${servicio.nombre} · ${servicio.tipo} · ${servicio.modalidad} · ${servicio.dur} min · ${servicio.precio}`}
            style={movil ? { width: '100%' } : { flex: '1 1 300px', maxWidth: escritorio ? 340 : undefined, minWidth: 280 }} />

          <div style={movil ? { width: '100%', minWidth: 0 } : { flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
              <div style={{ fontFamily: 'var(--font-heading)', fontSize: 'var(--text-h2)', fontWeight: 'var(--weight-semibold)' }}>{fmtFecha(fecha)}</div>
              <div style={{ fontSize: 'var(--text-micro)', letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>{libres} de {slots.length} libres</div>
            </div>
            {slots.length === 0 ? (
              <p style={{ padding: 'var(--space-11) 0', textAlign: 'center', fontSize: 'var(--text-body)', color: 'var(--color-text-muted)' }}>
                No hay horarios este día. Elige otra fecha del mes.
              </p>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(190px,1fr))', gap: 'var(--space-3)', marginTop: 'var(--space-5)' }}>
                {slots.map((s) => (
                  <SlotCard key={s.id} rango={s.rango} estado={s.libre ? s.estado : s.motivo}
                    disponible={s.libre} selected={s.id === slot} onClick={() => onSlot(s.id)} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <ActionBar
        gutter={movil ? 'var(--gutter-movil)' : 'var(--gutter-escritorio)'}
        summary={elegido ? `${fmtFecha(fecha)} · ${elegido.rango}` : 'Elige un horario disponible'}
        action={<Button variant="primary" size="lg" disabled={!elegido} onClick={onAvanzar}>Continuar al pago</Button>}
      />
    </>
  );
}
