import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import TraspasarMesasModal from './TraspasarMesasModal'
import { traspasarMesas } from '../../lib/atencionMesas'

vi.mock('../../lib/atencionMesas', () => ({ traspasarMesas: vi.fn() }))
vi.mock('../../lib/supervision', async (importOriginal) => ({ ...(await importOriginal()) }))

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
    await user.type(screen.getByLabelText('Motivo'), 'Ana se retiró')
    await user.click(screen.getByRole('button', { name: 'Traspasar 2 mesas' }))

    await waitFor(() => expect(traspasarMesas).toHaveBeenCalledWith([MESAS[0], MESAS[1]], 'carla', 'Ana se retiró'))
    expect(onDone).toHaveBeenCalledWith({ cantidad: 2, a: 'Carla Díaz' })
  })

  it('una por una: solo las que quedan marcadas', async () => {
    const user = userEvent.setup()
    montar({ onDone: vi.fn() })

    await user.selectOptions(screen.getByLabelText('De'), 'ana')
    await user.click(screen.getByRole('checkbox', { name: /Mesa 2/ }))
    await user.selectOptions(screen.getByLabelText('A'), 'beto')
    await user.type(screen.getByLabelText('Motivo'), 'Beto cubre')
    await user.click(screen.getByRole('button', { name: 'Traspasar 1 mesa' }))

    await waitFor(() => expect(traspasarMesas).toHaveBeenCalledWith([MESAS[0]], 'beto', 'Beto cubre'))
  })

  it('T-42: avisa que las mesas pasan al turno de quien las recibe', () => {
    montar()
    expect(screen.getByText(/pasan al turno de quien las recibe/)).toBeInTheDocument()
  })

  it('T-42: sin motivo (3 a 300 caracteres) no traspasa', async () => {
    const user = userEvent.setup()
    montar()
    await user.selectOptions(screen.getByLabelText('De'), 'ana')
    await user.selectOptions(screen.getByLabelText('A'), 'carla')
    await user.click(screen.getByRole('button', { name: 'Traspasar 2 mesas' }))
    expect(screen.getByRole('alert')).toHaveTextContent(/motivo/)
    expect(traspasarMesas).not.toHaveBeenCalled()
  })

  it('si alguna mesa no se pudo traspasar, lo dice y no cierra', async () => {
    traspasarMesas.mockResolvedValue([{ mesa: MESAS[1], error: 'No autorizado' }])
    const onDone = vi.fn()
    const user = userEvent.setup()
    montar({ onDone })

    await user.selectOptions(screen.getByLabelText('De'), 'ana')
    await user.selectOptions(screen.getByLabelText('A'), 'carla')
    await user.type(screen.getByLabelText('Motivo'), 'Ana se retiró')
    await user.click(screen.getByRole('button', { name: 'Traspasar 2 mesas' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Mesa 2 (No autorizado)')
    expect(onDone).not.toHaveBeenCalled()
  })

  it('#169: traspaso parcial, avisa a la pantalla y deja solo las que fallaron; el reintento no manda las que ya pasaron', async () => {
    traspasarMesas.mockResolvedValueOnce([{ mesa: MESAS[1], error: 'La mesa ya es de ese empleado' }])
    const onDone = vi.fn()
    const onParcial = vi.fn()
    const user = userEvent.setup()
    montar({ onDone, onParcial })

    await user.selectOptions(screen.getByLabelText('De'), 'ana')
    await user.selectOptions(screen.getByLabelText('A'), 'carla')
    await user.type(screen.getByLabelText('Motivo'), 'Ana se retiró')
    await user.click(screen.getByRole('button', { name: 'Traspasar 2 mesas' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudieron traspasar: Mesa 2 (La mesa ya es de ese empleado)')
    expect(onParcial).toHaveBeenCalledWith({ cantidad: 1, a: 'Carla Díaz' })
    expect(onDone).not.toHaveBeenCalled()
    expect(screen.queryByRole('checkbox', { name: /Mesa 1/ })).not.toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: /Mesa 2/ })).toBeChecked()
    expect(within(screen.getByLabelText('De')).getByRole('option', { name: 'Ana Rojas (1 mesa)' })).toBeInTheDocument()

    traspasarMesas.mockResolvedValueOnce([])
    await user.click(screen.getByRole('button', { name: 'Traspasar 1 mesa' }))

    await waitFor(() => expect(onDone).toHaveBeenCalledWith({ cantidad: 1, a: 'Carla Díaz' }))
    expect(traspasarMesas).toHaveBeenNthCalledWith(2, [MESAS[1]], 'carla', 'Ana se retiró')
    expect(onParcial).toHaveBeenCalledTimes(1)
  })

  it('#169: si no pasó ninguna, no avisa a la pantalla y todas siguen marcadas para reintentar', async () => {
    traspasarMesas.mockResolvedValue([{ mesa: MESAS[0], error: 'No autorizado' }, { mesa: MESAS[1], error: 'No autorizado' }])
    const onParcial = vi.fn()
    const user = userEvent.setup()
    montar({ onParcial })

    await user.selectOptions(screen.getByLabelText('De'), 'ana')
    await user.selectOptions(screen.getByLabelText('A'), 'carla')
    await user.type(screen.getByLabelText('Motivo'), 'Ana se retiró')
    await user.click(screen.getByRole('button', { name: 'Traspasar 2 mesas' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Mesa 1 (No autorizado), Mesa 2 (No autorizado)')
    expect(onParcial).not.toHaveBeenCalled()
    expect(screen.getByRole('checkbox', { name: /Mesa 1/ })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: /Mesa 2/ })).toBeChecked()
    expect(screen.getByRole('button', { name: 'Traspasar 2 mesas' })).toBeEnabled()
  })

  it('sin destino elegido no deja traspasar', async () => {
    const user = userEvent.setup()
    montar()
    await user.selectOptions(screen.getByLabelText('De'), 'ana')
    expect(screen.getByRole('button', { name: 'Traspasar 2 mesas' })).toBeDisabled()
  })
})
