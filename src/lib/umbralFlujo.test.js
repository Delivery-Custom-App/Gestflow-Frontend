import { describe, it, expect, beforeEach } from 'vitest'
import {
  UMBRAL_KEY, UMBRAL_POR_DEFECTO, cargarUmbral, errorDeUmbral, esVenta, getFlowTrend, getSalesFlow,
  guardarUmbral, rangoDelPeriodo, textoDelPeriodo,
} from './umbralFlujo'

beforeEach(() => localStorage.clear())

describe('cargarUmbral / guardarUmbral', () => {
  it('por defecto: 1 hora', () => {
    expect(cargarUmbral()).toEqual(UMBRAL_POR_DEFECTO)
    expect(UMBRAL_POR_DEFECTO.horas).toBe(1)
  })

  it('guarda y vuelve a leer el mismo umbral (uno solo, para todos los locales)', () => {
    guardarUmbral({ horas: 3, medium: 8, high: 20, extra: 'x' })
    expect(JSON.parse(localStorage.getItem(UMBRAL_KEY))).toEqual({ horas: 3, medium: 8, high: 20 })
    expect(cargarUmbral()).toEqual({ horas: 3, medium: 8, high: 20 })
  })

  it('los valores por defecto de antes (20/50 para 24 h, con "días") pasan a los nuevos', () => {
    localStorage.setItem(UMBRAL_KEY, JSON.stringify({ medium: 20, high: 50, salesDays: 7 }))
    expect(cargarUmbral()).toEqual(UMBRAL_POR_DEFECTO)
  })

  it('un umbral propio de antes se conserva, con período de 1 hora', () => {
    localStorage.setItem(UMBRAL_KEY, JSON.stringify({ medium: 3, high: 9, salesDays: 7 }))
    expect(cargarUmbral()).toEqual({ horas: 1, medium: 3, high: 9 })
  })

  it('un dato roto vuelve al valor por defecto', () => {
    localStorage.setItem(UMBRAL_KEY, '{no es json')
    expect(cargarUmbral()).toEqual(UMBRAL_POR_DEFECTO)
    localStorage.setItem(UMBRAL_KEY, JSON.stringify({ medium: 10, high: 5 }))
    expect(cargarUmbral()).toEqual(UMBRAL_POR_DEFECTO)
  })
})

describe('errorDeUmbral', () => {
  it('período de 1 a 168 horas y medio menor que alto', () => {
    expect(errorDeUmbral({ horas: 1, medium: 5, high: 15 })).toBeNull()
    expect(errorDeUmbral({ horas: 0, medium: 5, high: 15 })).toMatch(/1 a 168 horas/)
    expect(errorDeUmbral({ horas: 1.5, medium: 5, high: 15 })).toMatch(/1 a 168 horas/)
    expect(errorDeUmbral({ horas: 1, medium: 0, high: 15 })).toMatch(/enteros mayores que 0/)
    expect(errorDeUmbral({ horas: 1, medium: 15, high: 15 })).toMatch(/menor que el de flujo alto/)
  })
})

describe('período', () => {
  it('el rango termina ahora y empieza N horas antes', () => {
    const ahora = new Date('2026-10-05T15:00:00Z')
    const { desde, hasta } = rangoDelPeriodo(3, ahora)
    expect(hasta).toBe(ahora)
    expect(desde.toISOString()).toBe('2026-10-05T12:00:00.000Z')
  })

  it('se lee en palabras', () => {
    expect(textoDelPeriodo(1)).toBe('la última hora')
    expect(textoDelPeriodo(4)).toBe('las últimas 4 horas')
  })
})

describe('colores y flecha', () => {
  const umbral = { horas: 1, medium: 5, high: 15 }

  it('bajo, medio y alto según el umbral', () => {
    expect(getSalesFlow(4, umbral).label).toBe('Bajo')
    expect(getSalesFlow(5, umbral).label).toBe('Medio')
    expect(getSalesFlow(15, umbral).label).toBe('Alto')
    expect(getSalesFlow(undefined, umbral)).toBeNull()
  })

  it('la flecha compara la última hora con la anterior y solo aparece si cambia de color', () => {
    // Período de 1 hora: ahora 6 ventas (medio), la hora anterior 2 (bajo) → subió.
    expect(getFlowTrend(6, { current: 6, prev: 2 }, umbral)).toBe('up')
    expect(getFlowTrend(2, { current: 2, prev: 7 }, umbral)).toBe('down')
    expect(getFlowTrend(6, { current: 6, prev: 5 }, umbral)).toBeNull()
  })

  it('una venta es una orden no cancelada', () => {
    expect(esVenta({ status: 'completed' })).toBe(true)
    expect(esVenta({ status: 'open' })).toBe(true)
    expect(esVenta({ status: 'cancelled' })).toBe(false)
  })
})
