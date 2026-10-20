/** «Liberar grupo» (#221): motivo de 3 a 300 caracteres, aviso de pedidos abiertos y falla parcial. */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import LiberarGrupoModal from './LiberarGrupoModal'
import { liberarMesa } from '../../lib/salesApi'
import { deshacerGrupoDeMesas } from '../../lib/mesaGroupsApi'

vi.mock('../../lib/salesApi', () => ({ liberarMesa: vi.fn() }))
vi.mock('../../lib/mesaGroupsApi', () => ({ deshacerGrupoDeMesas: vi.fn() }))

const GRUPO = { id: 'g1', etiqueta: 'Grupo 1', mesaIds: ['m1', 'm2', 'm3'] }
// Un grupo de 3: la del medio tiene el pedido y las otras dos quedaron ocupadas sin pedido.
const MESAS = [
  { id: 'm1', nombre: 'Mesa 1', ocupada: true, conPedido: false, total: 0 },
  { id: 'm2', nombre: 'Mesa 2', ocupada: true, conPedido: true, total: 8200 },
  { id: 'm3', nombre: 'Mesa 3', ocupada: true, conPedido: false, total: 0 },
]

const montar = (props = {}) => render(<LiberarGrupoModal grupo={GRUPO} mesas={MESAS} onClose={vi.fn()} onDone={vi.fn()} {...props} />)
const motivo = () => screen.getByLabelText('Motivo')
const enviar = () => screen.getByRole('button', { name: 'Liberar grupo' })

beforeEach(() => {
  vi.clearAllMocks()
  liberarMesa.mockResolvedValue({ total_sin_cobrar: '0.00' })
  deshacerGrupoDeMesas.mockResolvedValue(undefined)
})

