/**
 * Elegir la máquina de cobro del turno (bandera `eleccionMaquinaVendedor`,
 * a la espera de B-01 y B-02 en el backend).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ElegirMaquina from './ElegirMaquina'
import { listarMaquinasDelVendedor, tomarMaquina } from '../../lib/maquinasCobro'

vi.mock('../../lib/maquinasCobro', async (importOriginal) => ({
  ...(await importOriginal()),
  listarMaquinasDelVendedor: vi.fn(),
  tomarMaquina: vi.fn(),
}))

const maq = (id, nombre, estado, extra = {}) => ({ id, nombre, estado, activa: true, proveedor: 'mercadopago', proveedorLabel: 'Mercado Pago', ...extra })
const LIBRE_MP = maq('m-1', 'Point Mostrador', 'libre')
const LIBRE_HM = maq('m-3', 'Haulmer Caja', 'libre', { proveedor: 'haulmer', proveedorLabel: 'Haulmer' })
const AJENA = maq('m-2', 'Point Barra', 'en_uso')

let onListo
beforeEach(() => {
  vi.clearAllMocks()
  onListo = vi.fn()
  tomarMaquina.mockResolvedValue({})
})

const montar = (props = {}) => render(<ElegirMaquina localId="loc-1" userId="yo" onListo={onListo} {...props} />)
const opcion = (nombre) => screen.getByRole('radio', { name: new RegExp(nombre) })

describe('ElegirMaquina', () => {
  it('lista las máquinas de su local y, si se sabe, de qué proveedor es cada una', async () => {
    listarMaquinasDelVendedor.mockResolvedValue([LIBRE_HM, AJENA, LIBRE_MP])
    montar()

    expect(await screen.findByText('Point Mostrador')).toBeInTheDocument()
    expect(listarMaquinasDelVendedor).toHaveBeenCalledWith('loc-1', 'yo')
    expect(screen.getAllByText('Mercado Pago')).toHaveLength(2)
    expect(screen.getByText('Haulmer')).toBeInTheDocument()
  })

  it('si no se sabe el proveedor (al vendedor el backend no se lo da), no inventa uno', async () => {
    listarMaquinasDelVendedor.mockResolvedValue([{ ...LIBRE_MP, proveedor: null, proveedorLabel: null }])
    montar()

    expect(await screen.findByText('Point Mostrador')).toBeInTheDocument()
    expect(screen.queryByText(/desconocido|Mercado Pago|Haulmer/i)).not.toBeInTheDocument()
  })

  it('una Haulmer avisa que la web todavía no cobra con ese proveedor', async () => {
    listarMaquinasDelVendedor.mockResolvedValue([LIBRE_HM])
    montar()
    expect(await screen.findByText('La web todavía no cobra con Haulmer')).toBeInTheDocument()
  })

  it('la que tiene otra persona aparece "En uso" y no se puede elegir', async () => {
    listarMaquinasDelVendedor.mockResolvedValue([AJENA, LIBRE_MP])
    montar()

    expect(await screen.findByText('En uso por otra persona')).toBeInTheDocument()
    expect(opcion('Point Barra')).toBeDisabled()
    expect(opcion('Point Mostrador')).not.toBeDisabled()
  })

  it('al elegir una libre, la toma y queda con él', async () => {
    listarMaquinasDelVendedor.mockResolvedValue([LIBRE_MP])
    const user = userEvent.setup()
    montar()

    await user.click(await screen.findByRole('radio', { name: /Point Mostrador/ }))
    await user.click(screen.getByRole('button', { name: 'Usar esta máquina' }))

    await waitFor(() => expect(tomarMaquina).toHaveBeenCalledWith('m-1', 'yo'))
    expect(onListo).toHaveBeenCalledWith(expect.objectContaining({ id: 'm-1', estado: 'mia' }))
  })

  it('si ya tiene una, viene elegida, no puede tomar otra y no se le ofrece "seguir sin máquina"', async () => {
    listarMaquinasDelVendedor.mockResolvedValue([{ ...LIBRE_MP, estado: 'mia' }, LIBRE_HM])
    const user = userEvent.setup()
    montar()

    expect(await screen.findByText('Es tuya')).toBeInTheDocument()
    expect(opcion('Point Mostrador')).toBeChecked()
    // Tomar otra le dejaría dos a su nombre, y soltar la suya no es posible (B-02).
    expect(opcion('Haulmer Caja')).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'Seguir sin máquina' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Continuar con mi máquina' }))
    expect(tomarMaquina).not.toHaveBeenCalled()
    expect(onListo).toHaveBeenCalledWith(expect.objectContaining({ id: 'm-1' }))
  })

  it('su máquina desactivada sigue apareciendo como suya: el backend cobra con ella', async () => {
    listarMaquinasDelVendedor.mockResolvedValue([{ ...LIBRE_MP, estado: 'mia', activa: false }, LIBRE_HM])
    montar()

    expect(await screen.findByText('Desactivada')).toBeInTheDocument()
    expect(opcion('Point Mostrador')).toBeChecked()
    expect(opcion('Haulmer Caja')).toBeDisabled()
  })

  it('con dos a su nombre avisa que el cobro necesita una sola y lo deja continuar', async () => {
    listarMaquinasDelVendedor.mockResolvedValue([{ ...LIBRE_MP, estado: 'mia' }, { ...LIBRE_HM, estado: 'mia' }])
    const user = userEvent.setup()
    montar()

    expect(await screen.findByText(/Tienes 2 máquinas a tu nombre/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Continuar' }))
    expect(onListo).toHaveBeenCalledWith(null)
    expect(tomarMaquina).not.toHaveBeenCalled()
  })

  it('al volver a entrar con su máquina ya asignada, no se le pregunta de nuevo', async () => {
    listarMaquinasDelVendedor.mockResolvedValue([{ ...LIBRE_MP, estado: 'mia' }, LIBRE_HM])
    montar({ saltarSiTiene: true })

    await waitFor(() => expect(onListo).toHaveBeenCalledWith(expect.objectContaining({ id: 'm-1' })))
  })

  it('al volver a entrar sin máquina, sí se le pregunta', async () => {
    listarMaquinasDelVendedor.mockResolvedValue([LIBRE_MP])
    montar({ saltarSiTiene: true })

    expect(await screen.findByRole('radio', { name: /Point Mostrador/ })).toBeInTheDocument()
    expect(onListo).not.toHaveBeenCalled()
  })

  it('si el backend todavía no le permite tomarla, lo explica y no avanza', async () => {
    listarMaquinasDelVendedor.mockResolvedValue([LIBRE_MP])
    tomarMaquina.mockRejectedValue(new Error('Todavía no puedes elegir tu máquina desde aquí. Pídele al encargado que te la asigne.'))
    const user = userEvent.setup()
    montar()

    await user.click(await screen.findByRole('radio', { name: /Point Mostrador/ }))
    await user.click(screen.getByRole('button', { name: 'Usar esta máquina' }))

    expect(await screen.findByText(/Pídele al encargado que te la asigne/)).toBeInTheDocument()
    expect(onListo).not.toHaveBeenCalled()
  })

  it('si otra persona la tomó recién (409), recarga la lista y ya no aparece libre', async () => {
    listarMaquinasDelVendedor
      .mockResolvedValueOnce([LIBRE_MP, LIBRE_HM])
      .mockResolvedValueOnce([{ ...LIBRE_MP, estado: 'en_uso' }, LIBRE_HM])
    const conflicto = Object.assign(new Error('Otra persona acaba de tomar esa máquina. Elige otra.'), { conflicto: true })
    tomarMaquina.mockRejectedValue(conflicto)
    const user = userEvent.setup()
    montar()

    await user.click(await screen.findByRole('radio', { name: /Point Mostrador/ }))
    await user.click(screen.getByRole('button', { name: 'Usar esta máquina' }))

    expect(await screen.findByText(/Otra persona acaba de tomar esa máquina/)).toBeInTheDocument()
    await waitFor(() => expect(opcion('Point Mostrador')).toBeDisabled())
    expect(opcion('Point Mostrador')).not.toBeChecked()
    expect(listarMaquinasDelVendedor).toHaveBeenCalledTimes(2)
  })

  it('si no se pueden cargar las máquinas, no afirma que no haya: deja reintentar o continuar', async () => {
    listarMaquinasDelVendedor.mockRejectedValueOnce(new Error('sin conexión')).mockResolvedValueOnce([LIBRE_MP])
    const user = userEvent.setup()
    montar()

    expect(await screen.findByText('sin conexión')).toBeInTheDocument()
    expect(screen.queryByText(/No hay máquinas de cobro disponibles/)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Continuar sin elegir' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByRole('radio', { name: /Point Mostrador/ })).toBeInTheDocument()
  })

  it('puede seguir sin máquina', async () => {
    listarMaquinasDelVendedor.mockResolvedValue([LIBRE_MP])
    const user = userEvent.setup()
    montar()

    await user.click(await screen.findByRole('button', { name: 'Seguir sin máquina' }))
    expect(onListo).toHaveBeenCalledWith(null)
  })

  it('si el local no tiene máquinas, el turno sigue igual y avisa que solo podrá cobrar sin tarjeta', async () => {
    listarMaquinasDelVendedor.mockResolvedValue([])
    const user = userEvent.setup()
    montar()

    expect(await screen.findByText(/solo podrás cobrar sin tarjeta/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Continuar' }))
    expect(onListo).toHaveBeenCalledWith(null)
  })
})
