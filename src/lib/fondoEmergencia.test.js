/** Fondo de emergencia (T-26 · T-27): rutas y cuerpos del contrato B-09 y validaciones. */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { apiRequest } from './apiClient'
import {
  corregirGasto, crearFondo, definirMontoFijo, faltaReponer, fechaCorta, getFondo, hoyEnChile, listarHistorial,
  mapFondo, mensajeDeErrorDelFondo, montoDesdeTexto, porCorregir, puedeManejarFondo, registrarMovimiento,
  sePuedeCorregir, tieneFondo, validarAjuste, validarMontoFijo, validarMovimiento,
} from './fondoEmergencia'

vi.mock('./apiClient', () => ({ apiRequest: vi.fn() }))

const RAW = {
  local_id: 'loc-1', monto_fijo: '50000.00', saldo: '42000.00', semana_inicio: '2026-10-12', semana_fin: '2026-10-18',
  gastado_semana: '8000.00', fecha_minima: '2026-10-12',
  movimientos: [{ id: 'g1', tipo: 'gasto', monto: '8000.00', motivo: 'Gas', fecha: '2026-10-14', registrado_en: '2026-10-14T15:00:00Z', registrado_por_email: 'enc@x.cl', corrige_id: null, ajustado: '0' }],
}
const rutas = () => apiRequest.mock.calls.map(([r, o]) => `${o?.method || 'GET'} ${r}`)

beforeEach(() => { vi.clearAllMocks() })

describe('rutas del contrato nuevo (no /emergency-funds)', () => {
  it('lee el fondo con GET /locals/{id}/fondo-emergencia y lo pasa a números', async () => {
    apiRequest.mockResolvedValue(RAW)
    const f = await getFondo('loc 1')
    expect(apiRequest).toHaveBeenCalledWith('/locals/loc%201/fondo-emergencia')
    expect(f).toMatchObject({ montoFijo: 50000, saldo: 42000, gastadoSemana: 8000, fechaMinima: '2026-10-12' })
    expect(f.movimientos[0]).toMatchObject({ id: 'g1', tipo: 'gasto', monto: 8000, registradoPor: 'enc@x.cl', ajustado: 0 })
  })

  it('crear el fondo: PUT del monto fijo y una reposición por ese monto con la fecha de hoy', async () => {
    apiRequest.mockResolvedValue(RAW)
    await crearFondo('loc-1', 50000, { hoy: '2026-10-14' })
    expect(rutas()).toEqual([
      'PUT /locals/loc-1/fondo-emergencia',
      'POST /locals/loc-1/fondo-emergencia/movimientos',
      'GET /locals/loc-1/fondo-emergencia',
    ])
    expect(apiRequest.mock.calls[0][1].body).toEqual({ monto_fijo: '50000' })
    expect(apiRequest.mock.calls[1][1].body).toEqual({ tipo: 'reposicion', monto: '50000', motivo: 'Fondo inicial', fecha: '2026-10-14' })
  })

  it('cambiar el monto fijo usa PUT', async () => {
    apiRequest.mockResolvedValue(RAW)
    await definirMontoFijo('loc-1', 60000)
    expect(apiRequest).toHaveBeenCalledWith('/locals/loc-1/fondo-emergencia', { method: 'PUT', body: { monto_fijo: '60000' } })
  })

  it('un gasto o una reposición va con tipo, monto, motivo y fecha', async () => {
    apiRequest.mockResolvedValue(RAW.movimientos[0])
    await registrarMovimiento('loc-1', { tipo: 'gasto', monto: 8000, motivo: '  Gas  ', fecha: '2026-10-14' })
    expect(apiRequest).toHaveBeenCalledWith('/locals/loc-1/fondo-emergencia/movimientos', {
      method: 'POST', body: { tipo: 'gasto', monto: '8000', motivo: 'Gas', fecha: '2026-10-14' },
    })
  })

  it('la reposición sin nota manda motivo null', async () => {
    apiRequest.mockResolvedValue(RAW.movimientos[0])
    await registrarMovimiento('loc-1', { tipo: 'reposicion', monto: 5000, motivo: '', fecha: '2026-10-14' })
    expect(apiRequest.mock.calls[0][1].body.motivo).toBeNull()
  })

  it('corregir un gasto: POST …/movimientos/{id}/ajustes con monto y motivo', async () => {
    apiRequest.mockResolvedValue({ ...RAW.movimientos[0], id: 'a1', tipo: 'ajuste', corrige_id: 'g1' })
    const aj = await corregirGasto('loc-1', 'g1', { monto: 3000, motivo: 'Se anotó de más' })
    expect(apiRequest).toHaveBeenCalledWith('/locals/loc-1/fondo-emergencia/movimientos/g1/ajustes', {
      method: 'POST', body: { monto: '3000', motivo: 'Se anotó de más' },
    })
    expect(aj.corrigeId).toBe('g1')
  })

  it('el historial pide una página y lee el total de X-Total-Count', async () => {
    apiRequest.mockResolvedValue({ data: [RAW.movimientos[0]], total: 37 })
    const r = await listarHistorial('loc-1', { limit: 20, offset: 20 })
    expect(apiRequest).toHaveBeenCalledWith('/locals/loc-1/fondo-emergencia/movimientos?limit=20&offset=20', { withTotal: true })
    expect(r.total).toBe(37)
    expect(r.movimientos).toHaveLength(1)
  })

  it('ninguna llamada usa la ruta vieja /emergency-funds', async () => {
    apiRequest.mockResolvedValue(RAW)
    await getFondo('loc-1')
    await crearFondo('loc-1', 1000, { hoy: '2026-10-14' })
    expect(rutas().some((r) => r.includes('emergency-funds'))).toBe(false)
  })
})

