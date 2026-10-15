/** Pantalla del fondo de emergencia (T-26): definir, gastar, reponer, corregir e historial. */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import FondoEmergencia from './FondoEmergencia'
import {
  corregirGasto, crearFondo, definirMontoFijo, getFondo, listarHistorial, mapFondo, registrarMovimiento,
} from '../lib/fondoEmergencia'

const sesion = vi.hoisted(() => ({ userRole: 'Admin' }))
vi.mock('../context/AuthContext', () => ({ useAuth: () => sesion }))
vi.mock('../lib/fondoEmergencia', async (importOriginal) => ({
  ...(await importOriginal()),
  getFondo: vi.fn(), crearFondo: vi.fn(), definirMontoFijo: vi.fn(), registrarMovimiento: vi.fn(),
  corregirGasto: vi.fn(), listarHistorial: vi.fn(), hoyEnChile: () => '2026-10-14',
}))

const GASTO = { id: 'g1', tipo: 'gasto', monto: '8000', motivo: 'Gas', fecha: '2026-10-14', registrado_en: '2026-10-14T15:00:00Z', registrado_por_email: 'enc@x.cl', ajustado: '0' }
const FONDO = mapFondo({
  local_id: 'loc-1', monto_fijo: '50000', saldo: '42000', semana_inicio: '2026-10-12', semana_fin: '2026-10-18',
  gastado_semana: '8000', fecha_minima: '2026-10-12',
  movimientos: [GASTO, { id: 'r1', tipo: 'reposicion', monto: '50000', motivo: 'Fondo inicial', fecha: '2026-10-12', registrado_en: '2026-10-12T12:00:00Z', registrado_por_email: 'dueno@x.cl' }],
})
const VACIO = mapFondo({ local_id: 'loc-1', monto_fijo: '0', saldo: '0', gastado_semana: '0', fecha_minima: '2026-10-12', movimientos: [] })

const montar = () => render(<FondoEmergencia localId="loc-1" />)

beforeEach(() => {
  vi.clearAllMocks()
  sesion.userRole = 'Admin'
  getFondo.mockResolvedValue(FONDO)
  listarHistorial.mockResolvedValue({ movimientos: FONDO.movimientos, total: 2 })
  registrarMovimiento.mockResolvedValue({})
  corregirGasto.mockResolvedValue({})
  definirMontoFijo.mockResolvedValue(FONDO)
})

