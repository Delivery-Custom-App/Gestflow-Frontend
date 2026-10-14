/** Supervisión del administrador (T-42). */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { apiRequest } from './apiClient'
import {
  MENSAJE_SOLO_QUIEN_ABRIO, empleadosConTurnoHoy, forzarTermino, liberarMaquina, pideReasignar, reasignarOrden,
  traducirErrorCobro, validarMotivo,
} from './supervision'

vi.mock('./apiClient', () => ({ apiRequest: vi.fn() }))

beforeEach(() => { vi.clearAllMocks() })

describe('rutas', () => {
  it('liberar máquina con motivo', async () => {
    apiRequest.mockResolvedValue({ pos_machine_id: 'pm1', turnos_liberados: ['t1', 't2'] })
    await liberarMaquina('pm1', ' Sin batería ')
    expect(apiRequest).toHaveBeenCalledWith('/pos-machines/pm1/liberar', { method: 'POST', body: { motivo: 'Sin batería' } })
  })
  it('forzar término con motivo y, si viene, a quién reasignar', async () => {
    apiRequest.mockResolvedValue({})
    await forzarTermino('c1', { motivo: 'Emergencia' })
    await forzarTermino('c1', { motivo: 'Emergencia', reasignarAUserId: 'u2' })
    expect(apiRequest.mock.calls.map(([, o]) => o.body)).toEqual([
      { motivo: 'Emergencia' },
      { motivo: 'Emergencia', reasignar_a_user_id: 'u2' },
    ])
    expect(apiRequest.mock.calls[0][0]).toBe('/cajas/c1/forzar-termino')
  })
  it('T-54: con cerrarSesion manda cerrar_sesion: true', async () => {
    apiRequest.mockResolvedValue({})
    await forzarTermino('c1', { motivo: 'Perdió el celular', cerrarSesion: true })
    expect(apiRequest.mock.calls[0][1].body).toEqual({ motivo: 'Perdió el celular', cerrar_sesion: true })
  })
  it('reasignar una orden con created_at', async () => {
    apiRequest.mockResolvedValue({})
    await reasignarOrden('o1', '2026-10-14T12:00:00Z', { toUserId: 'u2', motivo: 'Cubre' })
    expect(apiRequest).toHaveBeenCalledWith('/orders/o1/reasignar?created_at=2026-10-14T12%3A00%3A00Z', {
      method: 'POST', body: { to_user_id: 'u2', motivo: 'Cubre' },
    })
  })
})

describe('reglas', () => {
  it('el motivo va de 3 a 300 caracteres', () => {
    expect(validarMotivo('ab')).toMatch(/al menos 3/)
    expect(validarMotivo('x'.repeat(301))).toMatch(/300/)
    expect(validarMotivo('Emergencia')).toBeNull()
  })
  it('a quién se le pueden pasar mesas: vendedores con turno abierto hoy, no terminado', () => {
    const usuarios = [
      { id: 'ana', role: 'EMPLEADO', first_name: 'Ana', is_active: true },
      { id: 'beto', role: 'EMPLEADO', first_name: 'Beto', is_active: true },
      { id: 'carla', role: 'EMPLEADO', first_name: 'Carla', is_active: true },
      { id: 'enc', role: 'ADMIN', first_name: 'Elena', is_active: true },
    ]
    const cajas = [
      { cashier_user_id: 'ana', status: 'open', business_date: '2026-10-14' },
      { cashier_user_id: 'beto', status: 'open', business_date: '2026-10-14', turno_terminado_at: '2026-10-14T18:00:00Z' },
      { cashier_user_id: 'carla', status: 'open', business_date: '2026-10-13' },
      { cashier_user_id: 'enc', status: 'open', business_date: '2026-10-14' },
    ]
    expect(empleadosConTurnoHoy(usuarios, cajas, { hoy: '2026-10-14' }).map((u) => u.id)).toEqual(['ana'])
    expect(empleadosConTurnoHoy(usuarios, cajas, { hoy: '2026-10-14', excepto: 'ana' })).toEqual([])
  })
  it('detecta el 409 que pide a quién reasignar', () => {
    expect(pideReasignar({ status: 409, detail: 'El turno tiene 1 mesa(s) o pedido(s) abiertos: indica a qué empleado se reasignan (reasignar_a_user_id)' })).toBe(true)
    expect(pideReasignar({ status: 409, detail: 'Otra cosa' })).toBe(false)
  })
  it('el 403 al cobrar la mesa de otro se explica con la sugerencia', () => {
    const err = traducirErrorCobro(Object.assign(new Error('403: x'), { status: 403, detail: 'Solo quien abrió la mesa puede cobrarla. Si no está, el administrador la reasigna' }))
    expect(err.message).toBe(MENSAJE_SOLO_QUIEN_ABRIO)
    const otro = new Error('500')
    expect(traducirErrorCobro(otro)).toBe(otro)
  })
})