describe('estado y cálculos', () => {
  it('sin fondo: el backend responde monto fijo 0 y sin movimientos', () => {
    const vacio = mapFondo({ ...RAW, monto_fijo: '0', saldo: '0', gastado_semana: '0', movimientos: [] })
    expect(tieneFondo(vacio)).toBe(false)
    expect(tieneFondo(mapFondo(RAW))).toBe(true)
  })

  it('cuánto falta reponer y cuánto queda por corregir', () => {
    expect(faltaReponer(mapFondo(RAW))).toBe(8000)
    expect(faltaReponer({ montoFijo: 1000, saldo: 3000 })).toBe(0)
    expect(porCorregir({ monto: 8000, ajustado: 3000 })).toBe(5000)
  })

  it('solo se corrigen gastos con algo por corregir y dentro de la ventana', () => {
    const gasto = { tipo: 'gasto', monto: 8000, ajustado: 0, fecha: '2026-10-14' }
    expect(sePuedeCorregir(gasto, '2026-10-12')).toBe(true)
    expect(sePuedeCorregir({ ...gasto, ajustado: 8000 }, '2026-10-12')).toBe(false)
    expect(sePuedeCorregir({ ...gasto, fecha: '2026-10-05' }, '2026-10-12')).toBe(false)
    expect(sePuedeCorregir({ ...gasto, tipo: 'reposicion' }, '2026-10-12')).toBe(false)
  })

  it('fechas: hoy en Chile y formato corto', () => {
    expect(hoyEnChile(new Date('2026-10-15T02:00:00Z'))).toBe('2026-10-14')
    expect(fechaCorta('2026-10-14')).toBe('14/10/2026')
    expect(montoDesdeTexto('50.000')).toBe(50000)
  })

  it('solo el dueño, el encargado y el superadmin ven el fondo', () => {
    expect(puedeManejarFondo('Admin Negocio')).toBe(true)
    expect(puedeManejarFondo('Admin')).toBe(true)
    expect(puedeManejarFondo('Empleado')).toBe(false)
  })
})

describe('validaciones', () => {
  const base = { tipo: 'gasto', monto: 1000, motivo: 'Gas', fecha: '2026-10-14', fechaMinima: '2026-10-12', hoy: '2026-10-14', saldo: 5000 }
  it('gasto válido', () => { expect(validarMovimiento(base)).toBeNull() })
  it('monto mayor que 0', () => { expect(validarMovimiento({ ...base, monto: 0 })).toMatch(/mayor que 0/) })
  it('el gasto exige motivo; la reposición no', () => {
    expect(validarMovimiento({ ...base, motivo: ' ' })).toMatch(/motivo/)
    expect(validarMovimiento({ ...base, tipo: 'reposicion', motivo: '' })).toBeNull()
  })
  it('motivo de hasta 200 caracteres', () => { expect(validarMovimiento({ ...base, motivo: 'x'.repeat(201) })).toMatch(/200/) })
  it('la fecha va de fecha_minima a hoy', () => {
    expect(validarMovimiento({ ...base, fecha: '2026-10-15' })).toMatch(/futura/)
    expect(validarMovimiento({ ...base, fecha: '2026-10-11' })).toMatch(/desde el 12\/10\/2026/)
  })
  it('un gasto no deja el saldo en negativo', () => { expect(validarMovimiento({ ...base, monto: 6000 })).toMatch(/negativo/) })
  it('monto fijo mayor que 0', () => { expect(validarMontoFijo(0)).toBeTruthy(); expect(validarMontoFijo(1)).toBeNull() })
  it('corrección: motivo obligatorio y no más de lo que queda', () => {
    expect(validarAjuste({ monto: 1000, motivo: '', maximo: 5000 })).toMatch(/motivo/)
    expect(validarAjuste({ monto: 6000, motivo: 'x', maximo: 5000 })).toMatch(/mayor/)
    expect(validarAjuste({ monto: 5000, motivo: 'x', maximo: 5000 })).toBeNull()
  })
})

describe('mensajes de error', () => {
  it('muestra el texto del backend sin el código', () => {
    expect(mensajeDeErrorDelFondo(Object.assign(new Error('409: Saldo insuficiente: disponible 100, gasto de 500'), { status: 409, detail: 'Saldo insuficiente: disponible 100, gasto de 500' })))
      .toBe('Saldo insuficiente: disponible 100, gasto de 500')
    expect(mensajeDeErrorDelFondo(new Error('400: La fecha del movimiento no puede ser futura'))).toBe('La fecha del movimiento no puede ser futura')
  })
  it('403 sin detalle: permiso', () => {
    expect(mensajeDeErrorDelFondo(Object.assign(new Error('403 Forbidden'), { status: 403 }))).toMatch(/permiso/)
  })
})
