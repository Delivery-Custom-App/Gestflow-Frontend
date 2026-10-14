/** Gestión de usuarios (T-32): desactivar, reactivar, editar y restablecer clave. */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { apiRequest } from './apiClient'
import {
  actualizarUsuario, cambiarEstadoUsuario, cambiosDeEdicion, formularioDe, puedeGestionar,
  restablecerClave, separarPorEstado, textoDeError, validarEdicion,
} from './gestionUsuarios'

vi.mock('./apiClient', () => ({ apiRequest: vi.fn() }))

const VICENTE = { id: 'v1', email: 'v@x.cl', role: 'EMPLEADO', local_id: 'loc-1', first_name: 'Vicente', last_name: 'Soto', is_active: true }

beforeEach(() => { vi.clearAllMocks() })

describe('rutas', () => {
  it('desactivar y reactivar con PATCH /users/{id} e is_active', async () => {
    apiRequest.mockResolvedValue({})
    await cambiarEstadoUsuario('v1', false)
    await cambiarEstadoUsuario('v1', true)
    expect(apiRequest.mock.calls).toEqual([
      ['/users/v1', { method: 'PATCH', body: { is_active: false } }],
      ['/users/v1', { method: 'PATCH', body: { is_active: true } }],
    ])
  })

  it('editar con PATCH /users/{id}', async () => {
    apiRequest.mockResolvedValue({})
    await actualizarUsuario('v1', { first_name: 'Vicente' })
    expect(apiRequest).toHaveBeenCalledWith('/users/v1', { method: 'PATCH', body: { first_name: 'Vicente' } })
  })

  it('restablecer la clave con POST …/regenerate-password', async () => {
    apiRequest.mockResolvedValue({ temporary_password: 'abc', email_sent: false })
    await expect(restablecerClave('v1')).resolves.toEqual({ temporary_password: 'abc', email_sent: false })
    expect(apiRequest).toHaveBeenCalledWith('/users/v1/regenerate-password', { method: 'POST' })
  })
})

describe('quién gestiona a quién', () => {
  it('nunca a sí mismo ni a un superadmin', () => {
    expect(puedeGestionar('Admin Negocio', 'v1', VICENTE)).toBe(false)
    expect(puedeGestionar('Superadmin', 'yo', { id: 's', role: 'SUPERADMIN' })).toBe(false)
  })
  it('el dueño gestiona encargados y vendedores, no a otro dueño', () => {
    expect(puedeGestionar('Admin Negocio', 'yo', VICENTE)).toBe(true)
    expect(puedeGestionar('Admin Negocio', 'yo', { id: 'e', role: 'ADMIN' })).toBe(true)
    expect(puedeGestionar('Admin Negocio', 'yo', { id: 'd', role: 'ADMIN_NEGOCIO' })).toBe(false)
  })
  it('T-47: el encargado gestiona solo a los vendedores de su local', () => {
    expect(puedeGestionar('Admin', 'yo', VICENTE, 'loc-1')).toBe(true)
    expect(puedeGestionar('Admin', 'yo', VICENTE, 'loc-2')).toBe(false)
    expect(puedeGestionar('Admin', 'yo', { id: 'e', role: 'ADMIN', local_id: 'loc-1' }, 'loc-1')).toBe(false)
    expect(puedeGestionar('Admin', 'yo', VICENTE, null)).toBe(false)
  })
  it('el superadmin gestiona a todos menos superadmins', () => {
    expect(puedeGestionar('Superadmin', 'yo', { id: 'd', role: 'ADMIN_NEGOCIO' })).toBe(true)
  })
})

describe('activos e inactivos', () => {
  it('separa por is_active', () => {
    const r = separarPorEstado([VICENTE, { ...VICENTE, id: 'v2', is_active: false }])
    expect(r.activos.map((u) => u.id)).toEqual(['v1'])
    expect(r.inactivos.map((u) => u.id)).toEqual(['v2'])
  })
})

describe('edición', () => {
  it('un encargado o vendedor sin local no se deja guardar', () => {
    expect(validarEdicion({ nombre: 'V', role: 'EMPLEADO', local_id: '' })).toMatch(/local/)
    expect(validarEdicion({ nombre: 'V', role: 'EMPLEADO', local_id: 'loc-1' })).toBeNull()
    expect(validarEdicion({ nombre: ' ', role: 'EMPLEADO', local_id: 'loc-1' })).toMatch(/nombre/)
  })

  it('solo manda lo que cambió', () => {
    const form = { ...formularioDe(VICENTE), nombre: 'Vicente A.' }
    expect(cambiosDeEdicion(VICENTE, form)).toEqual({ first_name: 'Vicente A.' })
  })

  it('cambiar de local o de rol manda role y local_id', () => {
    expect(cambiosDeEdicion(VICENTE, { ...formularioDe(VICENTE), local_id: 'loc-2' })).toEqual({ local_id: 'loc-2' })
    expect(cambiosDeEdicion(VICENTE, { ...formularioDe(VICENTE), role: 'ADMIN' })).toEqual({ role: 'ADMIN', local_id: 'loc-1' })
  })

  it('apellido vacío se borra con null; sin rol y local para quien no puede cambiarlos', () => {
    const form = { ...formularioDe(VICENTE), apellido: '', local_id: 'loc-2' }
    expect(cambiosDeEdicion(VICENTE, form, { conRolYLocal: false })).toEqual({ last_name: null })
  })
})

it('textoDeError quita el código del frente', () => {
  expect(textoDeError(new Error('400: El administrador de local y el empleado deben tener un local (local_id)')))
    .toBe('El administrador de local y el empleado deben tener un local (local_id)')
  expect(textoDeError({ detail: 'No autorizado' })).toBe('No autorizado')
})
