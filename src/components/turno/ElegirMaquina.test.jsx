/**
 * Lista de máquinas POS para elegir (T-71): quién usa cada una, compartir una
 * con una persona, llenas no elegibles y los 409 del backend.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ElegirMaquina from './ElegirMaquina'
import { listarMaquinasDelLocal, mapMaquina } from '../../lib/maquinasCobro'

vi.mock('../../lib/maquinasCobro', async (importOriginal) => ({
  ...(await importOriginal()),
  listarMaquinasDelLocal: vi.fn(),
}))

const maquina = (extra) => mapMaquina({
  id: 'm-1', display_name: 'Point barra', provider: 'mercadopago', is_active: true, ocupacion: 0, usuarios: [], ...extra,
})
const LIBRE = maquina({ id: 'm-1', display_name: 'Point barra' })
const COMPARTIBLE = maquina({ id: 'm-2', display_name: 'Point terraza', ocupacion: 1, usuarios: ['Ana'] })
const LLENA = maquina({ id: 'm-3', display_name: 'Point salón', ocupacion: 2, usuarios: ['Ana', 'Luis'] })
const DESACTIVADA = maquina({ id: 'm-4', display_name: 'Point vieja', is_active: false })
const HAULMER = maquina({ id: 'm-5', display_name: 'Haulmer caja', provider: 'haulmer' })

const montar = (props = {}) => render(<ElegirMaquina localId="loc-1" onConfirmar={vi.fn()} {...props} />)

beforeEach(() => {
  vi.clearAllMocks()
  listarMaquinasDelLocal.mockResolvedValue([LIBRE, COMPARTIBLE, LLENA, DESACTIVADA])
})

describe('ElegirMaquina', () => {
  it('muestra cada máquina con quién la usa: libre, compartida, llena y desactivada', async () => {
    montar()
    expect(await screen.findByRole('radio', { name: 'Point barra · Libre' })).toBeEnabled()
    expect(screen.getByRole('radio', { name: 'Point terraza · Compartida con Ana' })).toBeEnabled()
    expect(screen.getByRole('radio', { name: 'Point salón · Llena (Ana y Luis)' })).toBeDisabled()
    expect(screen.getByRole('radio', { name: 'Point vieja · Desactivada' })).toBeDisabled()
    expect(listarMaquinasDelLocal).toHaveBeenCalledWith('loc-1')
  })

  it('una libre se toma sin compartir', async () => {
    const onConfirmar = vi.fn().mockResolvedValue(undefined)
    const user = userEvent.setup()
    montar({ onConfirmar })

    await user.click(await screen.findByRole('radio', { name: 'Point barra · Libre' }))
    await user.click(screen.getByRole('button', { name: 'Usar esta máquina' }))

    expect(onConfirmar).toHaveBeenCalledWith(expect.objectContaining({ id: 'm-1' }), { compartir: false })
  })

  it('una con una persona se comparte: el botón lo dice y se pide compartir', async () => {
    const onConfirmar = vi.fn().mockResolvedValue(undefined)
    const user = userEvent.setup()
    montar({ onConfirmar })

    await user.click(await screen.findByRole('radio', { name: 'Point terraza · Compartida con Ana' }))
    await user.click(screen.getByRole('button', { name: 'Compartir esta máquina' }))

    expect(onConfirmar).toHaveBeenCalledWith(expect.objectContaining({ id: 'm-2' }), { compartir: true })
  })

  it('con una sola opción la deja elegida', async () => {
    listarMaquinasDelLocal.mockResolvedValue([LIBRE, LLENA])
    montar()
    expect(await screen.findByRole('radio', { name: 'Point barra · Libre' })).toBeChecked()
  })

  it('un 409 muestra el motivo del backend y vuelve a pedir la lista', async () => {
    const conflicto = Object.assign(new Error('La máquina «Point barra» ya la usan 2 personas (Ana y Luis): elige otra'), { conflicto: true })
    const onConfirmar = vi.fn().mockRejectedValue(conflicto)
    const user = userEvent.setup()
    montar({ onConfirmar })

    await user.click(await screen.findByRole('radio', { name: 'Point barra · Libre' }))
    await user.click(screen.getByRole('button', { name: 'Usar esta máquina' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('ya la usan 2 personas (Ana y Luis): elige otra')
    await waitFor(() => expect(listarMaquinasDelLocal).toHaveBeenCalledTimes(2))
  })

  it('otro error se muestra sin recargar la lista', async () => {
    const onConfirmar = vi.fn().mockRejectedValue(new Error('Esta máquina no tiene lector configurado'))
    const user = userEvent.setup()
    montar({ onConfirmar })

    await user.click(await screen.findByRole('radio', { name: 'Point barra · Libre' }))
    await user.click(screen.getByRole('button', { name: 'Usar esta máquina' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Esta máquina no tiene lector configurado')
    expect(listarMaquinasDelLocal).toHaveBeenCalledTimes(1)
  })

  it('la máquina que ya tiene el turno aparece como suya y no se ofrece de nuevo', async () => {
    montar({ maquinaActualId: 'm-1' })
    expect(await screen.findByRole('radio', { name: 'Point barra · Tu máquina' })).toBeDisabled()
    expect(screen.getByRole('radio', { name: 'Point terraza · Compartida con Ana' })).toBeChecked()
  })

  it('si todas están llenas o desactivadas, lo dice y no muestra el botón de usar', async () => {
    listarMaquinasDelLocal.mockResolvedValue([LLENA, DESACTIVADA])
    montar({ onSinMaquina: vi.fn(), textoSinMaquina: 'Seguir sin tarjeta' })
    expect(await screen.findByText(/Todas las máquinas están llenas o desactivadas/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Usar esta máquina' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Seguir sin tarjeta' })).toBeInTheDocument()
  })

  it('sin máquinas en el local, pide al encargado que registre una', async () => {
    listarMaquinasDelLocal.mockResolvedValue([])
    montar()
    expect(await screen.findByText(/Tu local no tiene máquinas de cobro registradas/)).toBeInTheDocument()
  })

  it('avisa si es una Haulmer: la web todavía no cobra con ella', async () => {
    listarMaquinasDelLocal.mockResolvedValue([HAULMER])
    montar()
    expect(await screen.findByText('La web todavía no cobra con Haulmer')).toBeInTheDocument()
  })

  it('si no se pueden cargar, no afirma que no haya máquinas y permite reintentar', async () => {
    listarMaquinasDelLocal.mockRejectedValueOnce(new Error('500: error'))
    const user = userEvent.setup()
    montar()
    expect(await screen.findByRole('alert')).toHaveTextContent('500: error')
    expect(screen.queryByText(/no tiene máquinas/)).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByRole('radio', { name: 'Point barra · Libre' })).toBeInTheDocument()
  })

  it('"Seguir sin máquina" avisa a quien la usa', async () => {
    const onSinMaquina = vi.fn()
    const user = userEvent.setup()
    montar({ onSinMaquina })
    await user.click(await screen.findByRole('button', { name: 'Seguir sin máquina' }))
    expect(onSinMaquina).toHaveBeenCalled()
  })
})
