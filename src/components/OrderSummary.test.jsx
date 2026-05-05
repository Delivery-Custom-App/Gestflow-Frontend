import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import OrderSummary from './OrderSummary'

// Mock de useParams
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useParams: () => ({
      orderId: '550e8400-e29b-41d4-a716-446655440000',
    }),
    useNavigate: () => vi.fn(),
  }
})

// Mock del hook useOrderSummary
vi.mock('../hooks/useOrderSummary', () => ({
  useOrderSummary: vi.fn(),
}))

import { useOrderSummary } from '../hooks/useOrderSummary'

const mockSummaryData = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  items: [
    {
      id: 'item-1',
      product_name: 'Hamburguesa Clásica',
      product_description: 'Con queso y lechuga',
      category_name: 'Hamburguesas',
      quantity: 2,
      unit_price: 8000,
      total_price: 16000,
    },
    {
      id: 'item-2',
      product_name: 'Refresco Grande',
      product_description: 'Refresco de cola 500ml',
      category_name: 'Bebidas',
      quantity: 2,
      unit_price: 2500,
      total_price: 5000,
    },
  ],
  client_name: 'Juan Pérez',
  client_email: 'juan@example.com',
  client_phone: '+56912345678',
  local_info: {
    id: 'local-1',
    name: 'Local Centro',
    address: 'Calle Principal 123',
    phone: '+56912345678',
  },
  pricing_breakdown: {
    subtotal: 21000,
    tax_amount: 3990,
    tax_percentage: 19,
    delivery_cost: 0,
    discount_amount: 0,
    total: 24990,
  },
}

describe('OrderSummary Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('debería mostrar estado de carga', () => {
    useOrderSummary.mockReturnValue({
      summary: null,
      loading: true,
      error: null,
    })

    render(
      <BrowserRouter>
        <OrderSummary />
      </BrowserRouter>
    )

    expect(screen.getByText(/Cargando resumen/i)).toBeInTheDocument()
  })

  it('debería mostrar mensaje de error', () => {
    useOrderSummary.mockReturnValue({
      summary: null,
      loading: false,
      error: 'Error al cargar el pedido',
    })

    render(
      <BrowserRouter>
        <OrderSummary />
      </BrowserRouter>
    )

    expect(screen.getByText(/Error:/i)).toBeInTheDocument()
  })

  it('debería mostrar el resumen completo', () => {
    useOrderSummary.mockReturnValue({
      summary: mockSummaryData,
      loading: false,
      error: null,
    })

    render(
      <BrowserRouter>
        <OrderSummary />
      </BrowserRouter>
    )

    // Verificar encabezado
    expect(screen.getByText('Confirmar Pedido')).toBeInTheDocument()

    // Verificar items
    expect(screen.getByText('Hamburguesa Clásica')).toBeInTheDocument()
    expect(screen.getByText('Refresco Grande')).toBeInTheDocument()

    // Verificar cantidades
    expect(screen.getAllByText(/×2/)[0]).toBeInTheDocument()

    // Verificar cliente
    expect(screen.getByText('Juan Pérez')).toBeInTheDocument()

    // Verificar local
    expect(screen.getByText('Local Centro')).toBeInTheDocument()
  })

  it('debería mostrar el desglose de costos correctamente', () => {
    useOrderSummary.mockReturnValue({
      summary: mockSummaryData,
      loading: false,
      error: null,
    })

    render(
      <BrowserRouter>
        <OrderSummary />
      </BrowserRouter>
    )

    // Verificar subtotal
    expect(screen.getByText(/Subtotal/)).toBeInTheDocument()

    // Verificar IVA
    expect(screen.getByText(/IVA \(19%\)/)).toBeInTheDocument()

    // Verificar total
    expect(screen.getByText(/TOTAL A PAGAR/)).toBeInTheDocument()
  })

  it('debería mostrar botones de acción', () => {
    useOrderSummary.mockReturnValue({
      summary: mockSummaryData,
      loading: false,
      error: null,
    })

    render(
      <BrowserRouter>
        <OrderSummary />
      </BrowserRouter>
    )

    // Verificar botones
    expect(screen.getByText(/Volver al Carrito/)).toBeInTheDocument()
    expect(screen.getByText(/Confirmar y Ir a Pago/)).toBeInTheDocument()
    expect(screen.getByText(/Cambiar Local/)).toBeInTheDocument()
  })

  it('debería mostrar información del cliente', () => {
    useOrderSummary.mockReturnValue({
      summary: mockSummaryData,
      loading: false,
      error: null,
    })

    render(
      <BrowserRouter>
        <OrderSummary />
      </BrowserRouter>
    )

    expect(screen.getByText('juan@example.com')).toBeInTheDocument()
    expect(screen.getAllByText('+56912345678')).toHaveLength(2)
  })

  it('debería mostrar la información del local correctamente', () => {
    useOrderSummary.mockReturnValue({
      summary: mockSummaryData,
      loading: false,
      error: null,
    })

    render(
      <BrowserRouter>
        <OrderSummary />
      </BrowserRouter>
    )

    expect(screen.getByText('Local Centro')).toBeInTheDocument()
    expect(screen.getByText('Calle Principal 123')).toBeInTheDocument()
  })

  it('debería formatear correctamente los precios en pesos chilenos', () => {
    useOrderSummary.mockReturnValue({
      summary: mockSummaryData,
      loading: false,
      error: null,
    })

    render(
      <BrowserRouter>
        <OrderSummary />
      </BrowserRouter>
    )

    // Los precios deben estar en formato locale chileno
    // 24990 debería mostrarse como $24.990 (sin decimales)
    expect(screen.getByText(/24.990/)).toBeInTheDocument()
  })
})
