import { describe, it, expect, vi, beforeEach } from 'vitest'
import { apiRequest } from './apiClient'
import { guardarMiNombre, iniciales, tieneNombre, validarNombre } from './perfil'

vi.mock('./apiClient', () => ({ apiRequest: vi.fn(() => Promise.resolve({})) }))

beforeEach(() => vi.clearAllMocks())

describe('iniciales', () => {
  it('nombre y apellido; solo nombre; sin nombre, la primera letra del correo', () => {
    expect(iniciales({ first_name: 'ana', last_name: 'rojas' })).toBe('AR')
    expect(iniciales({ first_name: 'Ana', last_name: '' })).toBe('A')
    expect(iniciales({ first_name: '  ', email: 'cajero@demo.gestflow.dev' })).toBe('C')
    expect(iniciales(null)).toBe('?')
  })
})

describe('tieneNombre', () => {
  it('solo cuenta un nombre cargado de verdad', () => {
    expect(tieneNombre({ first_name: 'Ana' })).toBe(true)
    expect(tieneNombre({ first_name: '   ' })).toBe(false)
    expect(tieneNombre({ email: 'a@b.cl' })).toBe(false)
  })
})

describe('validarNombre', () => {
  it('el nombre es obligatorio y el apellido no (como en el alta de usuarios)', () => {
    expect(validarNombre({ nombre: 'Ana', apellido: '' })).toBeNull()
    expect(validarNombre({ nombre: '  ', apellido: 'Rojas' })).toBe('Ingresa tu nombre.')
    expect(validarNombre({ nombre: 'A'.repeat(101), apellido: '' })).toMatch(/hasta 100/)
    expect(validarNombre({ nombre: 'Ana', apellido: 'R'.repeat(101) })).toMatch(/hasta 100/)
  })
})

describe('guardarMiNombre', () => {
  it('envía first_name y last_name a PATCH /auth/me, sin espacios sobrantes', async () => {
    await guardarMiNombre({ nombre: '  Ana ', apellido: ' Rojas ' })
    expect(apiRequest).toHaveBeenCalledWith('/auth/me', { method: 'PATCH', body: { first_name: 'Ana', last_name: 'Rojas' } })
  })

  it('sin apellido lo deja vacío (null)', async () => {
    await guardarMiNombre({ nombre: 'Ana', apellido: '' })
    expect(apiRequest.mock.calls[0][1].body).toEqual({ first_name: 'Ana', last_name: null })
  })
})
