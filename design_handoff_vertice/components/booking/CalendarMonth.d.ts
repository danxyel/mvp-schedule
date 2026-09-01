import * as React from 'react';

/**
 * Calendario de mes navegable, con la disponibilidad marcada como un guion bajo el número.
 * Semana que empieza en lunes, meses futuros abiertos, pasado bloqueado.
 * @startingPoint section="Reserva" subtitle="Calendario de mes con marcas de disponibilidad" viewport="700x420"
 */
export interface CalendarMonthProps {
  /** Mes visible (día 1) */
  month: Date;
  selected?: Date;
  /** Primer día seleccionable; antes de esa fecha los días quedan bloqueados */
  minDate?: Date;
  onSelect?: (date: Date) => void;
  onMonthChange?: (month: Date) => void;
  /** Nº de horarios libres del día → longitud del guion (tope 4) */
  availability?: (date: Date) => number;
  /** Línea de contexto bajo la rejilla: servicio, tipo, modalidad, duración, precio */
  footer?: React.ReactNode;
  style?: React.CSSProperties;
}

export function CalendarMonth(props: CalendarMonthProps): JSX.Element;
