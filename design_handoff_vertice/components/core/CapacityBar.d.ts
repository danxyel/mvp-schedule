import * as React from 'react';

/** Ocupación de una sesión con plazas. Con cupo 1 no dibuja relleno y escribe "Agenda abierta". */
export interface CapacityBarProps {
  ocupados?: number;
  cupo?: number;
  /** Debe coincidir con el color del servicio al que pertenece */
  tone?: 'accent' | 'accent2' | 'neutral';
  showCount?: boolean;
  style?: React.CSSProperties;
}

export function CapacityBar(props: CapacityBarProps): JSX.Element;
