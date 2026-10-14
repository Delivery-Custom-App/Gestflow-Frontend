import { describe, it, expect, vi, beforeEach } from 'vitest'
import { apiRequest } from './apiClient'
import {
  atencionDeMesa, fueTraspasada, nombreDePersona, traspasarMesas, vendedoresDelLocal,
} from './atencionMesas'

vi.mock('./apiClient', () => ({ apiRequest: vi.fn(), listUsers: vi.fn() }))
vi.mock('./salesApi', () => ({ listCajas: vi.fn() }))

const TURNOS = new Map([['caja-ana', 'ana'], ['caja-beto', 'beto']])
const mesa = (ordenes) => ({ id: 'm1', name: 'Mesa 1', ordenes_en_curso: ordenes })

beforeEach(() => vi.clearAllMocks())

describe('atencionDeMesa', () => {
  it('la atiende el mesero registrado; la abrió el dueño del turno', () => {
    const info = atencionDeMesa(mesa([{ id: 'o1', caja_id: 'caja-ana', waiter_user_id: 'ana' }]), TURNOS)
    expect(info).toMatchObject({ atiendeId: 'ana', abrioId: 'ana' })
    expect(fueTraspasada(info)).toBe(false)
  })

  it('traspasada: la atiende otro que quien la abrió', () => {
    const info = atencionDeMesa(mesa([{ id: 'o1', caja_id: 'caja-ana', waiter_user_id: 'beto' }]), TURNOS)
    expect(info).toMatchObject({ atiendeId: 'beto', abrioId: 'ana' })
    expect(fueTraspasada(info)).toBe(true)
  })

  it('una orden sin mesero (de antes) la atiende quien abrió el turno', () => {
    const info = atencionDeMesa(mesa([{ id: 'o1', caja_id: 'caja-ana', waiter_user_id: null }]), TURNOS)
    expect(info.atiendeId).toBe('ana')
  })

  it('sin saber de quién es el turno, no afirma un traspaso', () => {
    const info = atencionDeMesa(mesa([{ id: 'o1', caja_id: 'caja-ajena', waiter_user_id: 'beto' }]), TURNOS)
    expect(info).toMatchObject({ atiendeId: 'beto', abrioId: null })
    expect(fueTraspasada(info)).toBe(false)
  })

  it('una mesa libre no tiene atención', () => {
    expect(atencionDeMesa(mesa([]), TURNOS)).toBeNull()
  })
})

describe('nombreDePersona', () => {
  const usuariosPorId = new Map([['ana', { id: 'ana', first_name: 'Ana', last_name: 'Rojas' }]])

  it('"Tú" para uno mismo, el nombre si se conoce y "Otro vendedor" si no', () => {
    expect(nombreDePersona('yo', { yoId: 'yo', usuariosPorId })).toBe('Tú')
    expect(nombreDePersona('ana', { yoId: 'yo', usuariosPorId })).toBe('Ana Rojas')
    // El vendedor no puede leer a sus compañeros.
    expect(nombreDePersona('beto', { yoId: 'yo', usuariosPorId: new Map() })).toBe('Otro vendedor')
  })
})

describe('vendedoresDelLocal', () => {
  it('solo los vendedores activos del local, por nombre', () => {
    const usuarios = [
      { id: 'b', role: 'EMPLEADO', local_id: 'l1', first_name: 'Beto' },
      { id: 'a', role: 'EMPLEADO', local_id: 'l1', first_name: 'Ana' },
      { id: 'enc', role: 'ADMIN', local_id: 'l1', first_name: 'Encargada' },
      { id: 'otro', role: 'EMPLEADO', local_id: 'l2', first_name: 'Carla' },
      { id: 'baja', role: 'EMPLEADO', local_id: 'l1', first_name: 'Dani', is_active: false },
    ]
    expect(vendedoresDelLocal(usuarios, 'l1')).toEqual([{ id: 'a', nombre: 'Ana' }, { id: 'b', nombre: 'Beto' }])
  })
})

describe('traspasarMesas', () => {
  const m1 = { mesa: { id: 'm1', name: 'Mesa 1' }, ordenes: [{ id: 'o1', created_at: '2026-10-04T12:00:00Z' }, { id: 'o2' }] }
  const m2 = { mesa: { id: 'm2', name: 'Mesa 2' }, ordenes: [{ id: 'o3' }] }

  it('T-42: reasigna cada orden en curso con POST …/reasignar, el empleado y el motivo', async () => {
    apiRequest.mockResolvedValue({})
    expect(await traspasarMesas([m1, m2], 'beto', 'Cubre la terraza')).toEqual([])

    const cuerpo = { method: 'POST', body: { to_user_id: 'beto', motivo: 'Cubre la terraza' } }
    expect(apiRequest).toHaveBeenCalledWith('/orders/o1/reasignar?created_at=2026-10-04T12%3A00%3A00Z', cuerpo)
    expect(apiRequest).toHaveBeenCalledWith('/orders/o2/reasignar', cuerpo)
    expect(apiRequest).toHaveBeenCalledWith('/orders/o3/reasignar', cuerpo)
  })

  it('si una mesa falla (409), sigue con las demás y dice cuál no se pudo', async () => {
    apiRequest.mockImplementation((ruta) => (ruta.startsWith('/orders/o1') ? Promise.reject(Object.assign(new Error('409: x'), { detail: 'La orden ya está cobrada' })) : Promise.resolve({})))
    const fallidas = await traspasarMesas([m1, m2], 'beto', 'Motivo')

    expect(fallidas).toEqual([{ mesa: m1, error: 'La orden ya está cobrada' }])
    expect(apiRequest).toHaveBeenCalledWith('/orders/o3/reasignar', expect.anything())
  })
})
