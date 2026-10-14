/** Pantalla «Mesas no cobradas» (T-46). */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import NoCobradas from './NoCobradas'
import { listarNoCobradas } from '../lib/noCobradas'

const sesion = vi.hoisted(() => ({ rol: 'Admin Negocio' }))
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ userRole: sesion.rol }) }))
vi.mock('../hooks/useLocals', () => ({ useLocals: () => ({ locales: [{ id: 'loc-1', name: 'Centro' }, { id: 'loc-2', name: 'Express' }] }) }))
vi.mock('../lib/apiClient', () => ({ listUsers: vi.fn(() => Promise.resolve([{ id: 'u-ana', first_name: 'Ana', last_name: 'Rojas' }])) }))
vi.mock('../lib/fondoEmergencia', () => ({ hoyEnChile: () => '2026-10-14' }))
vi.mock('../lib/noCobradas', async (importOriginal) => ({ ...(await importOriginal()), listarNoCobradas: vi.fn() }))

const FILAS = [
  {
    evento_id: 'e1', tipo: 'mesa_no_cobrada', mesa: 'Mesa 2', mesero_id: 'u-ana', total: '4400.00', hora: '2026-10-14T19:19:14Z',
    registrado_por_email: 'enc@demo.cl', motivo: 'Quedó abierta al cerrar la caja',
    consumo: [{ producto: 'Brownie', cantidad: '2.000', precio: '2200.00', subtotal: '4400.00' }],
  },
  { evento_id: 'e2', tipo: 'orden_vencida', mesa: null, mesero_id: null, total: '1500.00', hora: '2026-10-14T20:00:00Z', registrado_por_email: 'enc@demo.cl', motivo: 'Vencido', consumo: [] },
]

const montar = () => render(<MemoryRouter><NoCobradas localId="loc-1" /></MemoryRouter>)

beforeEach(() => {
  vi.clearAllMocks()
  sesion.rol = 'Admin Negocio'
  listarNoCobradas.mockResolvedValue(FILAS)
})

describe('NoCobradas', () => {
  it('por defecto pide las de hoy y muestra el total del rango', async () => {
    montar()
    expect(await screen.findByTestId('total-no-cobrado')).toHaveTextContent('$5.900')
    expect(listarNoCobradas).toHaveBeenCalledWith('loc-1', { desde: '2026-10-14', hasta: '2026-10-14' })
  })

  it('cada fila muestra tipo, mesa, mesero, total, motivo y quién cerró', async () => {
    montar()
    const tabla = await screen.findByRole('table', { name: 'Mesas no cobradas' })
    const fila = within(tabla).getByText('Mesa 2').closest('tr')
    expect(within(fila).getByText('Mesa no cobrada')).toBeInTheDocument()
    await waitFor(() => expect(within(fila).getByText('Ana Rojas')).toBeInTheDocument())
    expect(within(fila).getByText('$4.400')).toBeInTheDocument()
    expect(within(fila).getByText('Quedó abierta al cerrar la caja')).toBeInTheDocument()
    expect(within(fila).getByText('enc@demo.cl')).toBeInTheDocument()
    expect(within(tabla).getByText('Pedido vencido')).toBeInTheDocument()
  })

  it('se puede expandir el consumo', async () => {
    const user = userEvent.setup()
    montar()
    await user.click(await screen.findByRole('button', { name: 'Ver consumo de Mesa 2' }))
    const consumo = screen.getByRole('list', { name: 'Consumo de Mesa 2' })
    expect(consumo).toHaveTextContent('2 × Brownie ($2.200)')
    expect(consumo).toHaveTextContent('$4.400')
  })

  it('cambiar las fechas vuelve a pedir; un rango al revés no consulta', async () => {
    const user = userEvent.setup()
    montar()
    await screen.findByTestId('total-no-cobrado')
    const desde = screen.getByLabelText('Desde')
    await user.clear(desde)
    await user.type(desde, '2026-10-10')
    await waitFor(() => expect(listarNoCobradas).toHaveBeenLastCalledWith('loc-1', { desde: '2026-10-10', hasta: '2026-10-14' }))
    const llamadas = listarNoCobradas.mock.calls.length
    fireEvent.change(screen.getByLabelText('Hasta'), { target: { value: '2026-10-05' } })
    expect(screen.getByRole('alert')).toHaveTextContent(/posterior/)
    expect(listarNoCobradas.mock.calls.length).toBe(llamadas)
  })

  it('pagina de a 20', async () => {
    const user = userEvent.setup()
    listarNoCobradas.mockResolvedValue(Array.from({ length: 25 }, (_, i) => ({ ...FILAS[1], evento_id: `e${i}`, mesa: `Mesa ${i}` })))
    montar()
    const tabla = await screen.findByRole('table', { name: 'Mesas no cobradas' })
    expect(within(tabla).getAllByRole('row')).toHaveLength(21)
    await user.click(screen.getByRole('button', { name: 'Siguiente' }))
    expect(within(screen.getByRole('table', { name: 'Mesas no cobradas' })).getAllByRole('row')).toHaveLength(6)
  })

  it('el dueño puede elegir el local; el encargado no', async () => {
    const { unmount } = montar()
    expect(await screen.findByLabelText('Local')).toBeInTheDocument()
    unmount()
    sesion.rol = 'Admin'
    montar()
    await screen.findByTestId('total-no-cobrado')
    expect(screen.queryByLabelText('Local')).not.toBeInTheDocument()
  })

  it('sin registros lo dice', async () => {
    listarNoCobradas.mockResolvedValue([])
    montar()
    expect(await screen.findByText('No quedó nada sin cobrar en esas fechas.')).toBeInTheDocument()
  })
})
