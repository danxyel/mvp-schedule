import * as React from 'react';

/**
 * Cifra de consulta: saldo de bonos, gasto del mes, código de reserva. Solo lectura.
 * @startingPoint section="Registros" subtitle="Cifras de saldo, gasto y movimientos" viewport="700x260"
 */
export interface StatCardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Versalitas, 10px: "Saldo disponible", "Gasto del mes" */
  label: string;
  /** Ya formateado y con unidad: "7 clases", "$2,160" */
  value: string;
  /** Vigencia o desglose: "Vence el 30 nov" */
  nota?: string;
}

export function StatCard(props: StatCardProps): JSX.Element;
