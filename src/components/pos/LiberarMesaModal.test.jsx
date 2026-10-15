import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import LiberarMesaModal from './LiberarMesaModal'
import { liberarMesa } from '../../lib/salesApi'

vi.mock('../../lib/salesApi', () => ({ liberarMesa: vi.fn() }))

const mesa = { id: 'm-1', name: 'Mesa 1' }

beforeEach(() => vi.clearAllMocks())

describe('LiberarMesaModal', () => {
  it('confirma con motivo válido y muestra cuánto quedó sin cobrar', async () => {
    const user = userEvent.setup()
    liberarMesa.mockResolvedValue({ nombre: 'Mesa 1', status: 'available', total_sin_cobrar: '12345.00' })
    render(<LiberarMesaModal mesa={mesa} totalPendiente={12345} onClose={vi.fn()} onDone={vi.fn()} />)

    expect(screen.getByRole('dialog')).toHaveTextContent('Total actual que quedaría sin cobrar: $12.345')
    const enviar = screen.getByRole('button', { name: 'Liberar mesa' })
    expect(enviar).toBeDisabled()
    await user.type(screen.getByLabelText('Motivo'), 'ab')
    expect(enviar).toBeDisabled()
    await user.clear(screen.getByLabelText('Motivo'))
    await user.type(screen.getByLabelText('Motivo'), '  Se fueron sin pagar  ')
    await user.click(enviar)

    expect(liberarMesa).toHaveBeenCalledWith('m-1', 'Se fueron sin pagar')
    expect(await screen.findByRole('status')).toHaveTextContent('La mesa está disponible')
    expect(screen.getByText('$12.345')).toBeInTheDocument()
  })

  it.each([
    ['La mesa ya está libre'],
    ['Hay un cobro con tarjeta en curso'],
  ])('muestra el detalle de un 409: %s', async (detail) => {
    const user = userEvent.setup()
    liberarMesa.mockRejectedValue(Object.assign(new Error(`409: ${detail}`), { status: 409, detail }))
    render(<LiberarMesaModal mesa={mesa} totalPendiente={0} onClose={vi.fn()} onDone={vi.fn()} />)

    await user.type(screen.getByLabelText('Motivo'), 'Situación excepcional')
    await user.click(screen.getByRole('button', { name: 'Liberar mesa' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(`409: ${detail}`)
  })
})
