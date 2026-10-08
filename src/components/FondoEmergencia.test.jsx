import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import FondoEmergencia from './FondoEmergencia'
import { crearFondo, getFondoDelLocal, listarMovimientos, registrarMovimiento } from '../lib/fondoEmergencia'

const sesion = vi.hoisted(() => ({ role: 'Admin' }))
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ userRole: sesion.role }) }))
vi.mock('../lib/apiClient', () => ({
  listUsers: vi.fn(() => Promise.resolve([{ id: 'u-enc', first_name: 'Carla', last_name: 'Muñoz' }])),
}))
vi.mock('../lib/fondoEmergencia', async (importOriginal) => ({
  ...(await importOriginal()),
  getFondoDelLocal: vi.fn(),
  listarMovimientos: vi.fn(),
  crearFondo: vi.fn(() => Promise.resolve({})),
  registrarMovimiento: vi.fn(() => Promise.resolve({})),
}))

const FONDO = { id: 'f1', local_id: 'l1', saldo: '20000.00' }
const MOVIMIENTOS = [
  { id: 'm2', tipo: 'uso', monto: '5000.00', motivo: 'Reparación de la cámara de frío', actor_user_id: 'u-enc', created_at: '2026-10-05T15:00:00Z' },
  { id: 'm1', tipo: 'aporte', monto: '25000.00', motivo: null, actor_user_id: 'u-dueno', created_at: '2026-10-04T15:00:00Z' },
]

beforeEach(() => {
  vi.clearAllMocks()
  sesion.role = 'Admin'
  getFondoDelLocal.mockResolvedValue(FONDO)
  listarMovimientos.mockResolvedValue(MOVIMIENTOS)
})

const montar = () => render(<FondoEmergencia localId="l1" />)

describe('FondoEmergencia', () => {
  it('sin fondo ofrece crearlo, con monto inicial que puede ser 0', async () => {
    getFondoDelLocal.mockResolvedValueOnce(null).mockResolvedValue({ ...FONDO, saldo: '0.00' })
    listarMovimientos.mockResolvedValue([])
    const user = userEvent.setup()
    montar()

    expect(await screen.findByText(/todavía no tiene fondo de emergencia/)).toBeInTheDocument()
    expect(screen.getByLabelText('Monto inicial (CLP)')).toHaveValue('0')
    await user.click(screen.getByRole('button', { name: 'Crear fondo de emergencia' }))

    await waitFor(() => expect(crearFondo).toHaveBeenCalledWith('l1', 0))
    expect(await screen.findByTestId('saldo-fondo')).toHaveTextContent('$0')
  })

  it('muestra el saldo y el historial: fecha, aporte o uso, monto, motivo y quién', async () => {
    montar()
    expect(await screen.findByTestId('saldo-fondo')).toHaveTextContent('$20.000')
    const filas = screen.getAllByRole('row').slice(1)
    expect(filas).toHaveLength(2)
    expect(within(filas[0]).getByText('Uso')).toBeInTheDocument()
    expect(within(filas[0]).getByText('− $5.000')).toBeInTheDocument()
    expect(within(filas[0]).getByText('Reparación de la cámara de frío')).toBeInTheDocument()
    expect(within(filas[0]).getByText('Carla Muñoz')).toBeInTheDocument()
    expect(within(filas[1]).getByText('Aporte')).toBeInTheDocument()
    expect(within(filas[1]).getByText('+ $25.000')).toBeInTheDocument()
    // Al encargado el backend no le deja leer al dueño: queda un id corto.
    expect(within(filas[1]).getByText('Usuario u-dueno')).toBeInTheDocument()
  })

  it('aportar: monto y nota opcional; luego recarga el saldo', async () => {
    const user = userEvent.setup()
    montar()
    await screen.findByTestId('saldo-fondo')
    getFondoDelLocal.mockResolvedValue({ ...FONDO, saldo: '30000.00' })

    await user.type(screen.getByLabelText('Monto (CLP)'), '10.000')
    await user.click(screen.getByRole('button', { name: 'Aportar' }))

    await waitFor(() => expect(registrarMovimiento).toHaveBeenCalledWith('f1', { tipo: 'aporte', monto: 10000, motivo: '' }))
    expect(await screen.findByText('Aporte de $10.000 registrado.')).toBeInTheDocument()
    expect(screen.getByTestId('saldo-fondo')).toHaveTextContent('$30.000')
  })

  it('usar: el motivo es obligatorio', async () => {
    const user = userEvent.setup()
    montar()
    await screen.findByTestId('saldo-fondo')

    await user.click(screen.getByRole('radio', { name: 'Registrar uso' }))
    expect(screen.getByLabelText('Motivo')).toBeInTheDocument()
    await user.type(screen.getByLabelText('Monto (CLP)'), '5000')
    await user.click(screen.getByRole('button', { name: 'Registrar uso' }))

    expect(screen.getByRole('alert')).toHaveTextContent('Indica el motivo del uso.')
    expect(registrarMovimiento).not.toHaveBeenCalled()
  })

  it('usar: no deja sacar más de lo que hay y lo explica', async () => {
    const user = userEvent.setup()
    montar()
    await screen.findByTestId('saldo-fondo')

    await user.click(screen.getByRole('radio', { name: 'Registrar uso' }))
    expect(screen.getByText(/Se puede usar hasta \$20\.000/)).toBeInTheDocument()
    await user.type(screen.getByLabelText('Monto (CLP)'), '25000')
    await user.type(screen.getByLabelText('Motivo'), 'Compra urgente')
    await user.click(screen.getByRole('button', { name: 'Registrar uso' }))

    expect(screen.getByRole('alert')).toHaveTextContent('el fondo no puede quedar en negativo')
    expect(registrarMovimiento).not.toHaveBeenCalled()
  })

  it('si otro uso dejó el saldo corto (409 del backend), también lo explica', async () => {
    registrarMovimiento.mockRejectedValueOnce(new Error('409: saldo insuficiente'))
    const user = userEvent.setup()
    montar()
    await screen.findByTestId('saldo-fondo')

    await user.click(screen.getByRole('radio', { name: 'Registrar uso' }))
    await user.type(screen.getByLabelText('Monto (CLP)'), '15000')
    await user.type(screen.getByLabelText('Motivo'), 'Gas')
    await user.click(screen.getByRole('button', { name: 'Registrar uso' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('el fondo no puede quedar en negativo')
  })

  it('el vendedor no lo ve ni se consulta nada', () => {
    sesion.role = 'Empleado'
    montar()
    expect(screen.getByRole('alert')).toHaveTextContent('solo lo manejan el dueño y el encargado')
    expect(getFondoDelLocal).not.toHaveBeenCalled()
  })

  it('sin backend (404) lo dice y deja reintentar', async () => {
    getFondoDelLocal.mockRejectedValueOnce(new Error('404: Not Found'))
    const user = userEvent.setup()
    montar()

    expect(await screen.findByRole('alert')).toHaveTextContent('todavía no está disponible en el servidor')
    await user.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByTestId('saldo-fondo')).toBeInTheDocument()
  })
})
