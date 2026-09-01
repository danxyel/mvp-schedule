import * as React from 'react';

/** Filtro de un solo valor. En móvil los chips van en fila deslizable, nunca envueltos a dos líneas. */
export interface ChipProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  selected?: boolean;
  children?: React.ReactNode;
}

export function Chip(props: ChipProps): JSX.Element;
