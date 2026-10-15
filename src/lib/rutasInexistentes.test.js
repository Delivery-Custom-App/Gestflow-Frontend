/** T-39: el front no llama a rutas que Backend V2 no tiene. */
import { describe, it, expect } from 'vitest'
import { V2_FEATURES } from './v2Features'

const fuentes = import.meta.glob(['../**/*.{js,jsx}', '!../**/*.test.{js,jsx}'], {
  query: '?raw', import: 'default', eager: true,
})
const LLAMADA = /(?:apiRequest|fetch|EventSource)\([^)]*\/(?:api\/)?(alerts|printers|dashboard\/local)\b/

describe('rutas inexistentes (T-39)', () => {
  it('ningún archivo llama a /alerts, /printers ni /dashboard/local', () => {
    const conLlamada = Object.entries(fuentes)
      .filter(([, codigo]) => LLAMADA.test(codigo))
      .map(([ruta]) => ruta)
    expect(Object.keys(fuentes).length).toBeGreaterThan(50)
    expect(conLlamada).toEqual([])
  })

  it('sus banderas ya no existen y pagos divididos y compras semanales siguen apagadas', () => {
    expect(V2_FEATURES).not.toHaveProperty('printers')
    expect(V2_FEATURES).not.toHaveProperty('alerts')
    expect(V2_FEATURES).not.toHaveProperty('adminDashboard')
    expect(V2_FEATURES.splitPayments).toBe(false)
    expect(V2_FEATURES.weeklyPurchases).toBe(false)
  })
})
