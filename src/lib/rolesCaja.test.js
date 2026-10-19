/** Quién cierra la caja y quién vende (A-03). */
import { describe, it, expect, afterEach } from 'vitest'
import { esAdminDeRestaurante, esDuenoDeRestaurante, puedeAbrirCaja, puedeCerrarCaja, puedeVender } from './rolesCaja'
import { mensajeCierreTurno } from './turnos'
import { V2_FEATURES } from './v2Features'

afterEach(() => { V2_FEATURES.aperturaCajaEncargadoRestaurante = false })

describe('rolesCaja', () => {
  it('cierran la caja el administrador, el dueño y el superadmin; el vendedor no', () => {
    expect(puedeCerrarCaja('Admin')).toBe(true)
    expect(puedeCerrarCaja('Admin Negocio')).toBe(true)
    expect(puedeCerrarCaja('Superadmin')).toBe(true)
    expect(puedeCerrarCaja('Empleado')).toBe(false)
  })

  it('en restaurante ni el encargado ni el dueño venden; en al paso sí; el trabajador siempre', () => {
    expect(esAdminDeRestaurante('Admin', 'RESTAURANT')).toBe(true)
    expect(esDuenoDeRestaurante('Admin Negocio', 'RESTAURANT')).toBe(true)
    expect(puedeVender('Admin', 'RESTAURANT')).toBe(false)
    expect(puedeVender('Admin Negocio', 'RESTAURANT')).toBe(false)
    expect(puedeVender('Admin', 'AL_PASO')).toBe(true)
    expect(puedeVender('Admin Negocio', 'AL_PASO')).toBe(true)
    expect(puedeVender('Empleado', 'RESTAURANT')).toBe(true)
  })

  it('abren la caja el encargado y el dueño; el trabajador no', () => {
    expect(puedeAbrirCaja('Admin Negocio', 'RESTAURANT')).toBe(true)
    expect(puedeAbrirCaja('Admin Negocio', 'AL_PASO')).toBe(true)
    expect(puedeAbrirCaja('Admin', 'AL_PASO')).toBe(true)
    expect(puedeAbrirCaja('Empleado', 'AL_PASO')).toBe(false)
    expect(puedeAbrirCaja('Empleado', 'RESTAURANT')).toBe(false)
  })

  it('el encargado de un restaurante abre la caja solo con la bandera (el backend aún responde 403)', () => {
    expect(puedeAbrirCaja('Admin', 'RESTAURANT')).toBe(false)
    V2_FEATURES.aperturaCajaEncargadoRestaurante = true
    expect(puedeAbrirCaja('Admin', 'RESTAURANT')).toBe(true)
  })

  it('un 403 al cerrar la caja se explica', () => {
    expect(mensajeCierreTurno({ status: 403, message: '403: No autorizado' })).toMatch(/Solo el administrador del local o el dueño/)
  })
})
