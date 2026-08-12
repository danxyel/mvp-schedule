// Convierte un color primario hex en una escala de 10 pasos --tenant-brand-50..900,
// variando la luminosidad en HSL y manteniendo el tono/saturación.
// Los pesos de luminosidad están pensados para que el 500-600 quede
// cerca del color que el admin realmente eligió.
const PASOS = {
  50: 0.96,
  100: 0.91,
  200: 0.82,
  300: 0.7,
  400: 0.58,
  500: 0.5,
  600: 0.42,
  700: 0.34,
  800: 0.26,
  900: 0.18,
}

function hexToRgb(hex) {
  const limpio = hex.replace('#', '')
  const bigint = parseInt(limpio, 16)
  const r = (bigint >> 16) & 255
  const g = (bigint >> 8) & 255
  const b = bigint & 255
  return { r: r / 255, g: g / 255, b: b / 255 }
}

function rgbToHex(r, g, b) {
  const toHex = (n) => {
    const hex = Math.round(n * 255).toString(16)
    return hex.length === 1 ? `0${hex}` : hex
  }
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

function hexToHsl(hex) {
  const { r, g, b } = hexToRgb(hex)
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2

  if (max === min) {
    return { h: 0, s: 0, l }
  }

  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h = 0
  switch (max) {
    case r:
      h = (g - b) / d + (g < b ? 6 : 0)
      break
    case g:
      h = (b - r) / d + 2
      break
    case b:
      h = (r - g) / d + 4
      break
    default:
      break
  }
  h /= 6

  return { h: h * 360, s, l }
}

function hueToRgb(p, q, t) {
  if (t < 0) t += 1
  if (t > 1) t -= 1
  if (t < 1 / 6) return p + (q - p) * 6 * t
  if (t < 1 / 2) return q
  if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
  return p
}

function hslToHex(h, s, l) {
  if (s === 0) {
    const gray = l
    return rgbToHex(gray, gray, gray)
  }

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q
  const r = hueToRgb(p, q, h / 360 + 1 / 3)
  const g = hueToRgb(p, q, h / 360)
  const b = hueToRgb(p, q, h / 360 - 1 / 3)

  return rgbToHex(r, g, b)
}

export function aplicarTemaTenant(colorPrimarioHex) {
  if (!colorPrimarioHex || !/^#[0-9a-fA-F]{6}$/.test(colorPrimarioHex)) return
  const { h, s } = hexToHsl(colorPrimarioHex)
  const root = document.documentElement
  for (const [paso, luminosidad] of Object.entries(PASOS)) {
    root.style.setProperty(`--tenant-brand-${paso}`, hslToHex(h, s, luminosidad))
  }
}
