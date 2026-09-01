import * as React from 'react';

/** Línea de movimiento de bonos y pagos. Los reembolsos (importe con "-") se tintan de turquesa. */
export interface MovementRowProps extends React.HTMLAttributes<HTMLDivElement> {
  /** "12 ago" — mes abreviado, sin año */
  fecha: string;
  /** "Paquete de 10 · Matemáticas" */
  concepto: string;
  /** Ya formateado; prefija "- " para un reembolso */
  importe: string;
}

export function MovementRow(props: MovementRowProps): JSX.Element;
