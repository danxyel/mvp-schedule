const NS = window.DS;
const { NavItem, Stepper, StepArrow, ActionBar, Button } = NS;
const MENU = [['＋','Reservar',''],['▤','Mis reservas','3'],['◇','Bonos','7'],['▦','Equipo','']];
function Demo(){
  const [sec,setSec]=React.useState('Bonos');
  const [paso,setPaso]=React.useState(2);
  const item = (mode) => MENU.map(([i,l,b]) =>
    <NavItem key={l} mode={mode} icon={i} label={l} badge={b} active={l===sec} onClick={()=>setSec(l)} />);
  return <div style={{display:'grid',gridTemplateColumns:'250px 1fr',gap:'var(--space-9)'}}>
    <div>
      <div className="eyebrow">NavItem · sidebar / rail / bar</div>
      <div style={{display:'flex',gap:'var(--space-3)',alignItems:'flex-start'}}>
        <div className="surf" style={{width:150}}>{item('sidebar')}</div>
        <div className="surf" style={{width:76}}>{item('rail')}</div>
      </div>
      <div className="surf" style={{display:'flex',marginTop:'var(--space-3)',padding:'var(--space-2) var(--space-3) var(--space-4)'}}>{item('bar')}</div>
    </div>
    <div>
      <div className="eyebrow">Stepper</div>
      <Stepper steps={['Servicio','Fecha y hora','Pago']} current={paso} onSelect={setPaso} />
      <div className="eyebrow" style={{marginTop:'var(--space-8)'}}>StepArrow</div>
      <div style={{display:'flex',gap:'var(--space-3)',alignItems:'center'}}>
        <StepArrow direction="prev" disabled onClick={()=>{}} />
        <span style={{fontFamily:'var(--font-heading)',fontSize:'var(--text-h3)',fontWeight:600}}>Agosto 2026</span>
        <StepArrow direction="next" onClick={()=>{}} />
      </div>
      <div className="eyebrow" style={{marginTop:'var(--space-8)'}}>ActionBar</div>
      <div style={{border:'var(--border-hairline)',borderRadius:'var(--radius-2xl)',overflow:'hidden'}}>
        <ActionBar summary="Elige un horario disponible"
          action={<Button variant="primary" size="lg" disabled>Continuar al pago</Button>} />
      </div>
    </div>
  </div>;
}
ReactDOM.createRoot(document.getElementById('root')).render(<Demo />);
