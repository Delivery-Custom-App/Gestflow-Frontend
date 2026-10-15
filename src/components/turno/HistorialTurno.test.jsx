/** Historial del turno (T-43). */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import HistorialTurno from './HistorialTurno'
import { listarHistorialTurno } from '../../lib/historialTurno'
import { apiRequest } from '../../lib/apiClient'
import { detallesEvento, etiquetaEvento, montoEvento } from '../../lib/historialTurno'

vi.mock('../../lib/apiClient', () => ({ apiRequest: vi.fn() }))

const EVENTOS = [
  { id: 'e1', tipo: 'turno_abierto', created_at: '2026-10-14T12:00:00Z', actor_email: 'ana@x.cl', monto: '20000.00' },
  { id: 'e2', tipo: 'cobro', created_at: '2026-10-14T13:00:00Z', actor_email: 'ana@x.cl', monto: '4400.00', metodo: 'cash' },
  { id: 'e3', tipo: 'mesa_reasignada', created_at: '2026-10-14T14:00:00Z', actor_email: 'dueno@x.cl', monto: '4400.00', motivo: 'Ana cubre la terraza' },
  { id: 'e4', tipo: 'turno_cerrado', created_at: '2026-10-14T20:00:00Z', actor_email: 'marta@x.cl', monto: '5000.00', motivo: 'Vuelto mal dado',
    detalle: { efectivo_esperado: '8900.00', efectivo_contado: '8600.00', diferencia: '-300.00' } },
  { id: 'e5', tipo: 'algo_nuevo', created_at: '2026-10-14T21:00:00Z' },
]

beforeEach(() => { vi.clearAllMocks() })

describe('lib/historialTurno', () => {
  it('pide GET /cajas/{id}/historial con limit y offset y lee el total', async () => {
    apiRequest.mockResolvedValue({ data: EVENTOS, total: 45 })
    const r = await listarHistorialTurno('c1', { limit: 20, offset: 20 })
    expect(apiRequest).toHaveBeenCalledWith('/cajas/c1/historial?limit=20&offset=20', { withTotal: true })
    expect(r.total).toBe(45)
  })
  it('etiquetas en español; un tipo desconocido con su nombre crudo', () => {
    expect(etiquetaEvento('mesa_no_cobrada')).toBe('Mesa no cobrada')
    expect(etiquetaEvento('algo_nuevo')).toBe('algo_nuevo')
  })
  it('el cierre muestra esperado, contado y diferencia; el cobro, monto y método', () => {
    expect(detallesEvento(EVENTOS[3])).toEqual(['Esperado $8.900', 'Contado $8.600', 'Faltan $300'])
    expect(montoEvento(EVENTOS[1])).toBe('$4.400 · efectivo')
    expect(montoEvento({})).toBeNull()
  })
})

describe('HistorialTurno', () => {
  it('lista los eventos con etiqueta, quién, monto y motivo, y no se rompe con un tipo nuevo', async () => {
    apiRequest.mockResolvedValue({ data: EVENTOS, total: EVENTOS.length })
    render(<HistorialTurno cajaId="c1" />)
    const lista = await screen.findByRole('list', { name: 'Historial del turno' })
    const items = within(lista).getAllByRole('listitem')
    expect(items).toHaveLength(5)
    expect(items[1]).toHaveTextContent('Cobro')
    expect(items[1]).toHaveTextContent('$4.400 · efectivo')
    expect(items[2]).toHaveTextContent('Motivo: Ana cubre la terraza')
    expect(items[2]).toHaveTextContent('dueno@x.cl')
    expect(items[3]).toHaveTextContent('Esperado $8.900 · Contado $8.600 · Faltan $300')
    expect(items[4]).toHaveTextContent('algo_nuevo')
  })

  it('pagina según X-Total-Count', async () => {
    const user = userEvent.setup()
    apiRequest.mockResolvedValue({ data: EVENTOS, total: 45 })
    render(<HistorialTurno cajaId="c1" />)
    expect(await screen.findByText('Página 1 de 3 · 45 eventos')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Siguiente' }))
    expect(apiRequest).toHaveBeenLastCalledWith('/cajas/c1/historial?limit=20&offset=20', { withTotal: true })
  })

  it('si falla, lo dice', async () => {
    apiRequest.mockRejectedValue(Object.assign(new Error('403: No autorizado'), { detail: 'No autorizado' }))
    render(<HistorialTurno cajaId="c1" />)
    expect(await screen.findByRole('alert')).toHaveTextContent('No autorizado')
  })
})
