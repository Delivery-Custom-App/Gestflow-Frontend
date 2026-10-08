import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import TarjetaFondoEmergencia from './TarjetaFondoEmergencia'
import { getFondoDelLocal, listarMovimientos } from '../lib/fondoEmergencia'

const sesion = vi.hoisted(() => ({ role: 'Admin' }))
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ userRole: sesion.role }) }))
vi.mock('../lib/fondoEmergencia', async (importOriginal) => ({
  ...(await importOriginal()),
  getFondoDelLocal: vi.fn(),
  listarMovimientos: vi.fn(),
}))

const FONDO = { id: 'f1', local_id: 'l1', saldo: '20000.00' }
const MOVIMIENTOS = [
  { id: 'm2', tipo: 'uso', monto: '5000.00', motivo: 'Reparación de la cámara de frío', created_at: '2026-10-05T15:00:00Z' },
  { id: 'm1', tipo: 'aporte', monto: '25000.00', motivo: null, created_at: '2026-10-04T15:00:00Z' },
]

beforeEach(() => {
  vi.clearAllMocks()
  sesion.role = 'Admin'
  getFondoDelLocal.mockResolvedValue(FONDO)
  listarMovimientos.mockResolvedValue(MOVIMIENTOS)
})

const montar = () => render(<MemoryRouter><TarjetaFondoEmergencia localId="l1" /></MemoryRouter>)

describe('TarjetaFondoEmergencia', () => {
  it('muestra el saldo y los últimos movimientos: fecha, aporte o uso, monto y motivo', async () => {
    montar()
    expect(await screen.findByTestId('saldo-tarjeta-fondo')).toHaveTextContent('$20.000')
    expect(listarMovimientos).toHaveBeenCalledWith('f1', { limit: 5 })

    const filas = screen.getAllByRole('listitem')
    expect(filas).toHaveLength(2)
    expect(within(filas[0]).getByText('05/10')).toBeInTheDocument()
    expect(within(filas[0]).getByText('Uso')).toBeInTheDocument()
    expect(within(filas[0]).getByText('− $5.000')).toBeInTheDocument()
    expect(within(filas[0]).getByText('Reparación de la cámara de frío')).toBeInTheDocument()
    expect(within(filas[1]).getByText('Aporte')).toBeInTheDocument()
    expect(within(filas[1]).getByText('+ $25.000')).toBeInTheDocument()
  })

  it('no muestra más de 5 aunque el servidor mande más', async () => {
    listarMovimientos.mockResolvedValue(Array.from({ length: 8 }, (_, i) => ({ ...MOVIMIENTOS[1], id: `m${i}` })))
    montar()
    await screen.findByTestId('saldo-tarjeta-fondo')
    expect(screen.getAllByRole('listitem')).toHaveLength(5)
  })

  it('lleva a la sección del fondo en Administración', async () => {
    montar()
    const link = await screen.findByRole('link', { name: /Aportar, usar o ver todo/ })
    expect(link).toHaveAttribute('href', '/local/l1/administrativo/fondo-emergencia')
  })

  it('sin movimientos lo dice', async () => {
    listarMovimientos.mockResolvedValue([])
    montar()
    expect(await screen.findByText('Todavía no hay aportes ni usos.')).toBeInTheDocument()
  })

  it('si el local no tiene fondo, lo dice y ofrece crearlo', async () => {
    getFondoDelLocal.mockResolvedValue(null)
    montar()
    expect(await screen.findByText('Este local todavía no tiene fondo de emergencia.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Crear fondo de emergencia/ }))
      .toHaveAttribute('href', '/local/l1/administrativo/fondo-emergencia')
    expect(listarMovimientos).not.toHaveBeenCalled()
  })

  it('sin backend (404) lo explica', async () => {
    getFondoDelLocal.mockRejectedValue(new Error('404: Not Found'))
    montar()
    expect(await screen.findByRole('alert')).toHaveTextContent('todavía no está disponible en el servidor')
  })

  it.each(['Admin Negocio', 'Admin'])('la ve %s', async (role) => {
    sesion.role = role
    montar()
    expect(await screen.findByText('Fondo de emergencia')).toBeInTheDocument()
  })

  it('el vendedor no la ve ni se consulta nada', () => {
    sesion.role = 'Empleado'
    const { container } = montar()
    expect(container).toBeEmptyDOMElement()
    expect(getFondoDelLocal).not.toHaveBeenCalled()
  })
})
