/** Cierre de caja con arqueo (T-55). */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import CerrarTurno from './CerrarTurno'
import { closeCaja, getCajaResumen } from '../../lib/salesApi'
import { V2_FEATURES } from '../../lib/v2Features'

vi.mock('../../lib/salesApi', () => ({ closeCaja: vi.fn(), getCajaResumen: vi.fn() }))

const original = { ...V2_FEATURES }
beforeEach(() => {
  vi.clearAllMocks()
  getCajaResumen.mockResolvedValue({ efectivo_esperado: '8900.00' })
  closeCaja.mockResolvedValue({ id: 'c1', status: 'closed' })
})
afterEach(() => { Object.assign(V2_FEATURES, original) })

const montar = (props = {}) => render(<CerrarTurno cajaId="c1" onCerrado={vi.fn()} onCancelar={vi.fn()} {...props} />)

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
    expect(await screen.findByRole('alert')).toHaveTextContent(/órdenes en curso/)
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
