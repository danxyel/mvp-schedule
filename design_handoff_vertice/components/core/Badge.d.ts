import * as React from 'react';

/** Etiqueta de estado o de tipo. El tono ES el significado: no elijas por estética. */
export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** accent = disponibilidad · positive = confirmado · warn = requiere acción · idle = neutro o bloqueado */
  tone?: 'accent' | 'positive' | 'warn' | 'idle';
  children?: React.ReactNode;
}

export function Badge(props: BadgeProps): JSX.Element;
