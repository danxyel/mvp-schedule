/* Bundle del design system Vértice — generado desde components/ y ui_kits/.
   Cárgalo con <script type="text/babel" src="..."> (las fuentes son JSX) y lee window.DS.
   Cada módulo va en su propio ámbito, así que los helpers internos no colisionan.
   No lo edites a mano: edita los .jsx y vuelve a generarlo. */
window.DS = window.DS || {};

/* ── components/core/Button.jsx ── */
(function () {
const SIZES = {
  sm: { height: 'var(--control-sm)', padding: '0 var(--space-6)', font: 'var(--text-caption)' },
  md: { height: 'var(--control-md)', padding: '0 var(--space-7)', font: 'var(--text-body-sm)' },
  lg: { height: 'var(--control-lg)', padding: '0 var(--space-9)', font: 'var(--text-body)' },
};

function Button({
  variant = 'primary', size = 'md', block = false, disabled = false,
  icon, onClick, children, style, ...rest
}) {
  const [hover, setHover] = React.useState(false);
  const [down, setDown] = React.useState(false);
  const s = SIZES[size] || SIZES.md;

  const skin = () => {
    if (variant === 'primary') return {
      background: down ? 'var(--color-accent-700)' : hover ? 'var(--color-accent-600)' : 'var(--color-accent)',
      color: 'var(--color-text-invert)',
      border: '1px solid transparent',
      fontWeight: 'var(--weight-semibold)',
    };
    if (variant === 'secondary') return {
      background: down ? 'var(--color-accent-200)' : hover ? 'var(--color-accent-100)' : 'var(--color-surface)',
      color: 'var(--color-accent-700)',
      border: '1px solid var(--color-accent-300)',
      fontWeight: 'var(--weight-semibold)',
    };
    return {
      background: down ? 'var(--color-neutral-300)' : hover ? 'var(--color-neutral-200)' : 'transparent',
      color: 'var(--color-text)',
      border: '1px solid transparent',
      fontWeight: 'var(--weight-medium)',
    };
  };

  return (
    <button
      type="button" disabled={disabled} onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => { setHover(false); setDown(false); }}
      onMouseDown={() => setDown(true)} onMouseUp={() => setDown(false)}
      style={{
        display: block ? 'flex' : 'inline-flex', width: block ? '100%' : 'auto',
        alignItems: 'center', justifyContent: 'center', gap: 'var(--space-3)',
        height: s.height, padding: s.padding, fontSize: s.font,
        fontFamily: 'var(--font-body)', lineHeight: 1,
        borderRadius: 'var(--radius-pill)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? .5 : 1,
        outlineOffset: 2, transition: 'background var(--dur-fast) var(--ease-out)',
        whiteSpace: 'nowrap', ...skin(), ...style,
      }}
      {...rest}
    >
      {icon ? <span style={{ fontSize: '1.1em', lineHeight: 1 }}>{icon}</span> : null}
      {children}
    </button>
  );
}
window.DS.Button = Button;
})();

/* ── components/core/Chip.jsx ── */
(function () {
function Chip({ selected = false, onClick, children, style, ...rest }) {
  const [hover, setHover] = React.useState(false);
  return (
    <button
      type="button" onClick={onClick} aria-pressed={selected}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        flex: 'none', height: 'var(--control-md)', padding: '0 var(--space-7)',
        borderRadius: 'var(--radius-pill)',
        fontFamily: 'var(--font-body)', fontSize: 'var(--text-meta)',
        cursor: 'pointer', whiteSpace: 'nowrap', outlineOffset: 2,
        transition: 'background var(--dur-fast) var(--ease-out)',
        background: selected ? 'var(--color-accent)' : hover ? 'var(--color-accent-100)' : 'transparent',
        color: selected ? 'var(--color-text-invert)' : 'var(--color-text)',
        border: `1px solid ${selected ? 'var(--color-accent)' : 'var(--color-border-strong)'}`,
        fontWeight: selected ? 'var(--weight-semibold)' : 'var(--weight-regular)',
        ...style,
      }}
      {...rest}
    >{children}</button>
  );
}
window.DS.Chip = Chip;
})();

