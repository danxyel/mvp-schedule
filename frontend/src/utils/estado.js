// Tonos de estado del design system Vértice: cada color tiene un solo trabajo
// (indigo = interacción/disponibilidad, turquesa = positivo, ámbar = aviso,
// slate = neutro). El sistema no define un color de error, así que los estados
// que ya no requieren acción del usuario (cancelada, no show, procesando,
// completada) se tratan como neutros en vez de inventar un quinto acento.
export const ESTADO_TONE = {
  confirmada: 'positive',
  en_espera: 'warn',
  pendiente: 'idle',
  cancelada: 'idle',
  completada: 'idle',
  no_show: 'idle',
}

const TONE_BADGE_CLASS = {
  accent: 'bg-indigo-100 text-indigo-700 border-indigo-300',
  positive: 'bg-teal-100 text-teal-800 border-teal-300',
  warn: 'bg-amber-100 text-amber-700 border-amber-300',
  idle: 'bg-slate-100 text-slate-600 border-slate-300',
}

export const BADGE_BASE_CLASS =
  'inline-flex shrink-0 items-center rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[.12em]'

export function badgeClassForTone(tone) {
  return `${BADGE_BASE_CLASS} ${TONE_BADGE_CLASS[tone] ?? TONE_BADGE_CLASS.idle}`
}

export function badgeClassForEstado(estado) {
  return badgeClassForTone(ESTADO_TONE[estado] ?? 'idle')
}

export const ESTADO_LABEL = {
  confirmada: 'Confirmada',
  en_espera: 'En espera de pago',
  pendiente: 'Procesando...',
  cancelada: 'Cancelada',
  completada: 'Completada',
  no_show: 'No asistió',
}

export const PAGO_LABEL = {
  pendiente: 'Pago pendiente',
  completado: 'Pagado',
  reembolsado: 'Reembolsado',
  exento: 'Sin costo',
}
