/**
 * Pago multi-comensal: la UI no debe ofrecerlo mientras Backend V2 no lo tenga.
 *
 * A diferencia de MesaWorkspace.test.jsx, acá NO se mockea `v2Features`: se usa
 * la bandera real, así que si alguien la vuelve a poner en true sin que existan
 * los endpoints, esta prueba falla y explica por qué.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import MesaWorkspace from './MesaWorkspace'
import { V2_FEATURES } from '../../lib/v2Features'
import { getSplitPaymentSummary } from '../../lib/apiClient'
import { useMesaDetail } from '../../hooks/useMesaDetail'
import { useMenuPOS } from '../../hooks/useMenuPOS'
import { useOrderManagement } from '../../hooks/useOrderManagement'

vi.mock('../../hooks/useMesaDetail', () => ({ useMesaDetail: vi.fn() }))
vi.mock('../../hooks/useMenuPOS', () => ({ useMenuPOS: vi.fn() }))
vi.mock('../../hooks/useOrderManagement', () => ({ useOrderManagement: vi.fn() }))
vi.mock('../../lib/salesApi', () => ({
  createOrder: vi.fn(),
  addOrderItem: vi.fn(),
  setMesaLibre: vi.fn(),
}))
vi.mock('../../lib/apiClient', () => ({
  getSplitPaymentSummary: vi.fn().mockResolvedValue({ splits: [], is_fully_paid: false }),
}))
vi.mock('./MercadoPagoModal', () => ({ default: () => null }))

const mesa = { id: 'mesa-1', name: 'Mesa 1', zona: 'Salón' }
const orden = { id: 'ord-1', status: 'open', total: 9400, items: [] }

function montarConOrdenAbierta() {
  useMesaDetail.mockReturnValue({ detail: { active_orders: [orden] }, loading: false, error: null, refresh: vi.fn() })
  useMenuPOS.mockReturnValue({ data: { categories: [] }, loading: false, fetch: vi.fn() })
  useOrderManagement.mockReturnValue({ updateOrderStatus: vi.fn() })
  return render(<MesaWorkspace mesa={mesa} localId="local-1" cajaId="caja-1" onBack={() => {}} onTableUpdated={() => {}} />)
}

describe('Pago multi-comensal apagado', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('la bandera splitPayments está en false porque el backend no lo implementa', () => {
    expect(V2_FEATURES.splitPayments).toBe(false)
  })

  it('con una orden abierta no aparece el botón de dividir pago', async () => {
    montarConOrdenAbierta()

    await waitFor(() => expect(screen.getByText('Mesa 1')).toBeInTheDocument())
    expect(screen.queryByTitle('Dividir pago')).not.toBeInTheDocument()
    expect(screen.queryByText('Dividir pago')).not.toBeInTheDocument()
    expect(screen.queryByText(/pago dividido/i)).not.toBeInTheDocument()
  })

  it('no se consulta el resumen de pagos divididos, que en V2 devuelve 404', async () => {
    montarConOrdenAbierta()

    await waitFor(() => expect(screen.getByText('Mesa 1')).toBeInTheDocument())
    expect(getSplitPaymentSummary).not.toHaveBeenCalled()
  })
})
