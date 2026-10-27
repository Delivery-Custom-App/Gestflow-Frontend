/**
 * #163: si el backend rechazaba el cambio (409 al dar de baja una mesa en uso),
 * el error solo salía por consola y el formulario quedaba abierto sin explicar.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import EditMesaModal from './EditMesaModal'

const MESA = { id: 'm2', name: 'Mesa 2', capacidad: 2, zona: '', is_active: true }

function montar(onSubmit) {
  const onClose = vi.fn()
  render(<EditMesaModal mesa={MESA} onClose={onClose} onSubmit={onSubmit} />)
  return { onClose }
}

const guardar = (user) => user.click(screen.getByRole('button', { name: /guardar cambios/i }))

describe('EditMesaModal · error del backend (#163)', () => {
  it('muestra el motivo, sin el código HTTP, y deja el formulario abierto para corregirlo', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn().mockRejectedValue(
      new Error('409: La mesa Mesa 2 está en uso: cóbrala o libérala antes de darla de baja'),
    )
    const { onClose } = montar(onSubmit)

    await user.click(screen.getByRole('checkbox', { name: /mesa activa/i }))
    await guardar(user)

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'La mesa Mesa 2 está en uso: cóbrala o libérala antes de darla de baja',
    )
    expect(screen.getByRole('alert')).not.toHaveTextContent('409')
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: /guardar cambios/i })).toBeEnabled()
  })

  it('prefiere el detalle que trae el error de la API', async () => {
    const user = userEvent.setup()
    const error = Object.assign(new Error('409: otro texto'), { detail: 'La mesa Mesa 2 está en un grupo: sepáralo antes de darla de baja' })
    montar(vi.fn().mockRejectedValue(error))

    await guardar(user)

    expect(await screen.findByRole('alert')).toHaveTextContent('La mesa Mesa 2 está en un grupo: sepáralo antes de darla de baja')
  })

  it('si el error no trae texto, avisa igual que no se guardó', async () => {
    const user = userEvent.setup()
    montar(vi.fn().mockRejectedValue(new Error('')))

    await guardar(user)

    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo guardar la mesa')
  })

  it('el aviso se quita al tocar el formulario y se puede volver a intentar', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
      .mockRejectedValueOnce(new Error('409: La mesa Mesa 2 está en uso: cóbrala o libérala antes de darla de baja'))
      .mockResolvedValueOnce(undefined)
    montar(onSubmit)

    await user.click(screen.getByRole('checkbox', { name: /mesa activa/i }))
    await guardar(user)
    expect(await screen.findByRole('alert')).toBeInTheDocument()

    await user.click(screen.getByRole('checkbox', { name: /mesa activa/i }))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()

    await guardar(user)
    expect(onSubmit).toHaveBeenCalledTimes(2)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('sin error no muestra ningún aviso', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    montar(onSubmit)

    await guardar(user)

    expect(onSubmit).toHaveBeenCalledWith({ id: 'm2', name: 'Mesa 2', capacidad: 2, is_active: true, zona: '' })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
