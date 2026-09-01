const NS = window.DS;
const { StatCard, BookingRow, MovementRow } = NS;
ReactDOM.createRoot(document.getElementById('root')).render(
  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'var(--space-10)'}}>
    <div>
      <div className="eyebrow">StatCard</div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'var(--space-5)'}}>
        <StatCard label="Saldo disponible" value="7 clases" nota="Vence el 30 nov" />
        <StatCard label="Gasto del mes" value="$2,160" nota="3 sesiones y 1 paquete" />
      </div>
      <div className="eyebrow" style={{marginTop:'var(--space-9)'}}>MovementRow</div>
      <MovementRow fecha="12 ago" concepto="Paquete de 10 · Matemáticas" importe="$2,720" />
      <MovementRow fecha="08 ago" concepto="Sesión suelta · Fisioterapia" importe="$850" />
      <MovementRow fecha="28 jul" concepto="Reembolso · clase cancelada" importe="- $320" />
    </div>
    <div>
      <div className="eyebrow">BookingRow</div>
      <BookingRow hora="19:00" dia="Jue 13" titulo="Conversación en inglés B2" lugar="Virtual · Zoom" estado="Confirmada" tone="positive" />
      <BookingRow hora="10:30" dia="Vie 14" titulo="Fisioterapia deportiva" lugar="Clínica Pau Ferrer" estado="Pago pendiente · 08:42" tone="warn" />
      <BookingRow hora="17:00" dia="Lun 17" titulo="Rehabilitación de piso pélvico" lugar="Clínica Pau Ferrer" estado="En lista de espera · nº 2" tone="idle" />
    </div>
  </div>
);
