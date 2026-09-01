const NS = window.DS;
const { Button, Chip, Badge, CapacityBar } = NS;
function Demo() {
  const [filtro, setFiltro] = React.useState('Grupal');
  return <>
    <div className="blk"><div className="eyebrow">Button</div><div className="row">
      <Button variant="primary" size="lg">Confirmar reserva</Button>
      <Button variant="secondary">Ver mis reservas</Button>
      <Button variant="ghost">Reservar otra</Button>
      <Button variant="primary" size="sm" icon="＋">Nueva</Button>
      <Button variant="primary" disabled>Elige un servicio</Button>
    </div></div>
    <div className="blk"><div className="eyebrow">Chip</div><div className="row">
      {['Todos','Individual','Grupal','Recurrente'].map(f =>
        <Chip key={f} selected={f===filtro} onClick={()=>setFiltro(f)}>{f}</Chip>)}
      <span style={{marginLeft:'auto',fontSize:'var(--text-caption)',color:'var(--color-text-muted)',fontVariantNumeric:'tabular-nums'}}>2 de 6</span>
    </div></div>
    <div className="blk"><div className="eyebrow">Badge</div><div className="row">
      <Badge tone="accent">4 lugares</Badge>
      <Badge tone="positive">Confirmada</Badge>
      <Badge tone="warn">Pago pendiente · 08:42</Badge>
      <Badge tone="idle">Completo</Badge>
    </div></div>
    <div><div className="eyebrow">CapacityBar</div><div className="row" style={{gap:'var(--space-9)'}}>
      <CapacityBar ocupados={4} cupo={6} tone="accent" />
      <CapacityBar ocupados={6} cupo={6} tone="accent2" />
      <CapacityBar cupo={1} tone="neutral" />
    </div></div>
  </>;
}
ReactDOM.createRoot(document.getElementById('root')).render(<Demo />);
