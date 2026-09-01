import React from 'react';
import { NavItem } from '../../components/navigation/NavItem.jsx';

const MENU = [
  { id: 'reservar', icon: '＋', label: 'Reservar' },
  { id: 'reservas', icon: '▤', label: 'Mis reservas', badge: '3' },
  { id: 'bonos',    icon: '◇', label: 'Bonos' },
  { id: 'equipo',   icon: '▦', label: 'Equipo' },
];

export function useModo() {
  const [ancho, setAncho] = React.useState(
    typeof window !== 'undefined' ? window.innerWidth : 1200);
  const ref = React.useCallback((el) => {
    if (!el) return;
    const medir = () => setAncho(el.clientWidth);
    new ResizeObserver(medir).observe(el);
    medir();
  }, []);
  const modo = ancho < 640 ? 'movil' : ancho < 1024 ? 'tablet' : 'escritorio';
  return { ref, modo, ancho };
}

export function AppShell({ modo, seccion, onSeccion, bono, children }) {
  const movil = modo === 'movil', escritorio = modo === 'escritorio';
  const navMode = movil ? 'bar' : escritorio ? 'sidebar' : 'rail';

  const nav = (
    <div style={movil
      ? { flex: 'none', display: 'flex', background: 'var(--color-surface)', borderTop: 'var(--border-hairline)', padding: 'var(--space-2) var(--space-3) var(--space-4)' }
      : { width: escritorio ? 'var(--nav-sidebar)' : 'var(--nav-rail)', flex: 'none', display: 'flex', flexDirection: 'column', background: 'var(--color-surface)', borderRight: 'var(--border-hairline)', padding: 'var(--space-6) var(--space-3)' }}>
      {!movil && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', padding: 'var(--space-1) var(--space-3) var(--space-7)', flexWrap: 'wrap', justifyContent: escritorio ? 'flex-start' : 'center' }}>
          <span style={{ width: 26, height: 26, flex: 'none', background: 'var(--color-text)', color: 'var(--color-text-invert)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-heading)', fontSize: 15, fontWeight: 'var(--weight-bold)', borderRadius: 'var(--radius-sm)' }}>V</span>
          {escritorio && <>
            <span style={{ fontFamily: 'var(--font-heading)', fontSize: 17, fontWeight: 'var(--weight-bold)', letterSpacing: '-0.01em' }}>Vértice</span>
            <span style={{ width: '100%', fontSize: 'var(--text-micro)', color: 'var(--color-text-muted)' }}>Academia Centro</span>
          </>}
        </div>
      )}
      <div style={movil
        ? { display: 'flex', flex: 1, gap: 'var(--space-1)' }
        : { display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
        {MENU.map((m) => (
          <NavItem key={m.id} mode={navMode} icon={m.icon} label={m.label}
            badge={m.id === 'bonos' ? String(bono) : m.badge}
            active={m.id === seccion} onClick={() => onSeccion(m.id)} />
        ))}
      </div>
      {escritorio && (
        <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: 'var(--space-4)', padding: 'var(--space-5) var(--space-3) var(--space-1)', borderTop: 'var(--border-hairline)' }}>
          <span style={{ width: 28, height: 28, flex: 'none', borderRadius: 'var(--radius-round)', background: 'var(--color-accent-200)', color: 'var(--color-accent-800)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 'var(--text-caption)', fontWeight: 'var(--weight-semibold)' }}>NS</span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 'var(--text-meta)', fontWeight: 'var(--weight-semibold)' }}>Nuria Sáez</div>
            <div style={{ fontSize: 'var(--text-micro)', color: 'var(--color-text-muted)' }}>Cliente y asesora</div>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: movil ? 'column-reverse' : 'row', background: 'var(--color-bg)' }}>
      {nav}
      <div style={{ flex: 1, minWidth: 0, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
        {children}
      </div>
    </div>
  );
}