describe('LiberarGrupoModal', () => {
  it('lista las mesas del grupo y avisa qué mesa tiene un pedido abierto, con su total', () => {
    montar()
    const mesas = within(screen.getByRole('list', { name: 'Mesas del grupo' }))
    expect(mesas.getByText('Mesa 1').closest('li')).toHaveTextContent('ocupada, sin pedido')
    expect(mesas.getByText('Mesa 2').closest('li')).toHaveTextContent('pedido abierto · $8.200')
    expect(mesas.getByText('Mesa 3').closest('li')).toHaveTextContent('ocupada, sin pedido')

    const aviso = screen.getByRole('note', { name: 'Pedidos abiertos que quedarán sin cobrar' })
    expect(aviso).toHaveTextContent('Mesa 2 tiene un pedido abierto.')
    expect(aviso).toHaveTextContent('Total que quedaría sin cobrar: $8.200')
  })

  it('sin pedidos abiertos no muestra el aviso de lo que queda sin cobrar', () => {
    montar({ mesas: MESAS.map((m) => ({ ...m, conPedido: false, total: 0 })) })
    expect(screen.queryByRole('note', { name: 'Pedidos abiertos que quedarán sin cobrar' })).not.toBeInTheDocument()
  })

  it('con varios pedidos abiertos los nombra y suma el total', () => {
    montar({ mesas: MESAS.map((m) => (m.id === 'm3' ? { ...m, conPedido: true, total: 1800 } : m)) })
    const aviso = screen.getByRole('note', { name: 'Pedidos abiertos que quedarán sin cobrar' })
    expect(aviso).toHaveTextContent('Mesa 2 y Mesa 3 tienen pedidos abiertos.')
    expect(aviso).toHaveTextContent('$10.000')
  })

  it('el motivo de 1 o 2 letras es un error de validación y no deja confirmar', async () => {
    const user = userEvent.setup()
    montar()
    expect(screen.getByText('Entre 3 y 300 caracteres.')).toBeInTheDocument()
    expect(enviar()).toBeDisabled()

    await user.type(motivo(), 'ab')
    expect(screen.getByText('El motivo debe tener entre 3 y 300 caracteres.')).toBeInTheDocument()
    expect(motivo()).toHaveAttribute('aria-invalid', 'true')
    expect(enviar()).toBeDisabled()

    await user.type(motivo(), 'c')
    expect(screen.queryByText('El motivo debe tener entre 3 y 300 caracteres.')).not.toBeInTheDocument()
    expect(enviar()).toBeEnabled()
    expect(liberarMesa).not.toHaveBeenCalled()
  })

  it('el motivo no pasa de 300 caracteres', async () => {
    const user = userEvent.setup()
    montar()
    await user.click(motivo())
    await user.paste('a'.repeat(350))
    expect(motivo()).toHaveValue('a'.repeat(300))
    expect(screen.getByText('300/300')).toBeInTheDocument()
    expect(enviar()).toBeEnabled()
  })

  it('confirma: libera cada mesa ocupada con el motivo, separa el grupo y dice cuánto quedó sin cobrar', async () => {
    const user = userEvent.setup()
    const onDone = vi.fn()
    liberarMesa.mockImplementation(async (id) => ({ total_sin_cobrar: id === 'm2' ? '8200.00' : '0.00' }))
    montar({ onDone })

    await user.type(motivo(), '  Los clientes se fueron  ')
    await user.click(enviar())

    expect(liberarMesa).toHaveBeenCalledTimes(3)
    for (const id of ['m1', 'm2', 'm3']) expect(liberarMesa).toHaveBeenCalledWith(id, 'Los clientes se fueron')
    expect(deshacerGrupoDeMesas).toHaveBeenCalledWith('g1')
    expect(await screen.findByRole('status')).toHaveTextContent('Mesa 1, Mesa 2 y Mesa 3 quedaron libres y el grupo se separó.')
    expect(screen.getByRole('dialog')).toHaveTextContent('Total que quedó sin cobrar: $8.200')

    await user.click(screen.getByRole('button', { name: 'Volver a mesas' }))
    expect(onDone).toHaveBeenCalledWith(expect.objectContaining({ separado: true }))
  })

  it('falla parcial: sigue con las demás, muestra cuáles no se pudieron liberar y deja el grupo junto', async () => {
    const user = userEvent.setup()
    const onDone = vi.fn()
    liberarMesa.mockImplementation(async (id) => {
      if (id === 'm2') throw Object.assign(new Error('409: x'), { status: 409, detail: 'Hay un cobro con tarjeta en curso' })
      return { total_sin_cobrar: '0.00' }
    })
    montar({ onDone })

    await user.type(motivo(), 'Cierre')
    await user.click(enviar())

    expect(liberarMesa).toHaveBeenCalledTimes(3)
    expect(deshacerGrupoDeMesas).not.toHaveBeenCalled()
    const alerta = await screen.findByRole('alert')
    expect(alerta).toHaveTextContent('No se pudieron liberar:')
    expect(alerta).toHaveTextContent('Mesa 2: Hay un cobro con tarjeta en curso')
    expect(alerta).toHaveTextContent('El grupo sigue junto')
    expect(screen.getByRole('dialog')).toHaveTextContent('Faltó liberar mesas')
    expect(screen.getByRole('dialog')).toHaveTextContent('Grupo 1: 2 mesas liberadas.')

    await user.click(screen.getByRole('button', { name: 'Volver a mesas' }))
    expect(onDone).toHaveBeenCalledWith(expect.objectContaining({ separado: false, fallidas: [expect.objectContaining({ id: 'm2' })] }))
  })

  it('con todas las mesas libres no pide motivo: solo separa el grupo', async () => {
    const user = userEvent.setup()
    montar({ mesas: MESAS.map((m) => ({ ...m, ocupada: false, conPedido: false, total: 0 })) })

    expect(screen.queryByLabelText('Motivo')).not.toBeInTheDocument()
    expect(screen.getByText('Todas las mesas ya están libres: solo se separa el grupo.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Separar grupo' }))

    expect(liberarMesa).not.toHaveBeenCalled()
    expect(deshacerGrupoDeMesas).toHaveBeenCalledWith('g1')
    expect(await screen.findByRole('status')).toHaveTextContent('El grupo se separó.')
  })

  it('«Cancelar» cierra sin liberar nada', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    montar({ onClose })
    await user.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(onClose).toHaveBeenCalled()
    expect(liberarMesa).not.toHaveBeenCalled()
  })
})