describe('FondoEmergencia', () => {
  it('sin fondo: pide el monto fijo y lo crea (PUT + reposición inicial)', async () => {
    getFondo.mockResolvedValueOnce(VACIO)
    crearFondo.mockResolvedValue(FONDO)
    const user = userEvent.setup()
    montar()
    await user.type(await screen.findByLabelText('Monto fijo (CLP)'), '50000')
    await user.click(screen.getByRole('button', { name: 'Crear fondo de emergencia' }))
    expect(crearFondo).toHaveBeenCalledWith('loc-1', 50000)
    expect(await screen.findByTestId('saldo-fondo')).toHaveTextContent('42.000')
  })

  it('el monto fijo debe ser mayor que 0', async () => {
    getFondo.mockResolvedValueOnce(VACIO)
    const user = userEvent.setup()
    montar()
    await user.click(await screen.findByRole('button', { name: 'Crear fondo de emergencia' }))
    expect(screen.getByRole('alert')).toHaveTextContent('mayor que 0')
    expect(crearFondo).not.toHaveBeenCalled()
  })

  it('muestra saldo, monto fijo y lo gastado en la semana', async () => {
    montar()
    expect(await screen.findByTestId('saldo-fondo')).toHaveTextContent('42.000')
    expect(screen.getByTestId('monto-fijo-fondo')).toHaveTextContent('50.000')
    expect(screen.getByTestId('gastado-semana-fondo')).toHaveTextContent('8.000')
    expect(screen.getByText('12/10/2026 al 18/10/2026')).toBeInTheDocument()
  })

  it('registrar un gasto con motivo y fecha (limitada entre fecha_minima y hoy)', async () => {
    const user = userEvent.setup()
    montar()
    const fecha = await screen.findByLabelText('Fecha')
    expect(fecha).toHaveAttribute('min', '2026-10-12')
    expect(fecha).toHaveAttribute('max', '2026-10-14')
    await user.type(screen.getByLabelText('Monto (CLP)'), '3000')
    await user.type(screen.getByLabelText('Motivo'), 'Repuesto')
    await user.click(screen.getByRole('button', { name: 'Registrar gasto' }))
    expect(registrarMovimiento).toHaveBeenCalledWith('loc-1', { tipo: 'gasto', monto: 3000, motivo: 'Repuesto', fecha: '2026-10-14' })
    expect(await screen.findByText('Gasto de $3.000 registrado.')).toBeInTheDocument()
  })

  it('el gasto exige motivo y no deja pasar más que el saldo', async () => {
    const user = userEvent.setup()
    montar()
    await user.type(await screen.findByLabelText('Monto (CLP)'), '3000')
    await user.click(screen.getByRole('button', { name: 'Registrar gasto' }))
    expect(screen.getByRole('alert')).toHaveTextContent('motivo')
    await user.type(screen.getByLabelText('Motivo'), 'x')
    await user.clear(screen.getByLabelText('Monto (CLP)'))
    await user.type(screen.getByLabelText('Monto (CLP)'), '90000')
    await user.click(screen.getByRole('button', { name: 'Registrar gasto' }))
    expect(screen.getByRole('alert')).toHaveTextContent('negativo')
    expect(registrarMovimiento).not.toHaveBeenCalled()
  })

  it('el 409 del backend (saldo insuficiente) se muestra con su mensaje', async () => {
    registrarMovimiento.mockRejectedValue(Object.assign(new Error('409: Saldo insuficiente: disponible 100, gasto de 3000'), { status: 409, detail: 'Saldo insuficiente: disponible 100, gasto de 3000' }))
    const user = userEvent.setup()
    montar()
    await user.type(await screen.findByLabelText('Monto (CLP)'), '3000')
    await user.type(screen.getByLabelText('Motivo'), 'Repuesto')
    await user.click(screen.getByRole('button', { name: 'Registrar gasto' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Saldo insuficiente: disponible 100, gasto de 3000')
  })

  it('reponer sugiere lo que falta para volver al monto fijo y la nota es opcional', async () => {
    const user = userEvent.setup()
    montar()
    await user.click(await screen.findByRole('radio', { name: 'Reponer' }))
    expect(screen.getByLabelText('Monto (CLP)')).toHaveValue('8000')
    await user.click(screen.getByRole('button', { name: 'Reponer' }))
    expect(registrarMovimiento).toHaveBeenCalledWith('loc-1', { tipo: 'reposicion', monto: 8000, motivo: '', fecha: '2026-10-14' })
  })

  it('al cambiar a "Reponer" no arrastra el monto escrito para el gasto: sugiere lo que falta', async () => {
    const user = userEvent.setup()
    montar()
    await user.type(await screen.findByLabelText('Monto (CLP)'), '99000')
    await user.click(screen.getByRole('radio', { name: 'Reponer' }))
    expect(screen.getByLabelText('Monto (CLP)')).toHaveValue('8000')
    await user.click(screen.getByRole('radio', { name: 'Registrar gasto' }))
    expect(screen.getByLabelText('Monto (CLP)')).toHaveValue('')
  })

  it('al cambiar de tipo tampoco arrastra la nota, y la reposición se informa en femenino', async () => {
    const user = userEvent.setup()
    montar()
    await user.type(await screen.findByLabelText('Motivo'), 'Un gasto que no se hizo')
    await user.click(screen.getByRole('radio', { name: 'Reponer' }))
    expect(screen.getByLabelText('Nota (opcional)')).toHaveValue('')
    await user.click(screen.getByRole('button', { name: 'Reponer' }))
    expect(await screen.findByText('Reposición de $8.000 registrada.')).toBeInTheDocument()
  })

  it('corregir un gasto: monto y motivo, sin pasarse de lo que queda', async () => {
    const user = userEvent.setup()
    montar()
    await user.click(await screen.findByRole('button', { name: 'Corregir gasto de $8.000' }))
    const form = screen.getByRole('form', { name: 'Corregir gasto' })
    await user.clear(within(form).getByLabelText('Monto a corregir'))
    await user.type(within(form).getByLabelText('Monto a corregir'), '9000')
    await user.type(within(form).getByLabelText('Motivo'), 'Se anotó de más')
    await user.click(within(form).getByRole('button', { name: 'Guardar corrección' }))
    expect(within(form).getByRole('alert')).toHaveTextContent('mayor')
    await user.clear(within(form).getByLabelText('Monto a corregir'))
    await user.type(within(form).getByLabelText('Monto a corregir'), '3000')
    await user.click(within(form).getByRole('button', { name: 'Guardar corrección' }))
    expect(corregirGasto).toHaveBeenCalledWith('loc-1', 'g1', { monto: 3000, motivo: 'Se anotó de más' })
  })

  it('la reposición no tiene "Corregir"', async () => {
    montar()
    await screen.findByRole('button', { name: 'Corregir gasto de $8.000' })
    expect(screen.getAllByRole('button', { name: /^Corregir/ })).toHaveLength(1)
  })

  it('el historial muestra quién registró cada movimiento y pagina con el total', async () => {
    listarHistorial.mockResolvedValue({ movimientos: FONDO.movimientos, total: 45 })
    const user = userEvent.setup()
    montar()
    const tabla = await screen.findByRole('table')
    expect(within(tabla).getByText('enc@x.cl')).toBeInTheDocument()
    expect(within(tabla).getByText('Reposición')).toBeInTheDocument()
    expect(screen.getByText(/45 movimientos · página 1 de 3/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Siguiente' }))
    await waitFor(() => expect(listarHistorial).toHaveBeenLastCalledWith('loc-1', { limit: 20, offset: 20 }))
  })

  it('cambiar el monto fijo usa PUT y recarga', async () => {
    const user = userEvent.setup()
    montar()
    await user.click(await screen.findByRole('button', { name: 'Cambiar' }))
    await user.clear(screen.getByLabelText('Nuevo monto fijo (CLP)'))
    await user.type(screen.getByLabelText('Nuevo monto fijo (CLP)'), '60000')
    await user.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(definirMontoFijo).toHaveBeenCalledWith('loc-1', 60000)
    await waitFor(() => expect(getFondo).toHaveBeenCalledTimes(2))
  })

  it('el superadmin solo consulta: sin formulario ni "Corregir"', async () => {
    sesion.userRole = 'Superadmin'
    montar()
    await screen.findByTestId('saldo-fondo')
    expect(screen.queryByRole('button', { name: 'Registrar gasto' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Corregir/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Cambiar' })).not.toBeInTheDocument()
  })

  it('el vendedor no ve el fondo', () => {
    sesion.userRole = 'Empleado'
    montar()
    expect(screen.getByRole('alert')).toHaveTextContent('solo lo manejan el dueño y el encargado')
    expect(getFondo).not.toHaveBeenCalled()
  })

  it('si no se puede cargar, lo dice y deja reintentar', async () => {
    getFondo.mockRejectedValueOnce(new Error('500: error'))
    const user = userEvent.setup()
    montar()
    expect(await screen.findByRole('alert')).toHaveTextContent('error')
    await user.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByTestId('saldo-fondo')).toBeInTheDocument()
  })
})
