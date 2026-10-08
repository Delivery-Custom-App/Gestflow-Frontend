/**
 * La barra del turno, solo en la vista del vendedor. "Cerrar turno" queda
 * hecho detrás de la bandera `cierreTurnoVendedor`, apagada hasta que el
 * backend defina la opción del vendedor.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { toast } from 'sonner'
import TurnoVendedorBarra from './TurnoVendedorBarra'
import { TurnoVendedorContext } from '../../context/turnoVendedor'
import { closeCaja } from '../../lib/salesApi'
import { listarMaquinasDelVendedor } from '../../lib/maquinasCobro'
import { V2_FEATURES } from '../../lib/v2Features'

vi.mock('../../lib/salesApi', () => ({ closeCaja: vi.fn() }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'yo' } }) }))
vi.mock('../../lib/maquinasCobro', async (importOriginal) => ({
  ...(await importOriginal()),
  listarMaquinasDelVendedor: vi.fn(),
}))

const TURNO = { id: 'turno-1', local_id: 'loc-1', opened_at: '2026-10-04T12:05:00' }
const MAQUINA_MIA = { id: 'm-1', nombre: 'Point Mostrador', proveedor: 'mercadopago', proveedorLabel: 'Mercado Pago', activa: true, estado: 'mia' }
const MAQUINA_AJENA = { id: 'm-2', nombre: 'Haulmer 2', proveedor: 'haulmer', proveedorLabel: 'Haulmer', activa: true, estado: 'en_uso' }
const original = { ...V2_FEATURES }

function montar(valor) {
  return render(
    <TurnoVendedorContext.Provider value={valor}>
      <TurnoVendedorBarra />
    </TurnoVendedorContext.Provider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(window, 'confirm').mockReturnValue(true)
  listarMaquinasDelVendedor.mockResolvedValue([])
})
afterEach(() => {
  Object.assign(V2_FEATURES, original)
  vi.restoreAllMocks()
})

describe('TurnoVendedorBarra', () => {
  it('fuera de la vista del vendedor no muestra nada', () => {
    const { container } = render(<TurnoVendedorBarra />)
    expect(container).toBeEmptyDOMElement()
  })

  it('muestra que su turno está abierto y desde qué hora', () => {
    montar({ turno: TURNO, alCerrar: vi.fn() })
    expect(screen.getByText(/Turno abierto desde las 12:05/)).toBeInTheDocument()
  })

  it('la bandera cierreTurnoVendedor está apagada: el vendedor no tiene "Cerrar turno"', () => {
    expect(V2_FEATURES.cierreTurnoVendedor).toBe(false)
    montar({ turno: TURNO, alCerrar: vi.fn() })
    expect(screen.queryByRole('button', { name: /Cerrar turno/ })).not.toBeInTheDocument()
  })

  it('con la bandera encendida, "Cerrar turno" confirma, cierra y avisa', async () => {
    V2_FEATURES.cierreTurnoVendedor = true
    closeCaja.mockResolvedValue({ id: 'turno-1', status: 'closed' })
    const alCerrar = vi.fn()
    const user = userEvent.setup()
    montar({ turno: TURNO, alCerrar })

    await user.click(screen.getByRole('button', { name: /Cerrar turno/ }))

    await waitFor(() => expect(closeCaja).toHaveBeenCalledWith('turno-1'))
    expect(window.confirm).toHaveBeenCalled()
    expect(toast.success).toHaveBeenCalledWith('Turno cerrado')
    expect(alCerrar).toHaveBeenCalled()
  })

  it('si no confirma, no cierra', async () => {
    V2_FEATURES.cierreTurnoVendedor = true
    window.confirm.mockReturnValue(false)
    const user = userEvent.setup()
    montar({ turno: TURNO, alCerrar: vi.fn() })

    await user.click(screen.getByRole('button', { name: /Cerrar turno/ }))
    expect(closeCaja).not.toHaveBeenCalled()
  })

  it('muestra con qué máquina cobra y de qué proveedor es', async () => {
    listarMaquinasDelVendedor.mockResolvedValue([MAQUINA_AJENA, MAQUINA_MIA])
    montar({ turno: TURNO, alCerrar: vi.fn() })

    expect(await screen.findByText(/Point Mostrador · Mercado Pago/)).toBeInTheDocument()
    expect(listarMaquinasDelVendedor).toHaveBeenCalledWith('loc-1', 'yo')
    expect(screen.queryByText(/Haulmer 2/)).not.toBeInTheDocument()
  })

  it('sin proveedor conocido muestra solo el nombre de la máquina', async () => {
    listarMaquinasDelVendedor.mockResolvedValue([{ ...MAQUINA_MIA, proveedor: null, proveedorLabel: null }])
    montar({ turno: TURNO, alCerrar: vi.fn() })

    const chip = await screen.findByText(/Point Mostrador/)
    expect(chip.textContent.trim()).toBe('Point Mostrador')
  })

  it('sin máquina asignada avisa que solo puede cobrar sin tarjeta (corto en el teléfono)', async () => {
    listarMaquinasDelVendedor.mockResolvedValue([MAQUINA_AJENA])
    montar({ turno: TURNO, alCerrar: vi.fn() })

    expect(await screen.findByText('Sin máquina de cobro: solo cobros sin tarjeta')).toHaveClass('hidden', 'sm:inline')
    expect(screen.getByText('Sin máquina')).toHaveClass('sm:hidden')
  })

  it('su máquina desactivada se muestra como suya: el backend cobra igual con ella', async () => {
    listarMaquinasDelVendedor.mockResolvedValue([{ ...MAQUINA_MIA, activa: false }])
    montar({ turno: TURNO, alCerrar: vi.fn() })

    expect(await screen.findByText(/Point Mostrador · Mercado Pago \(desactivada\)/)).toBeInTheDocument()
    expect(screen.queryByText(/Sin máquina/)).not.toBeInTheDocument()
  })

  it('con dos a su nombre avisa en vez de mostrar una cualquiera', async () => {
    listarMaquinasDelVendedor.mockResolvedValue([MAQUINA_MIA, { ...MAQUINA_AJENA, estado: 'mia' }])
    montar({ turno: TURNO, alCerrar: vi.fn() })

    expect(await screen.findByText(/2 máquinas a tu nombre/)).toBeInTheDocument()
    expect(screen.queryByText(/Point Mostrador/)).not.toBeInTheDocument()
  })

  it('con una Haulmer avisa que la web todavía no cobra con ese proveedor', async () => {
    listarMaquinasDelVendedor.mockResolvedValue([{ ...MAQUINA_AJENA, estado: 'mia' }])
    montar({ turno: TURNO, alCerrar: vi.fn() })

    const chip = (await screen.findByText(/Haulmer 2 · Haulmer/)).closest('[title]')
    expect(chip).toHaveAttribute('title', 'La web todavía no cobra con Haulmer.')
  })

  it('se actualiza sola durante el turno: refleja la máquina que el encargado le asigna', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      listarMaquinasDelVendedor.mockResolvedValueOnce([]).mockResolvedValue([MAQUINA_MIA])
      montar({ turno: TURNO, alCerrar: vi.fn() })
      expect(await screen.findByText('Sin máquina')).toBeInTheDocument()

      await vi.advanceTimersByTimeAsync(60_000)
      expect(await screen.findByText(/Point Mostrador · Mercado Pago/)).toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })

  it('y también al volver a la pestaña', async () => {
    listarMaquinasDelVendedor.mockResolvedValueOnce([]).mockResolvedValue([MAQUINA_MIA])
    montar({ turno: TURNO, alCerrar: vi.fn() })
    expect(await screen.findByText('Sin máquina')).toBeInTheDocument()

    window.dispatchEvent(new Event('focus'))
    expect(await screen.findByText(/Point Mostrador · Mercado Pago/)).toBeInTheDocument()
  })

  it('si no se pueden consultar las máquinas, no afirma nada', async () => {
    listarMaquinasDelVendedor.mockRejectedValue(new Error('sin conexión'))
    montar({ turno: TURNO, alCerrar: vi.fn() })

    await waitFor(() => expect(listarMaquinasDelVendedor).toHaveBeenCalled())
    expect(screen.queryByText(/máquina de cobro/i)).not.toBeInTheDocument()
    expect(screen.getByText(/Turno abierto/)).toBeInTheDocument()
  })

  it('con órdenes en curso (409) explica qué hacer y el turno sigue abierto', async () => {
    V2_FEATURES.cierreTurnoVendedor = true
    closeCaja.mockRejectedValue(new Error('No se puede cerrar la caja: hay órdenes en curso contra ella'))
    const alCerrar = vi.fn()
    const user = userEvent.setup()
    montar({ turno: TURNO, alCerrar })

    await user.click(screen.getByRole('button', { name: /Cerrar turno/ }))

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(
      'No se puede cerrar el turno: todavía hay órdenes en curso. Cóbralas o cancélalas primero.',
    ))
    expect(alCerrar).not.toHaveBeenCalled()
  })
})