/* ── components/core/Badge.jsx ── */
(function () {
const TONES = {
  accent:   ['var(--color-accent-100)',   'var(--color-accent-700)',   'var(--color-accent-300)'],
  positive: ['var(--state-positive-fill)','var(--state-positive-ink)', 'var(--state-positive-border)'],
  warn:     ['var(--state-warn-fill)',    'var(--state-warn-ink)',     'var(--state-warn-border)'],
  idle:     ['var(--state-idle-fill)',    'var(--state-idle-ink)',     'var(--state-idle-border)'],
};

function Badge({ tone = 'idle', children, style, ...rest }) {
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
window.DS.Badge = Badge;
})();

/* ── components/core/CapacityBar.jsx ── */
(function () {
const TINT = {
  accent: 'var(--color-accent)',
  accent2: 'var(--color-accent-2)',
  neutral: 'var(--color-neutral-500)',
};

function CapacityBar({ ocupados = 0, cupo = 1, tone = 'accent', showCount = true, style }) {
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
window.DS.CapacityBar = CapacityBar;
})();

/* ── components/navigation/NavItem.jsx ── */
(function () {
function NavItem({ mode = 'sidebar', icon, label, badge, active = false, onClick, style, ...rest }) {
  const [hover, setHover] = React.useState(false);
  const bar = mode === 'bar', rail = mode === 'rail';

  const base = {
    display: 'flex', alignItems: 'center', cursor: 'pointer',
    fontFamily: 'var(--font-body)', border: 'none', outlineOffset: 2,
    background: 'transparent', transition: 'background var(--dur-fast) var(--ease-out)',
  };

  const skin = bar ? {
    flex: 1, minHeight: 'var(--touch-nav)', flexDirection: 'column',
    justifyContent: 'center', gap: 'var(--space-1)',
    color: active ? 'var(--color-accent-700)' : 'var(--color-text-muted)',
  } : {
    width: '100%', minHeight: rail ? 56 : 40, borderRadius: 'var(--radius-lg)',
    padding: rail ? '0 var(--space-1)' : '0 var(--space-4)',
    flexDirection: rail ? 'column' : 'row',
    justifyContent: rail ? 'center' : 'flex-start',
    gap: rail ? 'var(--space-1)' : 'var(--space-4)',
    textAlign: 'left', fontSize: 'var(--text-body-sm)',
    background: active ? 'var(--color-neutral-200)' : hover ? 'var(--color-neutral-100)' : 'transparent',
    color: active ? 'var(--color-text)' : 'var(--color-text-muted)',
    fontWeight: active ? 'var(--weight-semibold)' : 'var(--weight-regular)',
  };

  return (
    <button type="button" onClick={onClick} aria-current={active ? 'page' : undefined}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{ ...base, ...skin, ...style }} {...rest}>
      <span style={{ fontSize: bar ? 15 : 16, lineHeight: 1 }}>{icon}</span>
      <span style={bar || rail
        ? { fontSize: 'var(--text-eyebrow)', letterSpacing: '.06em', textAlign: 'center' }
        : { flex: 1 }}>{label}</span>
      {badge && !bar && !rail ? (
        <span style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text-muted)', fontVariantNumeric: 'tabular-nums' }}>{badge}</span>
      ) : null}
    </button>
  );
}
window.DS.NavItem = NavItem;
})();

/* ── components/navigation/Stepper.jsx ── */
(function () {
function Stepper({ steps = [], current = 1, onSelect, style }) {
  return (
    <div style={{ display: 'flex', gap: 'var(--space-2)', ...style }}>
      {steps.map((label, i) => {
        const n = i + 1, alcanzado = n <= current, activo = n === current;
        return (
          <button key={label} type="button" disabled={!alcanzado}
            onClick={() => alcanzado && onSelect && onSelect(n)}
            style={{
              flex: 1, padding: 'var(--space-3) var(--space-4)', border: 'none',
              borderTop: `2px solid ${alcanzado ? 'var(--color-accent)' : 'var(--color-border-strong)'}`,
              background: 'none', textAlign: 'left', outlineOffset: 2,
              cursor: alcanzado ? 'pointer' : 'default',
              fontFamily: 'var(--font-body)',
              color: activo ? 'var(--color-text)' : 'var(--color-text-muted)',
            }}>
            <span style={{ display: 'block', fontSize: 'var(--text-eyebrow)', letterSpacing: '.14em', textTransform: 'uppercase', opacity: .7 }}>
              {String(n).padStart(2, '0')}
            </span>
            <span style={{ display: 'block', fontSize: 'var(--text-meta)', fontWeight: 'var(--weight-semibold)', marginTop: 3 }}>{label}</span>
          </button>
        );
      })}
    </div>
  );
}
window.DS.Stepper = Stepper;
})();

/* ── components/navigation/StepArrow.jsx ── */
(function () {
function StepArrow({ direction = 'next', disabled = false, onClick, label, style, ...rest }) {
  const [hover, setHover] = React.useState(false);
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      aria-label={label || (direction === 'prev' ? 'Anterior' : 'Siguiente')}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        width: 40, height: 40, flex: 'none', borderRadius: 'var(--radius-pill)',
        background: hover && !disabled ? 'var(--color-accent-100)' : 'transparent',
        border: '1px solid var(--color-border-strong)',
        color: 'var(--color-text)', fontFamily: 'var(--font-heading)',
        fontSize: 18, lineHeight: 1, outlineOffset: 2,
        cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? .35 : 1,
        transition: 'background var(--dur-fast) var(--ease-out)', ...style,
      }} {...rest}>{direction === 'prev' ? '‹' : '›'}</button>
  );
}
window.DS.StepArrow = StepArrow;
})();

