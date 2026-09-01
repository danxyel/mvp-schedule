import * as React from 'react';

/**
 * Fila del catálogo de servicios — el paso 01 del flujo. Separada por línea superior de 1px,
 * nunca en caja: el catálogo es una lista, no una rejilla de tarjetas.
 * @startingPoint section="Reserva" subtitle="Catálogo de servicios con ocupación" viewport="700x290"
 */
export interface ServiceRowProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  nombre: string;
  desc?: string;
  /** Ya formateado: "$320" o "Con bono" cuando los precios están ocultos */
  precio: string;
  /** Individual | Grupal | Recurrente */
  tipo?: string;
  modalidad?: string;
  /** "55 min" */
  duracion?: string;
  ocupados?: number;
  cupo?: number;
  /** Código de color del servicio: punto, badge y barra comparten tono */
  tone?: 'accent' | 'accent2' | 'neutral';
}

export function ServiceRow(props: ServiceRowProps): JSX.Element;
