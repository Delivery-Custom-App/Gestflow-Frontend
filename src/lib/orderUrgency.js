// Urgencia de comandas en cocina: tiempo transcurrido desde created_at -> color continuo.
// MANTENER EN SYNC CON src/index.css (tokens --success/--warning/--destructive)

export const URGENCY_STOPS_MIN = { CALM: 0, WARN: 8, HIGH: 15, CRITICAL: 20, CRITICAL_CAP: 30 }
export const DELAY_THRESHOLD_MIN = URGENCY_STOPS_MIN.CRITICAL
export const READY_DISMISS_SECS = 120

// Duplicado de src/index.css (no se lee getComputedStyle: jsdom no resuelve hojas de
// estilo externas de forma confiable en tests, y leer el DOM en cada tick de 1s por
// tarjeta sería costo innecesario para valores estáticos).
const TOKENS = {
  light: {
    success: { h: 149, s: 53, l: 49 },
    warning: { h: 38, s: 89, l: 54 },
    destructive: { h: 354, s: 79, l: 57 },
  },
  dark: {
    success: { h: 149, s: 50, l: 55 },
    warning: { h: 38, s: 89, l: 54 },
    destructive: { h: 354, s: 70, l: 50 },
  },
}

export function elapsedMinutesSinceCreated(order, now = Date.now()) {
  const createdMs = new Date(order?.created_at).getTime()
  if (Number.isNaN(createdMs)) return 0
  return Math.max(0, (now - createdMs) / 60000)
}

export function elapsedSecondsSinceCreated(order, now = Date.now()) {
  return Math.round(elapsedMinutesSinceCreated(order, now) * 60)
}

export function urgencyRatio(elapsedMin) {
  const stops = URGENCY_STOPS_MIN
  if (elapsedMin <= stops.WARN) return 0
  if (elapsedMin <= stops.HIGH) {
    return 0.5 * (elapsedMin - stops.WARN) / (stops.HIGH - stops.WARN)
  }
  if (elapsedMin <= stops.CRITICAL) {
    return 0.5 + 0.5 * (elapsedMin - stops.HIGH) / (stops.CRITICAL - stops.HIGH)
  }
  return 1
}

function lerp(a, b, t) {
  return a + (b - a) * t
}

// Interpola el matiz por el camino más corto del círculo cromático (evita cruzar
// verde/azul/violeta al ir de --warning, 38°, a --destructive, 354°: la diferencia
// directa es de 316°, pero el camino corto por rojo-naranja es de solo 44°).
function lerpHue(a, b, t) {
  const diff = ((b - a + 540) % 360) - 180
  return (a + diff * t + 360) % 360
}

function hslToCss(hsl) {
  return `hsl(${hsl.h} ${hsl.s}% ${hsl.l}%)`
}

export function getUrgencyColor(elapsedMin, theme) {
  const t = TOKENS[theme === 'dark' ? 'dark' : 'light']
  const ratio = urgencyRatio(elapsedMin)

  let hsl
  if (ratio <= 0.5) {
    const step = ratio / 0.5
    hsl = {
      h: lerpHue(t.success.h, t.warning.h, step),
      s: lerp(t.success.s, t.warning.s, step),
      l: lerp(t.success.l, t.warning.l, step),
    }
  } else {
    const step = (ratio - 0.5) / 0.5
    hsl = {
      h: lerpHue(t.warning.h, t.destructive.h, step),
      s: lerp(t.warning.s, t.destructive.s, step),
      l: lerp(t.warning.l, t.destructive.l, step),
    }
  }

  const stops = URGENCY_STOPS_MIN
  const intensity = Math.min(1, Math.max(0, (elapsedMin - stops.CRITICAL) / (stops.CRITICAL_CAP - stops.CRITICAL)))
  if (intensity > 0) {
    hsl = {
      h: hsl.h,
      s: Math.min(100, lerp(t.destructive.s, 100, intensity)),
      l: lerp(t.destructive.l, Math.max(30, t.destructive.l - 12), intensity),
    }
  }

  return { css: hslToCss(hsl), ratio, intensity, hsl }
}

export function getUrgencyLevel(elapsedMin) {
  const stops = URGENCY_STOPS_MIN
  if (elapsedMin <= stops.WARN) return 'calm'
  if (elapsedMin <= stops.HIGH) return 'warning'
  if (elapsedMin <= stops.CRITICAL) return 'high'
  return 'critical'
}

export function getReadableTextClass(hsl) {
  return hsl.l >= 60 ? 'text-[#0D0D1F]' : 'text-white'
}
