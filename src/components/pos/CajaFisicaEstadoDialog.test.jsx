/** Confirmación para desactivar, reactivar o eliminar una caja física (T-75). */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import CajaFisicaEstadoDialog from './CajaFisicaEstadoDialog'
import { cambiarEstadoCajaFisica, eliminarCajaFisica } from '../../lib/administrativeApi'

vi.mock('../../lib/administrativeApi', () => ({
  cambiarEstadoCajaFisica: vi.fn(),
  eliminarCajaFisica: vi.fn(),
}))

const CAJA = { id: 'cf-1', name: 'Caja terraza' }
const montar = (accion, extra = {}) => {
  const props = { cajaFisica: CAJA, accion, onClose: vi.fn(), onSaved: vi.fn(), ...extra }
  render(<CajaFisicaEstadoDialog {...props} />)
  return props
}

beforeEach(() => {
  vi.clearAllMocks()
  cambiarEstadoCajaFisica.mockResolvedValue({})
  eliminarCajaFisica.mockResolvedValue(undefined)
})

describe('CajaFisicaEstadoDialog', () => {
  it('reactivar usa PATCH is_active=true, avisa y se cierra', async () => {
    const user = userEvent.setup()
    const { onSaved, onClose } = montar('reactivar')
    expect(screen.getByRole('dialog', { name: 'Reactivar caja física' })).toHaveTextContent('Caja terraza')
    await user.click(screen.getByRole('button', { name: 'Reactivar' }))
    expect(cambiarEstadoCajaFisica).toHaveBeenCalledWith('cf-1', true)
    expect(onSaved).toHaveBeenCalled()
    expect(onClose).toHaveBeenCalled()
  })

  it('eliminar explica las condiciones del backend antes de confirmar', () => {
    montar('eliminar')
    expect(screen.getByText(/Solo se puede si nunca tuvo turnos y no tiene lectores POS anclados/)).toBeInTheDocument()
  })

  it('con lectores anclados, el 400 del backend se muestra y no se cierra', async () => {
    eliminarCajaFisica.mockRejectedValue(new Error('400: Reasigná estos lectores POS antes de eliminar: Point caja'))
    const user = userEvent.setup()
    const { onSaved, onClose } = montar('eliminar')
    await user.click(screen.getByRole('button', { name: 'Eliminar para siempre' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Reasigná estos lectores POS antes de eliminar: Point caja')
    expect(onSaved).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Cerrar' })).toBeInTheDocument()
  })

  it('cancelar no llama a la API', async () => {
    const user = userEvent.setup()
    const { onClose } = montar('desactivar')
    await user.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(onClose).toHaveBeenCalled()
    expect(cambiarEstadoCajaFisica).not.toHaveBeenCalled()
  })
})
