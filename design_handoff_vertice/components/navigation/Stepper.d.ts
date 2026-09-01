import * as React from 'react';

/**
 * El progreso del único flujo de reserva del producto. Tres pasos, siempre los mismos.
 * Se puede volver atrás a un paso alcanzado; nunca saltar adelante.
 */
export interface StepperProps {
  /** Etiquetas en orden. En el producto: ['Servicio', 'Fecha y hora', 'Pago'] */
  steps?: string[];
  /** Paso actual, 1-indexado */
  current?: number;
  onSelect?: (step: number) => void;
  style?: React.CSSProperties;
}

export function Stepper(props: StepperProps): JSX.Element;
