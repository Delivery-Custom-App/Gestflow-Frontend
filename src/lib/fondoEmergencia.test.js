import { describe, it, expect, vi, beforeEach } from 'vitest'
import { apiRequest } from './apiClient'
import {
  crearFondo, getFondoDelLocal, listarMovimientos, mensajeDeErrorDelFondo, montoDesdeTexto, puedeManejarFondo,
  registrarMovimiento, validarCreacion, validarMovimiento,
} from './fondoEmergencia'

vi.mock('./apiClient', () => ({ apiRequest: vi.fn() }))

beforeEach(() => vi.clearAllMocks())

describe('quién maneja el fondo', () => {
  it('el dueño y el encargado sí; el vendedor no', () => {
    expect(puedeManejarFondo('Admin Negocio')).toBe(true)
    expect(puedeManejarFondo('Admin')).toBe(true)
    expect(puedeManejarFondo('Superadmin')).toBe(true)
    expect(puedeManejarFondo('Empleado')).toBe(false)
    expect(puedeManejarFondo('Cajero')).toBe(false)
    expect(puedeManejarFondo(null)).toBe(false)
  })
})

describe('validaciones', () => {
  it('montos con o sin puntos de miles', () => {
    expect(montoDesdeTexto('50.000')).toBe(50000)
    expect(montoDesdeTexto('0')).toBe(0)
    expect(montoDesdeTexto('')).toBeNull()
  })

  it('crear: el monto inicial puede ser 0, pero tiene que estar', () => {
    expect(validarCreacion({ montoInicial: 0 })).toBeNull()
    expect(validarCreacion({ montoInicial: null })).toMatch(/monto inicial/)
  })

  it('aporte: monto mayor que 0 y nota opcional', () => {
    expect(validarMovimiento({ tipo: 'aporte', monto: 1000, motivo: '', saldo: 0 })).toBeNull()
    expect(validarMovimiento({ tipo: 'aporte', monto: 0, motivo: '', saldo: 0 })).toMatch(/mayor que 0/)
  })

  it('uso: motivo obligatorio y nunca más de lo que hay', () => {
    expect(validarMovimiento({ tipo: 'uso', monto: 5000, motivo: '  ', saldo: 10000 })).toMatch(/motivo/)
    expect(validarMovimiento({ tipo: 'uso', monto: 15000, motivo: 'cámara de frío', saldo: 10000 })).toMatch(/negativo/)
    expect(validarMovimiento({ tipo: 'uso', monto: 10000, motivo: 'cámara de frío', saldo: 10000 })).toBeNull()
  })

  it('el motivo tiene un largo máximo', () => {
    expect(validarMovimiento({ tipo: 'aporte', monto: 1, motivo: 'x'.repeat(201), saldo: 0 })).toMatch(/200/)
  })
})

describe('mensajes del backend', () => {
  it('traduce sin backend, saldo insuficiente y sin permiso', () => {
    expect(mensajeDeErrorDelFondo(new Error('404: Not Found'))).toMatch(/todavía no está disponible/)
    expect(mensajeDeErrorDelFondo(new Error('409: saldo insuficiente'))).toMatch(/no puede quedar en negativo/)
    expect(mensajeDeErrorDelFondo(new Error('403: No autorizado'))).toMatch(/No tienes permiso/)
    expect(mensajeDeErrorDelFondo(new Error('otra cosa'))).toBe('otra cosa')
  })
})

describe('endpoints (los propuestos en B-09)', () => {
  it('el fondo del local, o null si no tiene', async () => {
    apiRequest.mockResolvedValueOnce([{ id: 'f1', local_id: 'l1', saldo: '20000.00' }])
    expect(await getFondoDelLocal('l1')).toMatchObject({ id: 'f1' })
    expect(apiRequest).toHaveBeenCalledWith('/emergency-funds?local_id=l1')
    apiRequest.mockResolvedValueOnce([])
    expect(await getFondoDelLocal('l1')).toBeNull()
  })

  it('crear, aportar o usar, y el historial', async () => {
    apiRequest.mockResolvedValue({})
    await crearFondo('l1', 0)
    expect(apiRequest).toHaveBeenLastCalledWith('/emergency-funds', { method: 'POST', body: { local_id: 'l1', monto_inicial: 0 } })

    await registrarMovimiento('f1', { tipo: 'uso', monto: 5000, motivo: '  cámara de frío ' })
    expect(apiRequest).toHaveBeenLastCalledWith('/emergency-funds/f1/movements', { method: 'POST', body: { tipo: 'uso', monto: 5000, motivo: 'cámara de frío' } })

    await registrarMovimiento('f1', { tipo: 'aporte', monto: 1000, motivo: '' })
    expect(apiRequest.mock.lastCall[1].body.motivo).toBeNull()

    apiRequest.mockResolvedValueOnce([{ id: 'm1' }])
    expect(await listarMovimientos('f1')).toEqual([{ id: 'm1' }])
    expect(apiRequest).toHaveBeenLastCalledWith('/emergency-funds/f1/movements?limit=100&offset=0')
  })
})
