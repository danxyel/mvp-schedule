import * as React from 'react';

/** Opción de pago del paso 03: sesión suelta o paquete de bonos. Grupo tipo radio. */
export interface PlanCardProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  nombre: string;
  /** Ya formateado con Intl */
  precio: string;
  /** Precio unitario y vigencia: "$272 por sesión · vigencia 3 meses." */
  nota?: string;
  selected?: boolean;
}

export function PlanCard(props: PlanCardProps): JSX.Element;
