/** Formulario de retiros, gastos e ingresos de caja (T-56). */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import RegistrarMovimientoCaja from './RegistrarMovimientoCaja'
import { registrarMovimientoCaja } from '../../lib/movimientosCaja'

vi.mock('../../lib/movimientosCaja', async (importOriginal) => ({
  ...(await importOriginal()),
  registrarMovimientoCaja: vi.fn(),
}))

beforeEach(() => { vi.clearAllMocks() })

describe('RegistrarMovimientoCaja', () => {
  it('un retiro sin nota no se envía; con nota se registra', async () => {
    const user = userEvent.setup()
    const onRegistrado = vi.fn()
    registrarMovimientoCaja.mockResolvedValue({ id: 'm1' })
    render(<RegistrarMovimientoCaja cajaId="caja-1" onRegistrado={onRegistrado} onCancelar={() => {}} />)

    await user.type(screen.getByLabelText('Monto'), '1.000')
    await user.click(screen.getByRole('button', { name: 'Registrar' }))
    expect(screen.getByRole('alert')).toHaveTextContent(/para qué salió la plata/)
    expect(registrarMovimientoCaja).not.toHaveBeenCalled()

    await user.type(screen.getByLabelText('Para qué salió la plata'), 'Compra de hielo')
    await user.click(screen.getByRole('button', { name: 'Registrar' }))
    expect(registrarMovimientoCaja).toHaveBeenCalledWith('caja-1', { tipo: 'egreso', monto: 1000, note: 'Compra de hielo', payment_method: 'cash' })
    expect(onRegistrado).toHaveBeenCalledWith({ tipo: 'egreso', monto: 1000 })
  })

  it('con otro método explica que no cambia el efectivo esperado', async () => {
    const user = userEvent.setup()
    render(<RegistrarMovimientoCaja cajaId="caja-1" onRegistrado={() => {}} onCancelar={() => {}} />)
    expect(screen.queryByText(/no cambia el efectivo esperado/)).not.toBeInTheDocument()
    await user.selectOptions(screen.getByLabelText('Método'), 'debit')
    expect(screen.getByText(/no cambia el efectivo esperado/)).toBeInTheDocument()
  })

  it('el 400 de caja cerrada se muestra', async () => {
    const user = userEvent.setup()
    registrarMovimientoCaja.mockRejectedValue(Object.assign(new Error('400: La caja ya está cerrada'), { status: 400, detail: 'La caja ya está cerrada' }))
    render(<RegistrarMovimientoCaja cajaId="caja-1" onRegistrado={() => {}} onCancelar={() => {}} />)
    await user.selectOptions(screen.getByLabelText('Tipo'), 'ingreso')
    await user.type(screen.getByLabelText('Monto'), '500')
    await user.click(screen.getByRole('button', { name: 'Registrar' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('La caja ya está cerrada')
  })
})
