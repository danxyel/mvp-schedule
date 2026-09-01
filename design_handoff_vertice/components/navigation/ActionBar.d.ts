import * as React from 'react';

/**
 * Barra pegada al fondo del flujo de reserva: a la izquierda el estado en texto,
 * a la derecha la única acción de avance. Es el único elemento fijo del sistema.
 */
export interface ActionBarProps {
  /** Estado en una línea; se trunca con ellipsis. Di POR QUÉ está bloqueado si lo está. */
  summary?: React.ReactNode;
  /** El <Button variant="primary" size="lg"> de avance */
  action?: React.ReactNode;
  /** var(--gutter-movil) | var(--gutter-escritorio) según el modo */
  gutter?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}

export function ActionBar(props: ActionBarProps): JSX.Element;
