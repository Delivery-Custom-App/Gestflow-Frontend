import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { getMovimientosCaja, listCajas } from './salesApi'
import {
  filtrarTurnos, horaDe, movimientosDelTurno, nombreDeVendedor, opcionesDeVendedor, totalesDelTurno, totalVendidoDe, turnosDe,
  useTurnosFiltrados,
} from './registroTurnos'

vi.mock('./salesApi', () => ({ getMovimientosCaja: vi.fn(), getCajaResumen: vi.fn(), listCajas: vi.fn() }))

const TURNOS = [
  { id: 't-1', cashier_user_id: 'ana', business_date: '2026-10-04' },
  { id: 't-2', cashier_user_id: 'beto', business_date: '2026-10-04' },
  { id: 't-3', cashier_user_id: 'ana', business_date: '2026-10-03' },
]
const USUARIOS = new Map([
  ['ana', { id: 'ana', first_name: 'Ana', last_name: 'Rojas' }],
  ['beto', { id: 'beto', email: 'beto.soto@demo.cl' }],
])

beforeEach(() => vi.clearAllMocks())

describe('turnosDe', () => {
  it('solo los de esa persona; sin persona, ninguno', () => {
    expect(turnosDe(TURNOS, 'ana').map((t) => t.id)).toEqual(['t-1', 't-3'])
    expect(turnosDe(TURNOS, undefined)).toEqual([])
  })
})

describe('filtrarTurnos', () => {
  it('por vendedor, por fecha o por los dos; sin filtros, todos', () => {
    expect(filtrarTurnos(TURNOS, { vendedorId: 'ana' }).map((t) => t.id)).toEqual(['t-1', 't-3'])
    expect(filtrarTurnos(TURNOS, { fecha: '2026-10-04' }).map((t) => t.id)).toEqual(['t-1', 't-2'])
    expect(filtrarTurnos(TURNOS, { vendedorId: 'ana', fecha: '2026-10-04' }).map((t) => t.id)).toEqual(['t-1'])
    expect(filtrarTurnos(TURNOS)).toHaveLength(3)
  })
})

describe('nombres de los vendedores', () => {
  it('usa el nombre, o el correo, y si no lo conoce un id corto', () => {
    expect(nombreDeVendedor(USUARIOS, 'ana')).toBe('Ana Rojas')
    expect(nombreDeVendedor(USUARIOS, 'beto')).toBe('Beto Soto')
    expect(nombreDeVendedor(USUARIOS, '1234567890ab')).toBe('Usuario 12345678')
  })

  it('el filtro ofrece una vez a cada persona con turnos, por nombre', () => {
    expect(opcionesDeVendedor(TURNOS, USUARIOS)).toEqual([
      { id: 'ana', nombre: 'Ana Rojas' },
      { id: 'beto', nombre: 'Beto Soto' },
    ])
  })
})

describe('totalesDelTurno', () => {
  it('cuenta cada orden cobrada una vez y separa ingresos de egresos', () => {
    const totales = totalesDelTurno([
      { tipo: 'ingreso', monto: '3000.00', order_id: 'o-1' },
      { tipo: 'ingreso', monto: '2000.00', order_id: 'o-1' }, // la misma orden, pagada en dos partes
      { tipo: 'ingreso', monto: '4500.00', order_id: 'o-2' },
      { tipo: 'egreso', monto: '1000.00', order_id: null },
    ])
    expect(totales).toEqual({ ventas: 2, ingresos: 9500, egresos: 1000 })
  })

  it('sin movimientos, todo en cero', () => {
    expect(totalesDelTurno([])).toEqual({ ventas: 0, ingresos: 0, egresos: 0 })
  })
})

describe('movimientosDelTurno', () => {
  it('trae todas las páginas (el backend entrega hasta 500 por consulta)', async () => {
    const pagina = (n, desde) => Array.from({ length: n }, (_, i) => ({ id: `m-${desde + i}` }))
    getMovimientosCaja.mockResolvedValueOnce(pagina(500, 0)).mockResolvedValueOnce(pagina(3, 500))

    const todos = await movimientosDelTurno('t-1')

    expect(todos).toHaveLength(503)
    expect(getMovimientosCaja).toHaveBeenNthCalledWith(2, 't-1', { limit: 500, offset: 500 })
  })
})

describe('horaDe', () => {
  it('sin fecha no inventa una hora', () => {
    expect(horaDe(null)).toBeNull()
    expect(horaDe('no es fecha')).toBeNull()
  })
})

describe('A-01 · turnos con totales en una sola llamada', () => {
  it('totalVendidoDe lee total_ingresos del turno; sin dato devuelve null', () => {
    expect(totalVendidoDe({ total_ingresos: '13200.00' })).toBe(13200)
    expect(totalVendidoDe({ total_ingresos: '0' })).toBe(0)
    expect(totalVendidoDe({})).toBeNull()
  })

  it('sin filtros usa la lista ya cargada y no llama al backend', () => {
    const { result } = renderHook(() => useTurnosFiltrados('loc-1', TURNOS, {}))
    expect(result.current).toEqual({ turnos: TURNOS, cargando: false, error: '' })
    expect(listCajas).not.toHaveBeenCalled()
  })

  it('con filtros pide al servidor por fecha y cajero', async () => {
    listCajas.mockResolvedValue([TURNOS[0]])
    const { result } = renderHook(() => useTurnosFiltrados('loc-1', TURNOS, { vendedorId: 'ana', fecha: '2026-10-04' }))
    expect(result.current.cargando).toBe(true)
    await waitFor(() => expect(result.current.cargando).toBe(false))
    expect(result.current.turnos).toEqual([TURNOS[0]])
    expect(listCajas).toHaveBeenCalledWith('loc-1', { businessDate: '2026-10-04', cashierUserId: 'ana' })
  })
})
