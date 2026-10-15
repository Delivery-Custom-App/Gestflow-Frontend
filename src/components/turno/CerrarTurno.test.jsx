/** Cierre de caja con arqueo (T-55). */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import CerrarTurno from './CerrarTurno'
import { closeCaja, getCajaResumen, listMesas, listOrdenesDelTurno } from '../../lib/salesApi'
import { MemoryRouter } from 'react-router'
import { V2_FEATURES } from '../../lib/v2Features'

vi.mock('../../lib/salesApi', () => ({ closeCaja: vi.fn(), getCajaResumen: vi.fn(), listOrdenesDelTurno: vi.fn(), listMesas: vi.fn() }))

const original = { ...V2_FEATURES }
beforeEach(() => {
  vi.clearAllMocks()
  getCajaResumen.mockResolvedValue({ efectivo_esperado: '8900.00' })
  closeCaja.mockResolvedValue({ id: 'c1', status: 'closed' })
  listOrdenesDelTurno.mockResolvedValue([])
  listMesas.mockResolvedValue([])
})
afterEach(() => { Object.assign(V2_FEATURES, original) })

const montar = (props = {}) => render(<MemoryRouter><CerrarTurno cajaId="c1" onCerrado={vi.fn()} onCancelar={vi.fn()} {...props} /></MemoryRouter>)

