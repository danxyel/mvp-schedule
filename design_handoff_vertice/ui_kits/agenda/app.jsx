const NS = window.DS;
const { AppShell, CatalogScreen, ScheduleScreen, PassesScreen, BookingRow } = NS;

const HOY = new Date(2026, 7, 12);
const money = (n) => new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN',maximumFractionDigits:0}).format(n);

const SERVICIOS = [
  { id:'sv1', nombre:'Regularización de Matemáticas', tipo:'Grupal', modalidad:'Presencial', dur:55, base:320, cupo:6, ocupados:4, hora:8,  tone:'accent',
    desc:'Grupo reducido de secundaria y bachillerato · Academia Centro' },
  { id:'sv2', nombre:'Fisioterapia deportiva', tipo:'Individual', modalidad:'Presencial', dur:50, base:850, cupo:1, ocupados:0, hora:10, tone:'accent2',
    desc:'Valoración, terapia manual y pauta de ejercicio en casa' },
  { id:'sv3', nombre:'Conversación en inglés B2', tipo:'Recurrente', modalidad:'Virtual', dur:60, base:260, cupo:8, ocupados:6, hora:12, tone:'neutral',
    desc:'Misma hora cada semana, corrección al cierre' },
  { id:'sv4', nombre:'Rehabilitación de piso pélvico', tipo:'Grupal', modalidad:'Presencial', dur:45, base:400, cupo:6, ocupados:6, hora:17, tone:'accent2',
    desc:'Trabajo guiado con seguimiento clínico entre sesiones' },
].map(s => ({ ...s, precio: money(s.base) }));

const hash = (d) => (d.getDate()*7 + d.getMonth()*13) % 11;
const slotsDe = (sv, d) => {
  if (d.getDay() === 0) return [];
  const h = hash(d);
  return [0,2,4,6,8,10].map((off,i) => {
    const ini = sv.hora + off > 20 ? sv.hora + off - 12 : sv.hora + off;
    const idx = (h + i*3) % 7, libre = idx > 2;
    const fin = Math.floor(ini + sv.dur/60);
    return {
      id: `${d.getMonth()}-${d.getDate()}-${i}`,
      rango: `${String(Math.floor(ini)).padStart(2,'0')}:00 – ${String(fin).padStart(2,'0')}:${sv.dur%60?'55':'00'}`,
      libre,
      motivo: idx===0 ? 'Lleno' : idx===1 ? 'Ocupado' : 'No disponible',
      estado: sv.cupo === 1 ? 'Disponible' : `${Math.max(1, sv.cupo - ((h+i) % sv.cupo))} lugares`,
    };
  });
};

function useModoLocal() {
  const [ancho, setAncho] = React.useState(window.innerWidth);
  const ref = React.useCallback((el) => {
    if (!el) return;
    const medir = () => setAncho(el.clientWidth);
    new ResizeObserver(medir).observe(el);
    medir();
  }, []);
  return { ref, modo: ancho < 640 ? 'movil' : ancho < 1024 ? 'tablet' : 'escritorio' };
}

function App() {
  const { ref, modo } = useModoLocal();
  const [seccion, setSeccion] = React.useState('reservar');
  const [paso, setPaso] = React.useState(1);
  const [filtro, setFiltro] = React.useState('Todos');
  const [selId, setSelId] = React.useState('sv1');
  const [mes, setMes] = React.useState(new Date(2026,7,1));
  const [fecha, setFecha] = React.useState(new Date(2026,7,12));
  const [slot, setSlot] = React.useState(null);
  const [bono, setBono] = React.useState(7);

  const servicio = SERVICIOS.find(s => s.id === selId) || SERVICIOS[0];
  const slots = slotsDe(servicio, fecha);
  const movil = modo === 'movil';

  const abrir = (id) => { setSelId(id); setSlot(null); setPaso(2); };

  const cuerpo = () => {
    if (seccion === 'bonos')  return <PassesScreen modo={modo} bono={bono} />;
    if (seccion === 'reservas') return (
      <div style={{padding: movil ? '16px 16px 24px' : '26px 32px 32px', maxWidth:'var(--width-content)'}}>
        <h1 style={{margin:0,fontFamily:'var(--font-heading)',fontSize:movil?'var(--text-h1-sm)':'var(--text-h1)',fontWeight:700,letterSpacing:'var(--track-h1)'}}>Mis reservas</h1>
        <p style={{margin:'var(--space-3) 0 var(--space-2)',fontSize:'var(--text-body)',color:'var(--color-text-muted)'}}>3 sesiones próximas · 1 pendiente de pago</p>
        <div style={movil?{display:'grid',gridTemplateColumns:'1fr',marginTop:'var(--space-5)'}:{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(320px,1fr))',gap:'0 28px',marginTop:'var(--space-5)'}}>
          <BookingRow hora="19:00" dia="Jue 13" titulo="Conversación en inglés B2" lugar="Virtual · Zoom" estado="Confirmada" tone="positive" />
          <BookingRow hora="10:30" dia="Vie 14" titulo="Fisioterapia deportiva" lugar="Clínica Pau Ferrer" estado="Pago pendiente · 08:42" tone="warn" />
          <BookingRow hora="17:00" dia="Lun 17" titulo="Rehabilitación de piso pélvico" lugar="Clínica Pau Ferrer" estado="En lista de espera · nº 2" tone="idle" />
          <BookingRow hora="08:00" dia="Mar 18" titulo="Regularización de Matemáticas" lugar="Academia Centro" estado="Confirmada" tone="positive" />
        </div>
      </div>
    );
    if (seccion === 'equipo') return (
      <div style={{padding: movil ? '16px 16px 24px' : '26px 32px 32px'}}>
        <h1 style={{margin:0,fontFamily:'var(--font-heading)',fontSize:movil?'var(--text-h1-sm)':'var(--text-h1)',fontWeight:700,letterSpacing:'var(--track-h1)'}}>Agenda del equipo</h1>
        <p style={{marginTop:'var(--space-5)',fontSize:'var(--text-body)',color:'var(--color-text-muted)',maxWidth:'var(--width-prose)'}}>
          Vista de consulta del profesional. Rejilla semanal desde tablet, lista por día en móvil.
          No está recreada en este kit: vive en <code>Agenda Responsive.dc.html</code>.
        </p>
      </div>
    );
    if (paso === 2) return (
      <ScheduleScreen modo={modo} servicio={servicio} mes={mes} fecha={fecha} slot={slot} slots={slots}
        minDate={HOY} onMes={setMes} onFecha={(d)=>{setFecha(d);setSlot(null);}} onSlot={setSlot}
        paso={paso} onPaso={setPaso} onAvanzar={()=>{ setBono(b=>Math.max(0,b-1)); setSeccion('bonos'); }}
        availability={(d)=>slotsDe(servicio,d).filter(s=>s.libre).length} />
    );
    return (
      <CatalogScreen modo={modo} servicios={SERVICIOS} filtro={filtro} onFiltro={setFiltro}
        onAbrir={abrir} paso={paso} onPaso={setPaso} />
    );
  };

  return (
    <div ref={ref} style={{height:'100%',background:'var(--color-bg)',overflow:'hidden'}}>
      <AppShell modo={modo} seccion={seccion} bono={bono}
        onSeccion={(id)=>{ setSeccion(id); if (id==='reservar') setPaso(1); }}>
        {cuerpo()}
      </AppShell>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
