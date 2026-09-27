/**
 * El alta de mesa pedía capacidad y zona como obligatorias, y la capa de API
 * las descartaba antes de enviar la petición: el usuario completaba datos que
 * se tiraban. La capacidad ahora se guarda; la zona se retira porque el backend
 * no tiene zonas.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import CreateMesaModal from './CreateMesaModal'

describe('CreateMesaModal', () => {
  let onSubmit

  beforeEach(() => {
    vi.clearAllMocks()
    onSubmit = vi.fn(() => Promise.resolve())
    render(<CreateMesaModal mesas={[]} onClose={() => {}} onSubmit={onSubmit} />)
  })

  it('no pide zona, que es un dato que el backend no guarda', () => {
    expect(screen.queryByLabelText(/zona/i)).not.toBeInTheDocument()
    expect(screen.queryByPlaceholderText(/zona/i)).not.toBeInTheDocument()
  })

  it('envía la capacidad para que quede guardada en la mesa', async () => {
    const user = userEvent.setup()

    await user.type(screen.getByLabelText(/número de mesa|nombre/i), 'Mesa 7')
    await user.type(screen.getByLabelText(/capacidad/i), '6')
    await user.click(screen.getByRole('button', { name: /crear/i }))

    expect(onSubmit).toHaveBeenCalledWith({ name: 'Mesa 7', capacidad: '6' })
  })

  it('sigue exigiendo los datos que sí se guardan', async () => {
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: /crear/i }))

    expect(onSubmit).not.toHaveBeenCalled()
    expect(await screen.findByText(/capacidad es obligatoria/i)).toBeInTheDocument()
  })
})
