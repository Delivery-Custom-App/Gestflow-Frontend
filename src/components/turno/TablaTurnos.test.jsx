import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import TablaTurnos from './TablaTurnos'
import { getCajaResumen } from '../../lib/salesApi'

vi.mock('../../lib/salesApi', () => ({ getCajaResumen: vi.fn(), getMovimientosCaja: vi.fn(), listCajas: vi.fn() }))

const turno = (i, extra = {}) => ({
  id: `t-${i}`, cashier_user_id: 'ana', business_date: '2026-10-04', status: 'closed',
  opened_at: '2026-10-04T12:00:00', closed_at: '2026-10-04T20:30:00', total_ingresos: '9500.00', ...extra,
})

beforeEach(() => {
  vi.clearAllMocks()
})

describe('TablaTurnos', () => {
  it('muestra fecha, apertura, cierre, total vendido y estado (sin columna de máquina: B-03)', async () => {
    render(<TablaTurnos turnos={[turno(1)]} vacio="sin turnos" />)

    const fila = screen.getAllByRole('row')[1]
    expect(within(fila).getByText('04/10/2026')).toBeInTheDocument()
    expect(within(fila).getByText('Cerrado')).toBeInTheDocument()
    expect(within(fila).getByText('$9.500')).toBeInTheDocument()
    // A-01: el total viene en el turno de GET /cajas; no se pide un resumen por fila.
    expect(getCajaResumen).not.toHaveBeenCalled()
    expect(screen.queryByRole('columnheader', { name: /Máquina/i })).not.toBeInTheDocument()
  })

  it('un turno abierto no tiene hora de cierre', () => {
    render(<TablaTurnos turnos={[turno(1, { status: 'open', closed_at: null })]} vacio="sin turnos" />)
    const fila = screen.getAllByRole('row')[1]
    expect(within(fila).getByText('Abierto')).toBeInTheDocument()
    expect(within(fila).getAllByText('—')).toHaveLength(1)
  })

  it('si el turno no trae el total, no muestra un $0 falso', () => {
    render(<TablaTurnos turnos={[turno(1, { total_ingresos: undefined })]} vacio="sin turnos" />)
    expect(screen.getByTitle('Sin dato')).toHaveTextContent('—')
    expect(screen.queryByText('$0')).not.toBeInTheDocument()
  })

  it('con columnas opcionales: el turno con su caja física y quién lo abrió', () => {
    render(<TablaTurnos turnos={[turno(1, { name: 'Turno t-1' })]} cajaFisicaDe={() => 'Caja principal'}
      vendedorDe={() => 'Ana Rojas'} vacio="sin turnos" />)
    expect(screen.getByRole('columnheader', { name: 'Vendedor' })).toBeInTheDocument()
    expect(screen.getByText('Ana Rojas')).toBeInTheDocument()
    expect(screen.getByText('Caja principal')).toBeInTheDocument()
  })

  it('"Ver resumen" entrega el turno', async () => {
    const onVer = vi.fn()
    render(<TablaTurnos turnos={[turno(1)]} onVer={onVer} vacio="sin turnos" />)
    await userEvent.setup().click(screen.getByRole('button', { name: 'Ver resumen' }))
    expect(onVer).toHaveBeenCalledWith(expect.objectContaining({ id: 't-1' }))
  })

  it('muestra 20 por página, sin pedir resúmenes', async () => {
    const turnos = Array.from({ length: 25 }, (_, i) => turno(i))
    render(<TablaTurnos turnos={turnos} vacio="sin turnos" />)

    expect(screen.getAllByRole('row')).toHaveLength(21)
    expect(getCajaResumen).not.toHaveBeenCalled()
    await userEvent.setup().click(screen.getByRole('button', { name: 'Ver más' }))
    expect(screen.getAllByRole('row')).toHaveLength(26)
    expect(screen.queryByRole('button', { name: 'Ver más' })).not.toBeInTheDocument()
  })

  it('sin turnos dice por qué', () => {
    render(<TablaTurnos turnos={[]} vacio="Todavía no tienes turnos." />)
    expect(screen.getByText('Todavía no tienes turnos.')).toBeInTheDocument()
  })
})
