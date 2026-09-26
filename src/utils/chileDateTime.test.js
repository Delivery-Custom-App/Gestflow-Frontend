import { describe, it, expect } from 'vitest'
import {
  parseApiDate,
  formatChileTime,
  chileHourFromIso,
  formatChileHour,
  formatPaymentPct,
  paymentMethodLabel,
} from './chileDateTime'

describe('parseApiDate', () => {
  it('null/undefined/vacío → null', () => {
    expect(parseApiDate(null)).toBeNull()
    expect(parseApiDate(undefined)).toBeNull()
    expect(parseApiDate('')).toBeNull()
    expect(parseApiDate('   ')).toBeNull()
  })

  it('ISO sin timezone y con "T" se asume UTC', () => {
    const d = parseApiDate('2026-06-19T00:18:48')
    expect(d.toISOString()).toBe('2026-06-19T00:18:48.000Z')
  })

  it('ISO con Z se respeta tal cual', () => {
    const d = parseApiDate('2026-06-19T00:18:48Z')
    expect(d.toISOString()).toBe('2026-06-19T00:18:48.000Z')
  })

  it('ISO con offset explícito se respeta', () => {
    const d = parseApiDate('2026-06-19T00:18:48-03:00')
    expect(d.toISOString()).toBe('2026-06-19T03:18:48.000Z')
  })

  it('fecha inválida → null', () => {
    expect(parseApiDate('no-es-una-fecha')).toBeNull()
  })
})

describe('formatChileTime', () => {
  it('fecha inválida → "—"', () => {
    expect(formatChileTime(null)).toBe('—')
    expect(formatChileTime('basura')).toBe('—')
  })

  it('formatea una hora válida', () => {
    expect(formatChileTime('2026-06-19T20:18:00Z')).toMatch(/\d{1,2}:\d{2}/)
  })
})

describe('chileHourFromIso', () => {
  it('fecha inválida → null', () => {
    expect(chileHourFromIso(null)).toBeNull()
    expect(chileHourFromIso('basura')).toBeNull()
  })

  it('devuelve un número de hora 0-23', () => {
    const hour = chileHourFromIso('2026-06-19T20:18:00Z')
    expect(typeof hour).toBe('number')
    expect(hour).toBeGreaterThanOrEqual(0)
    expect(hour).toBeLessThanOrEqual(23)
  })
})

describe('formatChileHour', () => {
  it('null/undefined → "—"', () => {
    expect(formatChileHour(null)).toBe('—')
    expect(formatChileHour(undefined)).toBe('—')
  })

  it('hora 0 → 12:00 a.m.', () => {
    expect(formatChileHour(0)).toBe('12:00 a.m.')
  })

  it('hora 12 → 12:00 p.m.', () => {
    expect(formatChileHour(12)).toBe('12:00 p.m.')
  })

  it('hora de la mañana', () => {
    expect(formatChileHour(9)).toBe('9:00 a.m.')
  })

  it('hora de la tarde', () => {
    expect(formatChileHour(21)).toBe('9:00 p.m.')
  })
})

describe('formatPaymentPct', () => {
  it('0, null o negativo → "0%"', () => {
    expect(formatPaymentPct(0)).toBe('0%')
    expect(formatPaymentPct(null)).toBe('0%')
    expect(formatPaymentPct(-1)).toBe('0%')
  })

  it('menor a 1% muestra un decimal', () => {
    expect(formatPaymentPct(0.4)).toBe('0.4%')
  })

  it('mayor o igual a 1% redondea', () => {
    expect(formatPaymentPct(45.6)).toBe('46%')
  })
})

describe('paymentMethodLabel', () => {
  it('mapea métodos conocidos (case-insensitive)', () => {
    expect(paymentMethodLabel('cash')).toBe('Efectivo')
    expect(paymentMethodLabel('EFECTIVO')).toBe('Efectivo')
    expect(paymentMethodLabel('mercadopago_point')).toBe('MercadoPago Point')
  })

  it('método vacío → "—"', () => {
    expect(paymentMethodLabel(null)).toBe('—')
    expect(paymentMethodLabel('')).toBe('—')
  })

  it('método desconocido devuelve la key tal cual', () => {
    expect(paymentMethodLabel('bizum')).toBe('bizum')
  })
})
