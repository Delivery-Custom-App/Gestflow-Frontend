import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import TraspasarMesasModal from './TraspasarMesasModal'
import { traspasarMesas } from '../../lib/atencionMesas'

vi.mock('../../lib/atencionMesas', () => ({ traspasarMesas: vi.fn() }))

const NOMBRES = { ana: 'Ana Rojas', beto: 'Beto Soto', carla: 'Carla Díaz' }
const nombre = (id) => NOMBRES[id]
const enCurso = (id, atiende) => ({ mesa: { id, name: `Mesa ${id}`, total: 5000 }, ordenes: [{ id: `o-${id}` }], atiendeId: atiende })
const MESAS = [enCurso('1', 'ana'), enCurso('2', 'ana'), enCurso('3', 'beto')]
const VENDEDORES = [{ id: 'ana', nombre: 'Ana Rojas' }, { id: 'beto', nombre: 'Beto Soto' }, { id: 'carla', nombre: 'Carla Díaz' }]

beforeEach(() => {
  vi.clearAllMocks()
  traspasarMesas.mockResolvedValue([])
})

function montar(props = {}) {
  return render(<TraspasarMesasModal mesas={MESAS} vendedores={VENDEDORES} nombre={nombre} onClose={vi.fn()} {...props} />)
}

describe('TraspasarMesasModal', () => {
  it('al elegir de quién, vienen marcadas todas sus mesas y no se le puede traspasar a sí mismo', async () => {
    const user = userEvent.setup()
    montar()

    expect(within(screen.getByLabelText('De')).getByRole('option', { name: 'Ana Rojas (2 mesas)' })).toBeInTheDocument()
    await user.selectOptions(screen.getByLabelText('De'), 'ana')

    expect(screen.getByRole('checkbox', { name: /Mesa 1/ })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: /Mesa 2/ })).toBeChecked()
    expect(screen.queryByRole('checkbox', { name: /Mesa 3/ })).not.toBeInTheDocument()
    expect(within(screen.getByLabelText('A')).queryByRole('option', { name: 'Ana Rojas' })).not.toBeInTheDocument()
  })

  it('todas juntas: traspasa todas sus mesas al vendedor elegido', async () => {
    const onDone = vi.fn()
    const user = userEvent.setup()
    montar({ onDone })

    await user.selectOptions(screen.getByLabelText('De'), 'ana')
    await user.selectOptions(screen.getByLabelText('A'), 'carla')
    await user.click(screen.getByRole('button', { name: 'Traspasar 2 mesas' }))

    await waitFor(() => expect(traspasarMesas).toHaveBeenCalledWith([MESAS[0], MESAS[1]], 'carla'))
    expect(onDone).toHaveBeenCalledWith({ cantidad: 2, a: 'Carla Díaz' })
  })

  it('una por una: solo las que quedan marcadas', async () => {
    const user = userEvent.setup()
    montar({ onDone: vi.fn() })

    await user.selectOptions(screen.getByLabelText('De'), 'ana')
    await user.click(screen.getByRole('checkbox', { name: /Mesa 2/ }))
    await user.selectOptions(screen.getByLabelText('A'), 'beto')
    await user.click(screen.getByRole('button', { name: 'Traspasar 1 mesa' }))

    await waitFor(() => expect(traspasarMesas).toHaveBeenCalledWith([MESAS[0]], 'beto'))
  })

  it('avisa que el cobro sigue sumando al turno donde se abrió la mesa', () => {
    montar()
    expect(screen.getByText(/sigue sumando al turno donde se abrió/)).toBeInTheDocument()
  })

  it('si alguna mesa no se pudo traspasar, lo dice y no cierra', async () => {
    traspasarMesas.mockResolvedValue([{ mesa: MESAS[1], error: 'No autorizado' }])
    const onDone = vi.fn()
    const user = userEvent.setup()
    montar({ onDone })

    await user.selectOptions(screen.getByLabelText('De'), 'ana')
    await user.selectOptions(screen.getByLabelText('A'), 'carla')
    await user.click(screen.getByRole('button', { name: 'Traspasar 2 mesas' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Mesa 2 (No autorizado)')
    expect(onDone).not.toHaveBeenCalled()
  })

  it('sin destino elegido no deja traspasar', async () => {
    const user = userEvent.setup()
    montar()
    await user.selectOptions(screen.getByLabelText('De'), 'ana')
    expect(screen.getByRole('button', { name: 'Traspasar 2 mesas' })).toBeDisabled()
  })
})
