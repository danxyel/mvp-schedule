import * as React from 'react';

/** Flecha de paginación de periodo (mes en el calendario, semana en la agenda del equipo). */
export interface StepArrowProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  direction?: 'prev' | 'next';
  disabled?: boolean;
  /** aria-label; por defecto "Anterior" / "Siguiente" */
  label?: string;
}

export function StepArrow(props: StepArrowProps): JSX.Element;
