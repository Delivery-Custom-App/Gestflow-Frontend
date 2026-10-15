/** Teléfono del local (T-38). */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import EditarLocalDialog from './EditarLocalDialog'
import { apiRequest } from '../lib/apiClient'
import { actualizarLocal, normalizarTelefono, validarTelefono } from '../lib/localsApi'

vi.mock('../lib/apiClient', () => ({ apiRequest: vi.fn() }))

beforeEach(() => { vi.clearAllMocks() })

describe('teléfono del local', () => {
  it('se guarda tal como se escribe, con los espacios ordenados', () => {
    expect(normalizarTelefono('  9  1234   5678 ')).toBe('9 1234 5678')
    expect(validarTelefono('9 1234 5678')).toBeNull()
    expect(validarTelefono('+56 9 1234 5678')).toBeNull()
    expect(validarTelefono('22345678')).toBeNull()
    expect(validarTelefono('')).toBeNull()
  })
  it('sin dígitos o con más de 32 caracteres no se acepta', () => {
    expect(validarTelefono('sin numero')).toMatch(/al menos un número/)
    expect(validarTelefono('1'.repeat(33))).toMatch(/32/)
  })
  it('editar manda phone; vacío lo borra con null', async () => {
    apiRequest.mockResolvedValue({})
    await actualizarLocal('l1', { name: 'Centro', phone: ' 9 1234 5678 ' })
    await actualizarLocal('l1', { phone: '' })
    expect(apiRequest.mock.calls).toEqual([
      ['/locals/l1', { method: 'PATCH', body: { name: 'Centro', phone: '9 1234 5678' } }],
      ['/locals/l1', { method: 'PATCH', body: { phone: null } }],
    ])
  })
})

describe('EditarLocalDialog', () => {
  it('muestra el teléfono actual, lo cambia y avisa al guardar', async () => {
    const user = userEvent.setup()
    const onGuardado = vi.fn()
    apiRequest.mockResolvedValue({})
    render(<EditarLocalDialog local={{ id: 'l1', name: 'Centro', phone: '22345678' }} onClose={() => {}} onGuardado={onGuardado} />)
    const campo = screen.getByLabelText('Teléfono')
    expect(campo).toHaveValue('22345678')
    await user.clear(campo)
    await user.type(campo, '+56 9 1234 5678')
    await user.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(apiRequest).toHaveBeenCalledWith('/locals/l1', { method: 'PATCH', body: { name: 'Centro', phone: '+56 9 1234 5678' } })
    expect(onGuardado).toHaveBeenCalled()
  })

  it('el 422 del backend se muestra', async () => {
    const user = userEvent.setup()
    apiRequest.mockRejectedValue(Object.assign(new Error('422: x'), { detail: 'El teléfono debe tener al menos un dígito' }))
    render(<EditarLocalDialog local={{ id: 'l1', name: 'Centro' }} onClose={() => {}} />)
    await user.type(screen.getByLabelText('Teléfono'), '123')
    await user.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('El teléfono debe tener al menos un dígito')
  })
})
