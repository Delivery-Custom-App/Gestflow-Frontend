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
import { V2_FEATURES } from '../../lib/v2Features'

vi.mock('../../lib/salesApi', () => ({ closeCaja: vi.fn() }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const TURNO = { id: 'turno-1', opened_at: '2026-10-04T12:05:00' }
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
