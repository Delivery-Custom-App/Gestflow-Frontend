import { describe, it, expect } from 'vitest'
import {
  URGENCY_STOPS_MIN,
  elapsedMinutesSinceCreated,
  urgencyRatio,
  getUrgencyColor,
  getUrgencyLevel,
  getReadableTextClass,
} from './orderUrgency'

describe('orderUrgency', () => {
  it('elapsedMinutesSinceCreated nunca es negativo (created_at futuro o inválido)', () => {
    const now = Date.now()
    expect(elapsedMinutesSinceCreated({ created_at: new Date(now + 60000).toISOString() }, now)).toBe(0)
    expect(elapsedMinutesSinceCreated({ created_at: 'no-es-fecha' }, now)).toBe(0)
    expect(elapsedMinutesSinceCreated({ created_at: new Date(now - 5 * 60000).toISOString() }, now)).toBeCloseTo(5, 5)
  })

  it('urgencyRatio: calma hasta WARN, 0.5 en HIGH, 1 desde CRITICAL, monótona creciente', () => {
    expect(urgencyRatio(0)).toBe(0)
    expect(urgencyRatio(URGENCY_STOPS_MIN.WARN)).toBe(0)
    expect(urgencyRatio(URGENCY_STOPS_MIN.HIGH)).toBe(0.5)
    expect(urgencyRatio(URGENCY_STOPS_MIN.CRITICAL)).toBe(1)
    expect(urgencyRatio(URGENCY_STOPS_MIN.CRITICAL + 100)).toBe(1)

    const points = [0, 2, 8, 10, 13, 15, 17, 20, 25]
    let prev = -1
    for (const min of points) {
      const ratio = urgencyRatio(min)
      expect(ratio).toBeGreaterThanOrEqual(prev)
      prev = ratio
    }
  })

  it('getUrgencyColor: extremos coinciden con los tokens success/destructive', () => {
    const calm = getUrgencyColor(0, 'light')
    expect(calm.hsl).toEqual({ h: 149, s: 53, l: 49 })

    const critical = getUrgencyColor(URGENCY_STOPS_MIN.CRITICAL, 'light')
    expect(critical.hsl).toEqual({ h: 354, s: 79, l: 57 })
  })

  it('getUrgencyColor: más allá de CRITICAL intensifica saturación sin cambiar el matiz', () => {
    const at20 = getUrgencyColor(20, 'light')
    const at30 = getUrgencyColor(URGENCY_STOPS_MIN.CRITICAL_CAP, 'light')
    expect(at30.hsl.h).toBe(at20.hsl.h)
    expect(at30.hsl.s).toBeGreaterThan(at20.hsl.s)
  })

  it('getUrgencyColor: dark y light difieren en los extremos', () => {
    const light = getUrgencyColor(0, 'light')
    const dark = getUrgencyColor(0, 'dark')
    expect(dark.hsl).not.toEqual(light.hsl)
  })

  it('getUrgencyLevel: mapea los 4 niveles en los bordes de cada umbral', () => {
    expect(getUrgencyLevel(URGENCY_STOPS_MIN.WARN)).toBe('calm')
    expect(getUrgencyLevel(URGENCY_STOPS_MIN.WARN + 0.01)).toBe('warning')
    expect(getUrgencyLevel(URGENCY_STOPS_MIN.HIGH)).toBe('warning')
    expect(getUrgencyLevel(URGENCY_STOPS_MIN.HIGH + 0.01)).toBe('high')
    expect(getUrgencyLevel(URGENCY_STOPS_MIN.CRITICAL)).toBe('high')
    expect(getUrgencyLevel(URGENCY_STOPS_MIN.CRITICAL + 0.01)).toBe('critical')
  })

  it('getReadableTextClass: alterna según luminosidad', () => {
    expect(getReadableTextClass({ l: 65 })).toBe('text-[#0D0D1F]')
    expect(getReadableTextClass({ l: 40 })).toBe('text-white')
  })
})
