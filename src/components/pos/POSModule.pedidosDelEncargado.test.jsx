/**
 * #167: la pantalla de Mesas completa (módulo + mesa abierta) con el rol de quien la usa. El encargado
 * de un restaurante no abre pedidos: sin pedido en la mesa se le explica en vez de dejarlo chocar con
 * «Abre una caja antes de vender». Con un pedido ya abierto sigue sumando productos.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import POSModule from './POSModule'
import { useMesaDetail } from '../../hooks/useMesaDetail'
import { useMenuPOS } from '../../hooks/useMenuPOS'
import { useOrderManagement } from '../../hooks/useOrderManagement'
import { createOrder, addOrderItem } from '../../lib/salesApi'

const sesion = vi.hoisted(() => ({ isWorker: false, user: { id: 'enc' }, userRole: 'Admin' }))
const MESAS = [
  { id: 'm1', name: 'Mesa 1', nombre: 'Mesa 1', state: 'ocupada', capacidad: 4, total: 5000,
    ordenes_en_curso: [{ id: 'o1', caja_id: 'caja-ana', waiter_user_id: 'beto' }] },
  { id: 'm2', name: 'Mesa 2', nombre: 'Mesa 2', state: 'libre', capacidad: 2, total: null, ordenes_en_curso: [] },
]
const orden = { id: 'o1', created_at: '2026-10-27T12:00:00Z', items: [] }
// Un detalle estable por mesa: la mesa 1 ya tiene su pedido, la 2 está sin pedido.
const detalles = {
  m1: { detail: { active_orders: [orden] }, loading: false, error: null, refresh: vi.fn(), updateAfterItemRemoval: vi.fn() },
  m2: { detail: { active_orders: [] }, loading: false, error: null, refresh: vi.fn(), updateAfterItemRemoval: vi.fn() },
}
const menu = { data: { categories: [{ id: 'cat1', name: 'Bebidas', products: [{ id: 'prod1', name: 'Agua', price: 1000 }] }] }, loading: false, fetch: vi.fn() }

vi.mock('../../context/AuthContext', () => ({ useAuth: () => sesion }))
// El encargado de un restaurante no tiene turno propio: no hay caja con la que abrir un pedido.
vi.mock('../../hooks/useCajaActiva', () => ({ useCajaActiva: () => ({ cajaId: null }) }))
vi.mock('../../hooks/useMesasConEstado', () => ({
  useMesasConEstado: () => ({ mesas: MESAS, loading: false, error: null, refresh: vi.fn() }),
}))
vi.mock('../../hooks/useMesasKPIs', () => ({ useMesasKPIs: () => ({ kpis: null, loading: false, error: null, refresh: vi.fn() }) }))
vi.mock('../../hooks/useGruposDeMesas', () => ({
  useGruposDeMesas: () => ({ porMesa: new Map(), crear: vi.fn(), deshacer: vi.fn(), refresh: vi.fn() }),
}))
vi.mock('../../hooks/useMesaDetail', () => ({ useMesaDetail: vi.fn() }))
vi.mock('../../hooks/useMenuPOS', () => ({ useMenuPOS: vi.fn() }))
vi.mock('../../hooks/useOrderManagement', () => ({ useOrderManagement: vi.fn() }))
vi.mock('../../lib/salesApi', () => ({
  createOrder: vi.fn(),
  addOrderItem: vi.fn(),
  setMesaLibre: vi.fn(),
  liberarMesa: vi.fn(),
  listMesasConTotales: vi.fn(),
  updateOrderItem: vi.fn(),
  removeOrderItem: vi.fn(),
}))
vi.mock('../../lib/mesaGroupsApi', () => ({ obtenerGrupoDeMesas: vi.fn(), deshacerGrupoDeMesas: vi.fn() }))
vi.mock('../../lib/apiClient', () => ({
  getSplitPaymentSummary: vi.fn().mockResolvedValue({ splits: [], is_fully_paid: false }),
}))
vi.mock('../../lib/v2Features', () => ({ isV2FeatureEnabled: (k) => k === 'comandas' }))
vi.mock('../../lib/atencionMesas', async (importOriginal) => ({
  ...(await importOriginal()),
  useDatosDeAtencion: () => ({ usuarios: [], usuariosPorId: new Map(), duenoDeTurno: new Map(), cajas: [], recargar: vi.fn() }),
}))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock('./MesasKPICards', () => ({ default: () => null }))
vi.mock('./MPConfigDrawer', () => ({ default: () => null }))
vi.mock('./MercadoPagoModal', () => ({ default: () => null }))
vi.mock('./MultiPaymentModal', () => ({ default: () => null }))
vi.mock('./TicketModal', () => ({ default: () => null }))

function montar() {
  return render(
    <MemoryRouter initialEntries={['/local/l1/pos']}>
      <Routes><Route path="/local/:localId/pos" element={<POSModule />} /></Routes>
    </MemoryRouter>,
  )
}
const tarjeta = (nombre) => screen.getByText(nombre).closest('div.group')
const abrirMesa = (user, nombre) => user.click(within(tarjeta(nombre)).getAllByRole('button').at(-1))

beforeEach(() => {
  vi.clearAllMocks()
  sesion.isWorker = false; sesion.user = { id: 'enc' }; sesion.userRole = 'Admin'
  useMesaDetail.mockImplementation((mesaId) => detalles[mesaId])
  useMenuPOS.mockReturnValue(menu)
  useOrderManagement.mockReturnValue({ updateOrderStatus: vi.fn() })
})

describe('POSModule · el encargado de restaurante y los pedidos (#167)', () => {
  it('en una mesa libre se le explica que el pedido lo abre el mesero, en vez de ofrecerle la carta', async () => {
    const user = userEvent.setup()
    montar()
    await abrirMesa(user, 'Mesa 2')

    expect(await screen.findByText('Esta mesa todavía no tiene pedido')).toBeInTheDocument()
    expect(screen.getByRole('note')).toHaveTextContent('los pedidos los abre el mesero con su turno')
    expect(screen.queryByText('Agua')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Comensales')).not.toBeInTheDocument()
    expect(screen.queryByText(/Abre una caja antes de vender/)).not.toBeInTheDocument()
    expect(createOrder).not.toHaveBeenCalled()
  })

  it('en una mesa con pedido abierto sí suma productos, sin necesitar caja', async () => {
    const user = userEvent.setup()
    addOrderItem.mockResolvedValue({})
    montar()
    await abrirMesa(user, 'Mesa 1')

    await user.click(await screen.findByText('+'))
    await user.click(screen.getByRole('button', { name: /agregar al pedido/i }))

    await waitFor(() => expect(addOrderItem).toHaveBeenCalledWith(
      'o1', { product_id: 'prod1', quantity: 1, unit_price: 1000 }, '2026-10-27T12:00:00Z', expect.stringMatching(/:item:0$/),
    ))
    expect(createOrder).not.toHaveBeenCalled()
    expect(screen.queryByText('Esta mesa todavía no tiene pedido')).not.toBeInTheDocument()
  })

  it('el dueño sí ve la carta y los comensales en la misma mesa libre', async () => {
    sesion.userRole = 'Admin Negocio'
    const user = userEvent.setup()
    montar()
    await abrirMesa(user, 'Mesa 2')

    expect(await screen.findByText('Agua')).toBeInTheDocument()
    expect(screen.getByLabelText('Comensales')).toBeInTheDocument()
    expect(screen.queryByText('Esta mesa todavía no tiene pedido')).not.toBeInTheDocument()
  })

  it('el vendedor sí ve la carta y los comensales en la misma mesa libre', async () => {
    sesion.isWorker = true; sesion.user = { id: 'ana' }; sesion.userRole = 'Empleado'
    const user = userEvent.setup()
    montar()
    await abrirMesa(user, 'Mesa 2')

    expect(await screen.findByText('Agua')).toBeInTheDocument()
    expect(screen.getByLabelText('Comensales')).toBeInTheDocument()
    expect(screen.queryByText('Esta mesa todavía no tiene pedido')).not.toBeInTheDocument()
  })
})
