/** Quién cierra la caja y quién vende (A-03). */
import { describe, it, expect } from 'vitest'
import { esAdminDeRestaurante, puedeCerrarCaja, puedeVender } from './rolesCaja'
import { mensajeCierreTurno } from './turnos'

describe('rolesCaja', () => {
  it('cierran la caja el administrador, el dueño y el superadmin; el vendedor no', () => {
    expect(puedeCerrarCaja('Admin')).toBe(true)
    expect(puedeCerrarCaja('Admin Negocio')).toBe(true)
    expect(puedeCerrarCaja('Superadmin')).toBe(true)
    expect(puedeCerrarCaja('Empleado')).toBe(false)
  })

  it('en restaurante el administrador no vende; en al paso sí; el dueño siempre', () => {
    expect(esAdminDeRestaurante('Admin', 'RESTAURANT')).toBe(true)
    expect(puedeVender('Admin', 'RESTAURANT')).toBe(false)
    expect(puedeVender('Admin', 'AL_PASO')).toBe(true)
    expect(puedeVender('Admin Negocio', 'RESTAURANT')).toBe(true)
    expect(puedeVender('Empleado', 'RESTAURANT')).toBe(true)
  })

  it('un 403 al cerrar la caja se explica', () => {
    expect(mensajeCierreTurno({ status: 403, message: '403: No autorizado' })).toMatch(/Solo el administrador del local o el dueño/)
  })
})