describe('CerrarTurno', () => {
  it('pide el efectivo contado y muestra el esperado', async () => {
    const user = userEvent.setup()
    montar()
    expect(await screen.findByTestId('efectivo-esperado-cierre')).toHaveTextContent('$8.900')
    await user.click(screen.getByRole('button', { name: /Cerrar turno/ }))
    expect(screen.getByRole('alert')).toHaveTextContent(/efectivo que contaste/)
    expect(closeCaja).not.toHaveBeenCalled()
  })

  it('un cierre exacto no pide nota y manda monto_cierre_declarado', async () => {
    const user = userEvent.setup()
    const onCerrado = vi.fn()
    montar({ onCerrado })
    await screen.findByText('$8.900')
    await user.type(screen.getByLabelText('Efectivo contado'), '8.900')
    expect(screen.getByTestId('diferencia-al-cerrar')).toHaveTextContent('Cuadra')
    expect(screen.getByLabelText('Nota (opcional)')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Cerrar turno/ }))
    expect(closeCaja).toHaveBeenCalledWith('c1', { montoCierreDeclarado: 8900, notaCierre: '' })
    await waitFor(() => expect(onCerrado).toHaveBeenCalled())
  })

  it('con diferencia muestra «Faltan» y exige la nota', async () => {
    const user = userEvent.setup()
    montar()
    await screen.findByText('$8.900')
    await user.type(screen.getByLabelText('Efectivo contado'), '8600')
    expect(screen.getByTestId('diferencia-al-cerrar')).toHaveTextContent('Faltan $300')
    await user.click(screen.getByRole('button', { name: /Cerrar turno/ }))
    expect(screen.getByRole('alert')).toHaveTextContent(/explica la diferencia/)
    expect(screen.getByLabelText(/Nota \(obligatoria/)).toHaveFocus()
    expect(closeCaja).not.toHaveBeenCalled()

    await user.type(screen.getByLabelText(/Nota \(obligatoria/), 'Vuelto mal dado')
    await user.click(screen.getByRole('button', { name: /Cerrar turno/ }))
    expect(closeCaja).toHaveBeenCalledWith('c1', { montoCierreDeclarado: 8600, notaCierre: 'Vuelto mal dado' })
  })

  it('el 400 «Explícala en nota_cierre» no borra lo escrito y enfoca la nota', async () => {
    const user = userEvent.setup()
    getCajaResumen.mockRejectedValue(new Error('sin red')) // sin el esperado, se descubre al cerrar
    closeCaja.mockRejectedValue(Object.assign(new Error('400: x'), {
      status: 400,
      detail: 'El efectivo contado (8600.00) no coincide con lo esperado (8900.00): diferencia de -300.00. Explícala en nota_cierre',
    }))
    montar()
    await screen.findByText('—')
    await user.type(screen.getByLabelText('Efectivo contado'), '8600')
    await user.click(screen.getByRole('button', { name: /Cerrar turno/ }))
    expect(await screen.findByRole('alert')).toHaveTextContent('diferencia de -300.00: explícala en la nota.')
    expect(screen.getByLabelText('Efectivo contado')).toHaveValue('8600')
    expect(screen.getByLabelText(/Nota/)).toHaveFocus()
  })

  it('el 409 de órdenes en curso se explica', async () => {
    const user = userEvent.setup()
    closeCaja.mockRejectedValue(Object.assign(new Error('409: No se puede cerrar la caja: hay órdenes en curso contra ella'), { status: 409 }))
    montar()
    await screen.findByText('$8.900')
    await user.type(screen.getByLabelText('Efectivo contado'), '8900')
    await user.click(screen.getByRole('button', { name: /Cerrar turno/ }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/pedido de mostrador reciente/)
  })

  it('con la bandera desgloseEfectivo, el conteo por billetes llena el monto', async () => {
    V2_FEATURES.desgloseEfectivo = true
    const user = userEvent.setup()
    montar()
    await screen.findByText('$8.900')
    await user.click(screen.getByLabelText('Contar por billetes y monedas'))
    await user.type(screen.getByLabelText('Cantidad de billetes de $5.000'), '1')
    await user.click(screen.getByRole('button', { name: /Cerrar turno/ }))
    expect(screen.getByTestId('diferencia-al-cerrar')).toHaveTextContent('Faltan $3.900')
  })

  it('sin la bandera no se ofrece el conteo por billetes', async () => {
    montar()
    await screen.findByText('$8.900')
    expect(screen.queryByLabelText('Contar por billetes y monedas')).not.toBeInTheDocument()
  })
})

describe('CerrarTurno · mesas que quedan no cobradas (T-45)', () => {
  beforeEach(() => {
    listOrdenesDelTurno.mockResolvedValue([
      { id: 'o1', status: 'PENDING', mesa_id: 'm2', total: 4400 },
      { id: 'o2', status: 'PENDING', mesa_id: null, total: 1500 },
    ])
    listMesas.mockResolvedValue([{ id: 'm2', name: 'Mesa 2' }])
  })

  it('antes de cerrar avisa qué mesas quedarán no cobradas y su total; no bloquea el cierre', async () => {
    montar({ localId: 'loc-1' })
    const aviso = await screen.findByRole('note', { name: 'Mesas que quedarán no cobradas' })
    expect(aviso).toHaveTextContent('Mesa 2')
    expect(aviso).toHaveTextContent('Total sin cobrar: $4.400')
    expect(screen.getByText(/pedido de mostrador sin cobrar/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Cerrar turno/ })).toBeEnabled()
  })

  it('después de cerrar ofrece ir a «Mesas no cobradas»', async () => {
    const user = userEvent.setup()
    const onCerrado = vi.fn()
    montar({ localId: 'loc-1', onCerrado })
    await screen.findByRole('note', { name: 'Mesas que quedarán no cobradas' })
    await user.type(screen.getByLabelText('Efectivo contado'), '8900')
    await user.click(screen.getByRole('button', { name: /Cerrar turno/ }))
    const enlace = await screen.findByRole('link', { name: 'Ver mesas no cobradas' })
    expect(enlace).toHaveAttribute('href', '/local/loc-1/administrativo/no-cobradas')
    expect(screen.getByRole('status')).toHaveTextContent('Una mesa quedó como «no cobrada» por $4.400')
    await user.click(screen.getByRole('button', { name: 'Listo' }))
    expect(onCerrado).toHaveBeenCalled()
  })

  it('el 409 (pedido de mostrador reciente o cobro con tarjeta) se muestra y no se cierra', async () => {
    const user = userEvent.setup()
    const onCerrado = vi.fn()
    closeCaja.mockRejectedValue(Object.assign(new Error('409: No se puede cerrar la caja: hay órdenes en curso contra ella'), { status: 409 }))
    montar({ localId: 'loc-1', onCerrado })
    await screen.findByRole('note', { name: 'Mesas que quedarán no cobradas' })
    await user.type(screen.getByLabelText('Efectivo contado'), '8900')
    await user.click(screen.getByRole('button', { name: /Cerrar turno/ }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/pedido de mostrador reciente o un cobro con tarjeta/)
    expect(onCerrado).not.toHaveBeenCalled()
  })
})