/* ── components/navigation/ActionBar.jsx ── */
(function () {
function ActionBar({ summary, action, gutter = 'var(--gutter-movil)', style, children }) {
  return (
    <div style={{
      position: 'sticky', bottom: 0, marginTop: 'auto',
      display: 'flex', alignItems: 'center', gap: 'var(--space-5)',
      padding: `var(--space-5) ${gutter}`,
      background: 'var(--color-surface)',
      borderTop: 'var(--border-hairline)', ...style,
    }}>
      <span style={{
        fontSize: 'var(--text-meta)', color: 'var(--color-text-muted)',
        minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>{summary}</span>
      <span style={{ marginLeft: 'auto', flex: 'none' }}>{action || children}</span>
    </div>
  );
}
window.DS.ActionBar = ActionBar;
})();

/* ── components/booking/ServiceRow.jsx ── */
(function () {
  const { Badge, CapacityBar } = window.DS;
const TINT = {
  accent:  { base:'var(--color-accent)',    soft:'var(--color-accent-100)',    deep:'var(--color-accent-700)',    line:'var(--color-accent-300)' },
  accent2: { base:'var(--color-accent-2)',  soft:'var(--color-accent-2-100)',  deep:'var(--color-accent-2-800)',  line:'var(--color-accent-2-300)' },
  neutral: { base:'var(--color-neutral-500)',soft:'var(--color-neutral-200)',  deep:'var(--color-neutral-700)',   line:'var(--color-neutral-400)' },
};

function ServiceRow({
  nombre, desc, precio, tipo = 'Grupal', modalidad, duracion,
  ocupados = 0, cupo = 1, tone = 'accent', onClick, style, ...rest
}) {
  const [hover, setHover] = React.useState(false);
  const c = TINT[tone] || TINT.accent;
  return (
    <button type="button" onClick={onClick}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        width: '100%', textAlign: 'left', background: hover ? 'var(--color-neutral-100)' : 'none',
        border: 'none', borderTop: 'var(--border-hairline)',
        padding: 'var(--space-6) var(--space-3) var(--space-6) 0',
        cursor: 'pointer', fontFamily: 'var(--font-body)', color: 'var(--color-text)',
        outlineOffset: 2, transition: 'background var(--dur-fast) var(--ease-out)', ...style,
      }} {...rest}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-4)' }}>
        <span style={{ width: 9, height: 9, marginTop: 6, borderRadius: 'var(--radius-round)', flex: 'none', background: c.base }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
            <span style={{ fontFamily: 'var(--font-heading)', fontSize: 'var(--text-h3)', fontWeight: 'var(--weight-semibold)', letterSpacing: 'var(--track-title)' }}>{nombre}</span>
            <span style={{ fontSize: 'var(--text-title)', fontWeight: 'var(--weight-semibold)', fontVariantNumeric: 'tabular-nums' }}>{precio}</span>
          </div>
          {desc ? <div style={{ fontSize: 'var(--text-meta)', lineHeight: 'var(--leading-snug)', color: 'var(--color-text-muted)', marginTop: 'var(--space-1)' }}>{desc}</div> : null}
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', marginTop: 'var(--space-3)', flexWrap: 'wrap' }}>
            <Badge tone={tone === 'neutral' ? 'idle' : tone === 'accent2' ? 'positive' : 'accent'}>{tipo}</Badge>
            <span style={{ whiteSpace: 'nowrap', fontSize: 'var(--text-caption)', color: 'var(--color-text-muted)' }}>{modalidad} · {duracion}</span>
            <CapacityBar ocupados={ocupados} cupo={cupo} tone={tone} />
          </div>
        </div>
      </div>
    </button>
  );
}
window.DS.ServiceRow = ServiceRow;
})();

/* ── components/booking/SlotCard.jsx ── */
(function () {
  const { Badge } = window.DS;
function SlotCard({ rango, estado, disponible = true, selected = false, onClick, style, ...rest }) {
  const [hover, setHover] = React.useState(false);
  return (
    <button type="button" onClick={onClick} disabled={!disponible} aria-pressed={selected}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        textAlign: 'left', padding: 'var(--space-5) var(--space-6)', minHeight: 64,
        borderRadius: 'var(--radius-xl)', outlineOffset: 2,
        cursor: disponible ? 'pointer' : 'not-allowed',
        background: selected ? 'var(--color-accent-100)' : hover && disponible ? 'var(--color-neutral-100)' : 'var(--color-surface)',
        border: `1px solid ${selected ? 'var(--color-accent)' : 'var(--color-border)'}`,
        color: 'var(--color-text)', opacity: disponible ? 1 : .5,
        fontFamily: 'var(--font-body)',
        transition: 'background var(--dur-fast) var(--ease-out)', ...style,
      }} {...rest}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-3)' }}>
        <span style={{ fontSize: 'var(--text-title)', fontWeight: 'var(--weight-semibold)', fontVariantNumeric: 'tabular-nums' }}>{rango}</span>
        <Badge tone={disponible ? 'accent' : 'idle'}>{estado}</Badge>
      </div>
    </button>
  );
}
window.DS.SlotCard = SlotCard;
})();

