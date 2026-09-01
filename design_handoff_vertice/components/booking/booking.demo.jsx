const NS = window.DS;
const { ServiceRow, SlotCard, PlanCard, CalendarMonth } = NS;
const HOY = new Date(2026,7,12);
function Demo(){
  const [mes,setMes]=React.useState(new Date(2026,7,1));
  const [fecha,setFecha]=React.useState(new Date(2026,7,12));
  const [slot,setSlot]=React.useState('b');
  const [plan,setPlan]=React.useState('p10');
  return <div style={{display:'grid',gridTemplateColumns:'1fr 300px',gap:'var(--space-10)'}}>
    <div>
      <div className="eyebrow">ServiceRow</div>
      <ServiceRow nombre="Regularización de Matemáticas" desc="Grupo reducido de secundaria y bachillerato · Academia Centro"
        precio="$320" tipo="Grupal" modalidad="Presencial" duracion="55 min" ocupados={4} cupo={6} tone="accent" onClick={()=>{}} />
      <ServiceRow nombre="Fisioterapia deportiva" desc="Valoración, terapia manual y pauta de ejercicio en casa"
        precio="$850" tipo="Individual" modalidad="Presencial" duracion="50 min" cupo={1} tone="accent2" onClick={()=>{}} />
      <div className="eyebrow" style={{marginTop:'var(--space-9)'}}>SlotCard</div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))',gap:'var(--space-3)'}}>
        <SlotCard rango="08:00 – 08:55" estado="4 lugares" onClick={()=>setSlot('a')} selected={slot==='a'} />
        <SlotCard rango="12:00 – 12:55" estado="2 lugares" onClick={()=>setSlot('b')} selected={slot==='b'} />
        <SlotCard rango="16:00 – 16:55" estado="Lleno" disponible={false} />
      </div>
      <div className="eyebrow" style={{marginTop:'var(--space-9)'}}>PlanCard</div>
      <PlanCard nombre="Paquete de 10" precio="$2,720" nota="$272 por sesión · el más contratado." selected={plan==='p10'} onClick={()=>setPlan('p10')} />
      <PlanCard nombre="Sesión suelta" precio="$320" nota="Pagas solo esta sesión, sin compromiso." selected={plan==='s'} onClick={()=>setPlan('s')} />
    </div>
    <div>
      <div className="eyebrow">CalendarMonth</div>
      <CalendarMonth month={mes} selected={fecha} minDate={HOY} onSelect={setFecha} onMonthChange={setMes}
        availability={(d)=>(d.getDay()===0?0:(d.getDate()*7)%5)}
        footer="Matemáticas · Grupal · Presencial · 55 min · $320" />
    </div>
  </div>;
}
ReactDOM.createRoot(document.getElementById('root')).render(<Demo />);
