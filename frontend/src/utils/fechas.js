export function getLocalOffset() {
  const offset = -new Date().getTimezoneOffset()
  const sign = offset >= 0 ? '+' : '-'
  const hours = String(Math.floor(Math.abs(offset) / 60)).padStart(2, '0')
  const mins = String(Math.abs(offset) % 60).padStart(2, '0')
  return `${sign}${hours}:${mins}`
}
