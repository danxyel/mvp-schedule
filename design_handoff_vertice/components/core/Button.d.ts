import * as React from 'react';

/**
 * Acción principal del sistema. Píldora completa; el primario es relleno indigo.
 * @startingPoint section="Core" subtitle="Botones en sus tres variantes y tres tamaños" viewport="700x200"
 */
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** primary = relleno indigo · secondary = borde y texto indigo · ghost = sin caja */
  variant?: 'primary' | 'secondary' | 'ghost';
  /** sm 30px · md 38px · lg 46px (el lg es el CTA del flujo de reserva) */
  size?: 'sm' | 'md' | 'lg';
  /** Ocupa todo el ancho — solo en móvil */
  block?: boolean;
  disabled?: boolean;
  /** Glifo Unicode a la izquierda del texto. Nunca un SVG dibujado a mano. */
  icon?: React.ReactNode;
  children?: React.ReactNode;
}

export function Button(props: ButtonProps): JSX.Element;