/* ── components/booking/PlanCard.jsx ── */
(function () {
function PlanCard({ nombre, precio, nota, selected = false, onClick, style, ...rest }) {
  const [hover, setHover] = React.useState(false);
  return (
    <button type="button" onClick={onClick} aria-pressed={selected}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        display: 'block', width: '100%', textAlign: 'left',
        padding: 'var(--space-7) var(--space-8)', marginBottom: 'var(--space-4)',
        borderRadius: 'var(--radius-xl)', cursor: 'pointer', outlineOffset: 2,
        fontFamily: 'var(--font-body)', color: 'var(--color-text)',
        background: selected ? 'var(--color-accent-100)' : hover ? 'var(--color-neutral-100)' : 'var(--color-surface)',
        border: `1px solid ${selected ? 'var(--color-accent)' : 'var(--color-border)'}`,
        transition: 'background var(--dur-fast) var(--ease-out)', ...style,
      }} {...rest}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 'var(--space-5)' }}>
        <span style={{ fontFamily: 'var(--font-heading)', fontSize: 'var(--text-h3)', fontWeight: 'var(--weight-semibold)' }}>{nombre}</span>
        <span style={{ fontSize: 'var(--text-h3)', fontWeight: 'var(--weight-semibold)', fontVariantNumeric: 'tabular-nums' }}>{precio}</span>
      </div>
      {nota ? <div style={{ fontSize: 'var(--text-meta)', color: 'var(--color-text-muted)', marginTop: 'var(--space-2)' }}>{nota}</div> : null}
    </button>
  );
}
window.DS.PlanCard = PlanCard;
})();

/* ── components/booking/CalendarMonth.jsx ── */
(function () {
  const { StepArrow } = window.DS;
const DOW = ['Lu','Ma','Mi','Ju','Vi','Sá','Do'];
const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);
const key = (d) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

function CalendarMonth({
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
window.DS.CalendarMonth = CalendarMonth;
})();

/* ── components/records/StatCard.jsx ── */
(function () {
function StatCard({ label, value, nota, style, ...rest }) {
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
window.DS.StatCard = StatCard;
})();

/* ── components/records/BookingRow.jsx ── */
(function () {
  const { Badge } = window.DS;
function BookingRow({ hora, dia, titulo, lugar, estado, tone = 'positive', style, ...rest }) {
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
window.DS.BookingRow = BookingRow;
})();

/* ── components/records/MovementRow.jsx ── */
(function () {
function MovementRow({ fecha, concepto, importe, style, ...rest }) {
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
window.DS.MovementRow = MovementRow;
})();

/* ── ui_kits/agenda/AppShell.jsx ── */
(function () {
  const { NavItem } = window.DS;
const MENU = [
  { id: 'reservar', icon: '＋', label: 'Reservar' },
  { id: 'reservas', icon: '▤', label: 'Mis reservas', badge: '3' },
  { id: 'bonos',    icon: '◇', label: 'Bonos' },
  { id: 'equipo',   icon: '▦', label: 'Equipo' },
];

function useModo() {
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

function AppShell({ modo, seccion, onSeccion, bono, children }) {
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
window.DS.AppShell = AppShell;
window.DS.useModo = useModo;
})();

/* ── ui_kits/agenda/CatalogScreen.jsx ── */
(function () {
  const { Chip, Stepper, ServiceRow } = window.DS;
function CatalogScreen({ modo, servicios, filtro, onFiltro, onAbrir, paso, onPaso }) {
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
window.DS.CatalogScreen = CatalogScreen;
})();

/* ── ui_kits/agenda/ScheduleScreen.jsx ── */
(function () {
  const { Button, Stepper, ActionBar, CalendarMonth, SlotCard } = window.DS;
const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);
const fmtFecha = (d) => cap(new Intl.DateTimeFormat('es-MX', { weekday: 'long', day: 'numeric', month: 'long' }).format(d));

function ScheduleScreen({
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
window.DS.ScheduleScreen = ScheduleScreen;
})();

/* ── ui_kits/agenda/PassesScreen.jsx ── */
(function () {
  const { StatCard, MovementRow } = window.DS;
function PassesScreen({ modo, bono }) {
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
window.DS.PassesScreen = PassesScreen;
})();
