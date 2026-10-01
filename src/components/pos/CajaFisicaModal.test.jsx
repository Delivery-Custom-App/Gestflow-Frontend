/**
 * Alta y renombrado de cajas físicas desde la web.
 *
 * El backend tenía el CRUD completo y el frontend nunca lo usó: si un local no
 * tenía ninguna caja física, no había dónde abrir turno ni qué vincular a
 * MercadoPago, y el panel solo decía que no había ninguna registrada.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import CajaFisicaModal from './CajaFisicaModal'
import { crearCajaFisica, renombrarCajaFisica } from '../../lib/administrativeApi'

vi.mock('../../lib/administrativeApi', () => ({
  crearCajaFisica: vi.fn(),
  renombrarCajaFisica: vi.fn(),
}))

describe('CajaFisicaModal', () => {
  let onClose
  let onSaved

  beforeEach(() => {
    vi.clearAllMocks()
    onClose = vi.fn()
    onSaved = vi.fn()
    crearCajaFisica.mockResolvedValue({ id: 'cf-9', nombre: 'Caja 2', name: 'Caja 2' })
    renombrarCajaFisica.mockResolvedValue({ id: 'cf-1', nombre: 'Mostrador', name: 'Mostrador' })
  })

  const montarAlta = () => render(<CajaFisicaModal localId="loc-1" onClose={onClose} onSaved={onSaved} />)
  const montarRenombrar = () => render(
    <CajaFisicaModal localId="loc-1" cajaFisica={{ id: 'cf-1', name: 'Caja principal' }} onClose={onClose} onSaved={onSaved} />,
  )

  it('crea una caja física con el nombre escrito', async () => {
    const user = userEvent.setup()
    montarAlta()

    await user.type(screen.getByLabelText(/nombre/i), 'Caja 2')
    await user.click(screen.getByRole('button', { name: /crear caja física/i }))

    expect(crearCajaFisica).toHaveBeenCalledWith('loc-1', 'Caja 2')
    expect(onSaved).toHaveBeenCalled()
    expect(onClose).toHaveBeenCalled()
  })

  it('al renombrar parte del nombre actual y guarda el nuevo', async () => {
    const user = userEvent.setup()
    montarRenombrar()

    const campo = screen.getByLabelText(/nombre/i)
    expect(campo).toHaveValue('Caja principal')

    await user.clear(campo)
    await user.type(campo, 'Mostrador')
    await user.click(screen.getByRole('button', { name: /guardar nombre/i }))

    expect(renombrarCajaFisica).toHaveBeenCalledWith('cf-1', 'Mostrador')
    expect(crearCajaFisica).not.toHaveBeenCalled()
  })

  it('el nombre repetido en el local se explica en castellano, no con el código del error', async () => {
    crearCajaFisica.mockRejectedValue(new Error('409: Ya existe una caja física con ese nombre en este local'))
    const user = userEvent.setup()
    montarAlta()

    await user.type(screen.getByLabelText(/nombre/i), 'Caja principal')
    await user.click(screen.getByRole('button', { name: /crear caja física/i }))

    expect(await screen.findByText(/ya existe una caja física con ese nombre en este local/i)).toBeInTheDocument()
    expect(screen.queryByText(/^409/)).not.toBeInTheDocument()
    // El modal no se cierra: el usuario tiene que corregir el nombre.
    expect(onClose).not.toHaveBeenCalled()
    expect(onSaved).not.toHaveBeenCalled()
  })

  it('no envía un nombre vacío', async () => {
    const user = userEvent.setup()
    montarAlta()

    await user.click(screen.getByRole('button', { name: /crear caja física/i }))

    expect(crearCajaFisica).not.toHaveBeenCalled()
    expect(await screen.findByText(/el nombre es obligatorio/i)).toBeInTheDocument()
  })

  it('recorta los espacios del nombre antes de guardarlo', async () => {
    const user = userEvent.setup()
    montarAlta()

    await user.type(screen.getByLabelText(/nombre/i), '   Terraza   ')
    await user.click(screen.getByRole('button', { name: /crear caja física/i }))

    expect(crearCajaFisica).toHaveBeenCalledWith('loc-1', 'Terraza')
  })
})
