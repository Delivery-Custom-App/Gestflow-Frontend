import { describe, it, expect } from 'vitest'
import { mensajeCierreTurno, pendientesAlCerrar } from './turnos'

describe('mensajeCierreTurno', () => {
  it('el 409 ya no pide cerrar las mesas: explica el pedido de mostrador reciente o el cobro con tarjeta (T-45)', () => {
    const msg = mensajeCierreTurno(Object.assign(new Error('409: No se puede cerrar la caja: hay órdenes en curso contra ella'), { status: 409 }))
    expect(msg).toMatch(/pedido de mostrador reciente o un cobro con tarjeta en curso/)
    expect(msg).not.toMatch(/mesas/)
  })

  it('si ya estaba cerrado, lo dice', () => {
    expect(mensajeCierreTurno(new Error('La caja ya está cerrada'))).toBe('Este turno ya estaba cerrado.')
  })

  it('cualquier otro error se muestra tal cual, o uno genérico', () => {
    expect(mensajeCierreTurno(new Error('Sin conexión'))).toBe('Sin conexión')
    expect(mensajeCierreTurno(null)).toBe('No se pudo cerrar el turno')
  })
})

describe('pendientesAlCerrar (T-45)', () => {
  it('separa las mesas abiertas (quedan no cobradas) de los pedidos de mostrador', () => {
    const r = pendientesAlCerrar([
      { id: 'o1', status: 'PENDING', mesa_id: 'm2', total: 4400 },
      { id: 'o2', status: 'READY', mesa_id: null, total: 1500 },
      { id: 'o3', status: 'COMPLETED', mesa_id: 'm3', total: 9000 },
    ], (id) => ({ m2: 'Mesa 2' })[id])
    expect(r.mesas).toEqual([{ id: 'o1', mesa: 'Mesa 2', total: 4400 }])
    expect(r.mostrador).toEqual([{ id: 'o2', total: 1500 }])
    expect(r.totalMesas).toBe(4400)
  })
})
