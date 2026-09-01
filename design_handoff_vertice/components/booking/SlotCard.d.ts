import * as React from 'react';

/** Un horario reservable — el paso 02. Solo hora y estado: sin nombre de profesional. */
export interface SlotCardProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** "12:00 – 12:55" */
  rango: string;
  /** El dato, no el adjetivo: "4 lugares", "Disponible", "Lleno", "Ocupado" */
  estado: string;
  disponible?: boolean;
  selected?: boolean;
}

export function SlotCard(props: SlotCardProps): JSX.Element;
