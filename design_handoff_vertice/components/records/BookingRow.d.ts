import * as React from 'react';

/** Una reserva en "Mis reservas". Vista de consulta: la hora manda a la izquierda en columna fija. */
export interface BookingRowProps extends React.HTMLAttributes<HTMLDivElement> {
  /** "19:00" */
  hora: string;
  /** "Jue 13" */
  dia: string;
  titulo: string;
  /** "Virtual · Zoom", "Clínica Pau Ferrer" */
  lugar?: string;
  /** Con el dato dentro: "Pago pendiente · 08:42", "En lista de espera · nº 2" */
  estado: string;
  /** positive = confirmada · warn = requiere acción · idle = en espera */
  tone?: 'positive' | 'warn' | 'idle';
}

export function BookingRow(props: BookingRowProps): JSX.Element;
