import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createBusiness, createBusinessLocal } from './superAdminApi'
import { createUser } from './apiClient'
import { FRANQUICIA_VACIA, crearFranquicia, generarClave, validarAltaFranquicia } from './altaFranquicia'

vi.mock('./superAdminApi', () => ({ createBusiness: vi.fn(), createBusinessLocal: vi.fn() }))
vi.mock('./apiClient', () => ({ createUser: vi.fn() }))

const VALIDO = {
  ...FRANQUICIA_VACIA,
  name: ' Sushi Sur ',
  rut: '76.123.456-7',
  plan: 'professional',
  localName: ' Casa matriz ',
  dueno: { nombre: 'Ana', apellido: 'Rojas', rut: '', email: 'ana@sushisur.cl', password: 'clave-segura' },
}

beforeEach(() => {
  vi.clearAllMocks()
  createBusiness.mockResolvedValue({ id: 'b-1', name: 'Sushi Sur' })
  createBusinessLocal.mockResolvedValue({ id: 'l-1' })
  createUser.mockResolvedValue({ id: 'u-1' })
})

describe('validarAltaFranquicia', () => {
  it('acepta un alta completa', () => {
    expect(validarAltaFranquicia(VALIDO)).toBeNull()
  })

  it('pide nombre, RUT y nombre del local', () => {
    expect(validarAltaFranquicia({ ...VALIDO, name: ' ' })).toBe('El nombre de la franquicia es obligatorio.')
    expect(validarAltaFranquicia({ ...VALIDO, rut: '' })).toBe('El RUT es obligatorio.')
    expect(validarAltaFranquicia({ ...VALIDO, localName: '' })).toBe('Ingresa el nombre del primer local.')
  })

  it('valida al dueño como un alta de usuario', () => {
    expect(validarAltaFranquicia({ ...VALIDO, dueno: { ...VALIDO.dueno, password: '123' } }))
      .toBe('Dueño: La contraseña debe tener al menos 8 caracteres.')
  })

  it('sin local ni dueño basta con los datos del negocio', () => {
    expect(validarAltaFranquicia({ ...VALIDO, conLocal: false, localName: '', conDueno: false, dueno: {} })).toBeNull()
  })
})

describe('crearFranquicia', () => {
  it('crea el negocio, su primer local y el dueño atado al negocio', async () => {
    const r = await crearFranquicia(VALIDO, 'tok')

    expect(createBusiness).toHaveBeenCalledWith({ name: 'Sushi Sur', rut: '76.123.456-7', plan: 'professional' }, 'tok')
    expect(createBusinessLocal).toHaveBeenCalledWith('b-1', { name: 'Casa matriz', salesModel: 'RESTAURANT' }, 'tok')
    expect(createUser).toHaveBeenCalledWith(expect.objectContaining({
      email: 'ana@sushisur.cl', role: 'ADMIN_NEGOCIO', business_id: 'b-1', local_id: null, first_name: 'Ana',
    }))
    expect(r).toEqual({ business: { id: 'b-1', name: 'Sushi Sur' }, pendientes: [] })
  })

  it('sin datos iniciales solo crea el negocio', async () => {
    await crearFranquicia({ ...VALIDO, conLocal: false, conDueno: false }, 'tok')
    expect(createBusinessLocal).not.toHaveBeenCalled()
    expect(createUser).not.toHaveBeenCalled()
  })

  it('si falla un paso posterior, el negocio queda y se informa lo pendiente', async () => {
    createUser.mockRejectedValue({ detail: '409: Email ya registrado' })
    const r = await crearFranquicia(VALIDO, 'tok')
    expect(r.business.id).toBe('b-1')
    expect(r.pendientes).toEqual(['la cuenta del dueño (Email ya registrado)'])
  })

  it('si falla el negocio, no sigue', async () => {
    createBusiness.mockRejectedValue(new Error('RUT duplicado'))
    await expect(crearFranquicia(VALIDO, 'tok')).rejects.toThrow('RUT duplicado')
    expect(createBusinessLocal).not.toHaveBeenCalled()
  })
})

describe('generarClave', () => {
  it('genera claves del largo pedido que cumplen el mínimo del backend', () => {
    const clave = generarClave()
    expect(clave).toHaveLength(12)
    expect(clave).toMatch(/^[A-Za-z0-9]+$/)
    expect(generarClave()).not.toBe(clave)
  })
})
