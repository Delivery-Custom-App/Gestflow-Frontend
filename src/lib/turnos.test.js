import { describe, it, expect } from 'vitest'
import { mensajeCierreTurno } from './turnos'

describe('mensajeCierreTurno', () => {
  it('con órdenes en curso (409) dice qué hacer', () => {
    expect(mensajeCierreTurno(new Error('No se puede cerrar la caja: hay órdenes en curso contra ella')))
      .toBe('No se puede cerrar el turno: todavía hay órdenes en curso. Cóbralas o cancélalas primero.')
  })

  it('si ya estaba cerrado, lo dice', () => {
    expect(mensajeCierreTurno(new Error('La caja ya está cerrada'))).toBe('Este turno ya estaba cerrado.')
  })

  it('cualquier otro error se muestra tal cual, o uno genérico', () => {
    expect(mensajeCierreTurno(new Error('Sin conexión'))).toBe('Sin conexión')
    expect(mensajeCierreTurno(null)).toBe('No se pudo cerrar el turno')
  })
})
