import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import POSModule from './POSModule'

const sesion = vi.hoisted(() => ({ isWorker: false, user: { id: 'enc' } }))
const MESAS = [
  { id: 'm1', name: 'Mesa 1', nombre: 'Mesa 1', state: 'ocupada', capacidad: 4, total: 5000,
    ordenes_en_curso: [{ id: 'o1', caja_id: 'caja-ana', waiter_user_id: 'beto' }] },
  { id: 'm2', name: 'Mesa 2', nombre: 'Mesa 2', state: 'libre', capacidad: 2, total: null, ordenes_en_curso: [] },
]

vi.mock('../../context/AuthContext', () => ({ useAuth: () => sesion }))
vi.mock('../../hooks/useCajaActiva', () => ({ useCajaActiva: () => ({ cajaId: 'caja-enc' }) }))
vi.mock('../../hooks/useMesasConEstado', () => ({
  useMesasConEstado: () => ({ mesas: MESAS, loading: false, error: null, refresh: vi.fn() }),
}))
vi.mock('../../hooks/useMesasKPIs', () => ({ useMesasKPIs: () => ({ kpis: null, loading: false, error: null, refresh: vi.fn() }) }))
vi.mock('../../hooks/useGruposDeMesas', () => ({ useGruposDeMesas: () => ({ porMesa: new Map(), crear: vi.fn(), deshacer: vi.fn() }) }))
vi.mock('./MesasKPICards', () => ({ default: () => null }))
vi.mock('./MPConfigDrawer', () => ({ default: () => null }))
vi.mock('./MesaWorkspace', () => ({ default: ({ atencion }) => <p>mesa abierta · atiende {atencion?.atiende} · antes {atencion?.antes}</p> }))
vi.mock('../../lib/atencionMesas', async (importOriginal) => ({
  ...(await importOriginal()),
  useDatosDeAtencion: () => ({
    usuarios: [
      { id: 'ana', role: 'EMPLEADO', local_id: 'l1', first_name: 'Ana', last_name: 'Rojas' },
      { id: 'beto', role: 'EMPLEADO', local_id: 'l1', first_name: 'Beto', last_name: 'Soto' },
    ],
    usuariosPorId: sesion.isWorker ? new Map() : new Map([
      ['ana', { id: 'ana', first_name: 'Ana', last_name: 'Rojas' }],
      ['beto', { id: 'beto', first_name: 'Beto', last_name: 'Soto' }],
    ]),
    duenoDeTurno: new Map([['caja-ana', 'ana']]),
    recargar: vi.fn(),
  }),
}))

function montar() {
  return render(
    <MemoryRouter initialEntries={['/local/l1/pos']}>
      <Routes><Route path="/local/:localId/pos" element={<POSModule />} /></Routes>
    </MemoryRouter>,
  )
}
const tarjeta = (nombre) => screen.getByText(nombre).closest('div.group')

beforeEach(() => { sesion.isWorker = false; sesion.user = { id: 'enc' } })

describe('POSModule · quién atiende y traspasos', () => {
  it('el encargado ve quién atiende cada mesa en curso y quién la atendía', () => {
    montar()
    expect(within(tarjeta('Mesa 1')).getByText('Beto Soto')).toBeInTheDocument()
    expect(within(tarjeta('Mesa 1')).getByText('antes: Ana Rojas')).toBeInTheDocument()
    expect(within(tarjeta('Mesa 2')).queryByText('Atiende')).not.toBeInTheDocument()
  })

  it('el encargado puede traspasar mesas; abre la ventana con las mesas en curso', async () => {
    const user = userEvent.setup()
    montar()

    await user.click(screen.getByRole('button', { name: 'Traspasar mesas' }))
    const dialogo = screen.getByRole('dialog', { name: 'Traspasar mesas' })
    expect(within(dialogo).getByRole('option', { name: 'Beto Soto (1 mesa)' })).toBeInTheDocument()
  })

  it('el vendedor no tiene "Traspasar mesas" y a un compañero lo ve como "Otro vendedor"', () => {
    sesion.isWorker = true
    sesion.user = { id: 'ana' }
    montar()

    expect(screen.queryByRole('button', { name: 'Traspasar mesas' })).not.toBeInTheDocument()
    expect(within(tarjeta('Mesa 1')).getByText('Otro vendedor')).toBeInTheDocument()
    expect(within(tarjeta('Mesa 1')).getByText('antes: Tú')).toBeInTheDocument()
  })

  it('la mesa abierta también dice quién la atiende', async () => {
    const user = userEvent.setup()
    montar()
    await user.click(within(tarjeta('Mesa 1')).getAllByRole('button').at(-1))
    expect(screen.getByText('mesa abierta · atiende Beto Soto · antes Ana Rojas')).toBeInTheDocument()
  })
})
