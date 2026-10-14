/** Tarjeta del fondo de emergencia en el dashboard del local (T-27). */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import TarjetaFondoEmergencia, { MOVIMIENTOS_EN_TARJETA } from './TarjetaFondoEmergencia'
import { getFondo, mapFondo } from '../lib/fondoEmergencia'

const sesion = vi.hoisted(() => ({ userRole: 'Admin Negocio' }))
vi.mock('../context/AuthContext', () => ({ useAuth: () => sesion }))
vi.mock('../lib/fondoEmergencia', async (importOriginal) => ({ ...(await importOriginal()), getFondo: vi.fn() }))

const mov = (i, tipo = 'gasto') => ({ id: `m${i}`, tipo, monto: String(1000 * i), motivo: `Motivo ${i}`, fecha: '2026-10-14', registrado_en: '2026-10-14T12:00:00Z' })
const fondo = (movs) => mapFondo({ local_id: 'loc-1', monto_fijo: '50000', saldo: '42000', gastado_semana: '8000', fecha_minima: '2026-10-12', semana_inicio: '2026-10-12', semana_fin: '2026-10-18', movimientos: movs })
const montar = () => render(<MemoryRouter><TarjetaFondoEmergencia localId="loc-1" /></MemoryRouter>)

beforeEach(() => {
  vi.clearAllMocks()
  sesion.userRole = 'Admin Negocio'
  getFondo.mockResolvedValue(fondo([mov(1), mov(2, 'reposicion')]))
})

describe('TarjetaFondoEmergencia', () => {
  it('muestra saldo, monto fijo y lo gastado en la semana', async () => {
    montar()
    expect(await screen.findByTestId('saldo-tarjeta-fondo')).toHaveTextContent('42.000')
    expect(screen.getByTestId('monto-fijo-tarjeta-fondo')).toHaveTextContent('50.000')
    expect(screen.getByTestId('gastado-tarjeta-fondo')).toHaveTextContent('8.000')
    expect(getFondo).toHaveBeenCalledWith('loc-1')
  })

  it('lista los últimos movimientos con su tipo, monto y motivo', async () => {
    montar()
    expect(await screen.findByText('Motivo 1')).toBeInTheDocument()
    expect(screen.getByText('Gasto')).toBeInTheDocument()
    expect(screen.getByText('Reposición')).toBeInTheDocument()
    expect(screen.getByText('− $1.000')).toBeInTheDocument()
    expect(screen.getByText('+ $2.000')).toBeInTheDocument()
  })

  it(`no muestra más de ${MOVIMIENTOS_EN_TARJETA}`, async () => {
    getFondo.mockResolvedValue(fondo(Array.from({ length: 8 }, (_, i) => mov(i + 1))))
    montar()
    await screen.findByText('Motivo 1')
    expect(screen.queryByText('Motivo 6')).not.toBeInTheDocument()
  })

  it('sin fondo ofrece crearlo', async () => {
    getFondo.mockResolvedValue(mapFondo({ local_id: 'loc-1', monto_fijo: '0', saldo: '0', movimientos: [] }))
    montar()
    expect(await screen.findByRole('link', { name: /Crear fondo de emergencia/ })).toHaveAttribute('href', '/local/loc-1/administrativo/fondo-emergencia')
  })

  it('si falla, lo dice', async () => {
    getFondo.mockRejectedValue(new Error('500: error del servidor'))
    montar()
    expect(await screen.findByRole('alert')).toHaveTextContent('error del servidor')
  })

  it('el vendedor no la ve', () => {
    sesion.userRole = 'Empleado'
    const { container } = montar()
    expect(container).toBeEmptyDOMElement()
    expect(getFondo).not.toHaveBeenCalled()
  })
})
