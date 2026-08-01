import { DayPicker } from '@daypicker/react'
import { es } from '@daypicker/react/locale'

const CLASS_NAMES = {
  root: 'inline-block rounded-xl border border-gray-200 bg-white p-4 shadow-sm',
  months: 'flex',
  month: 'relative w-full',
  month_caption: 'flex h-11 items-center justify-center',
  caption_label: 'text-sm font-semibold capitalize text-gray-900',
  button_previous:
    'absolute left-0 top-0 flex h-11 w-9 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-40',
  button_next:
    'absolute right-0 top-0 flex h-11 w-9 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-40',
  chevron: 'h-4 w-4',
  weekday: 'pb-1 text-center text-xs font-medium uppercase tracking-wide text-gray-400',
  weekdays: '',
  week: '',
  weeks: '',
  month_grid: 'w-full border-collapse',
  day: 'h-9 w-9 p-0 text-center align-middle',
  day_button:
    'flex h-9 w-9 items-center justify-center rounded-full text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-40 [.selected_&]:text-white [.selected_&]:hover:bg-blue-700 [.today_&]:font-semibold',
  selected: 'rounded-full bg-blue-600 shadow-sm',
  today: '',
  outside: 'text-gray-300',
  disabled: '',
  hidden: 'hidden',
  focused: '',
}

export default function SelectorFecha({ value, onChange, minDate, className = '' }) {
  return (
    <DayPicker
      mode="single"
      selected={value ?? undefined}
      onSelect={(day) => {
        if (day) onChange(day)
      }}
      locale={es}
      defaultMonth={value ?? minDate ?? undefined}
      disabled={minDate ? { before: minDate } : undefined}
      numberOfMonths={1}
      className={className}
      classNames={CLASS_NAMES}
    />
  )
}
