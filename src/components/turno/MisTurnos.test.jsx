import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import MisTurnos from './MisTurnos'
import { getCajaResumen, getMovimientosCaja, listCajas } from '../../lib/salesApi'

vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'yo' } }) }))
vi.mock('../../lib/salesApi', () => ({ listCajas: vi.fn(), getCajaResumen: vi.fn(), getMovimientosCaja: vi.fn() }))

const TURNOS = [
  { id: 't-hoy', cashier_user_id: 'yo', business_date: '2026-10-04', status: 'open', is_active: true, opened_at: '2026-10-04T12:00:00', closed_at: null },
  { id: 't-ayer', cashier_user_id: 'yo', business_date: '2026-10-03', status: 'closed', is_active: false, opened_at: '2026-10-03T12:00:00', closed_at: '2026-10-03T20:00:00' },
  { id: 't-otro', cashier_user_id: 'otro', business_date: '2026-10-04', status: 'open', is_active: true, opened_at: '2026-10-04T13:00:00', closed_at: null },
]

function montar() {
  return render(
    <MemoryRouter initialEntries={['/local/loc-1/pos/mis-turnos']}>
      <Routes><Route path="/local/:localId/pos/mis-turnos" element={<MisTurnos />} /></Routes>
    </MemoryRouter>,
  )
}
const filas = () => screen.getAllByRole('row').slice(1)

beforeEach(() => {
  vi.clearAllMocks()
  listCajas.mockResolvedValue(TURNOS)
  getCajaResumen.mockResolvedValue({ monto_apertura: '0.00', total_ingresos: '7000.00', total_esperado: '7000.00', por_metodo: [] })
  getMovimientosCaja.mockResolvedValue([{ id: 'm-1', tipo: 'ingreso', monto: '7000.00', order_id: 'o-1' }])
})

describe('MisTurnos', () => {
  it('el vendedor ve solo sus turnos, aunque el backend le mande otros', async () => {
    montar()

    expect(await screen.findByRole('heading', { name: 'Mis turnos' })).toBeInTheDocument()
    expect(await screen.findByText('04/10/2026')).toBeInTheDocument()
    expect(listCajas).toHaveBeenCalledWith('loc-1')
    expect(filas()).toHaveLength(2)
    expect(screen.queryByRole('columnheader', { name: 'Vendedor' })).not.toBeInTheDocument()
  })

  it('filtra por fecha', async () => {
    const user = userEvent.setup()
    montar()
    await screen.findByText('04/10/2026')

    await user.type(screen.getByLabelText('Fecha'), '2026-10-03')
    expect(filas()).toHaveLength(1)
    expect(within(filas()[0]).getByText('03/10/2026')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Quitar filtros' }))
    expect(filas()).toHaveLength(2)
  })

  it('al abrir un turno ve su resumen, sin poder cerrarlo', async () => {
    const user = userEvent.setup()
    montar()
    await screen.findByText('04/10/2026')

    await user.click(within(filas()[0]).getByRole('button', { name: 'Ver resumen' }))

    const panel = await screen.findByRole('dialog', { name: 'Resumen del turno' })
    expect(await within(panel).findByText('Ventas')).toBeInTheDocument()
    expect(within(panel).getByText('Egresos')).toBeInTheDocument()
    expect(within(panel).queryByRole('button', { name: /Cerrar turno/ })).not.toBeInTheDocument()
    await user.click(within(panel).getByRole('button', { name: 'Cerrar' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('sin turnos lo dice', async () => {
    listCajas.mockResolvedValue([])
    montar()
    expect(await screen.findByText('Todavía no tienes turnos.')).toBeInTheDocument()
  })

  it('si no se pueden cargar, permite reintentar', async () => {
    listCajas.mockRejectedValueOnce(new Error('sin conexión'))
    const user = userEvent.setup()
    montar()

    expect(await screen.findByText('sin conexión')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByText('04/10/2026')).toBeInTheDocument()
  })
})
