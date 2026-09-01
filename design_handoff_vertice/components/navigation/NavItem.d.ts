import * as React from 'react';

/**
 * Un destino de navegación. El mismo componente en tres formas según el ancho:
 * barra inferior (< 640px), rail de iconos (640–1023px), sidebar con etiquetas (>= 1024px).
 */
export interface NavItemProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** bar = barra inferior móvil · rail = columna de 84px · sidebar = columna de 244px */
  mode?: 'bar' | 'rail' | 'sidebar';
  /** Glifo Unicode: ＋ ▤ ◇ ▦ */
  icon?: React.ReactNode;
  label?: string;
  /** Contador vivo (p. ej. saldo de bonos). Solo se muestra en modo sidebar. */
  badge?: string | number;
  active?: boolean;
}

export function NavItem(props: NavItemProps): JSX.Element;
