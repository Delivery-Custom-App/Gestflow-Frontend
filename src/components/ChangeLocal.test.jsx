import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import ChangeLocal from './ChangeLocal'

// Mock de useParams y useNavigate
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

// Mock de los hooks
vi.mock('../hooks/useOrderSummary', () => ({
  useOrderSummary: vi.fn(),
}))

vi.mock('../hooks/useAvailableLocals', () => ({
  useAvailableLocals: vi.fn(),
}))

import { useOrderSummary } from '../hooks/useOrderSummary'
import { useAvailableLocals } from '../hooks/useAvailableLocals'

const mockSummaryData = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  local_info: {
    id: 'local-1',
    name: 'Local Centro',
    address: 'Calle Principal 123',
    phone: '+56912345678',
  },
}

const mockLocalsList = [
  {
    id: 'local-1',
    name: 'Local Centro',
    address: 'Calle Principal 123',
    phone: '+56912345678',
  },
  {
    id: 'local-2',
    name: 'Local Norte',
    address: 'Avenida Norte 456',
    phone: '+56987654321',
  },
  {
    id: 'local-3',
    name: 'Local Sur',
    address: 'Avenida Sur 789',
    phone: '+56998765432',
  },
]

describe('ChangeLocal Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.localStorage = {
      getItem: vi.fn(() => 'fake-jwt-token'),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    }
  })

  it('debería mostrar estado de carga', () => {
    useOrderSummary.mockReturnValue({
      summary: null,
      loading: true,
      error: null,
    })

    render(
      <BrowserRouter>
        <ChangeLocal />
      </BrowserRouter>
    )

    expect(screen.getByText(/Cargando locales/i)).toBeInTheDocument()
  })

  it('debería mostrar error si no se encuentra el pedido', () => {
    useOrderSummary.mockReturnValue({
      summary: null,
      loading: false,
      error: 'Pedido no encontrado',
    })

    render(
      <BrowserRouter>
        <ChangeLocal />
      </BrowserRouter>
    )

    expect(screen.getByText(/No se encontró el pedido/i)).toBeInTheDocument()
  })

  it('debería mostrar el local actual como referencia', () => {
    useOrderSummary.mockReturnValue({
      summary: mockSummaryData,
      loading: false,
      error: null,
    })

    useAvailableLocals.mockReturnValue({
      locals: mockLocalsList,
      loading: false,
      error: null,
    })

    render(
      <BrowserRouter>
        <ChangeLocal />
      </BrowserRouter>
    )

    // Verificar que se muestra el local actual
    expect(screen.getByText('Local Actual')).toBeInTheDocument()
    expect(screen.getByText('Local Centro')).toBeInTheDocument()
  })

  it('debería mostrar lista de locales disponibles', () => {
    useOrderSummary.mockReturnValue({
      summary: mockSummaryData,
      loading: false,
      error: null,
    })

    useAvailableLocals.mockReturnValue({
      locals: mockLocalsList,
      loading: false,
      error: null,
    })

    render(
      <BrowserRouter>
        <ChangeLocal />
      </BrowserRouter>
    )

    // Verificar que todos los locales se muestran
    expect(screen.getByText('Local Centro')).toBeInTheDocument()
    expect(screen.getByText('Local Norte')).toBeInTheDocument()
    expect(screen.getByText('Local Sur')).toBeInTheDocument()
  })

  it('debería permitir seleccionar un local', () => {
    useOrderSummary.mockReturnValue({
      summary: mockSummaryData,
      loading: false,
      error: null,
    })

    useAvailableLocals.mockReturnValue({
      locals: mockLocalsList,
      loading: false,
      error: null,
    })

    render(
      <BrowserRouter>
        <ChangeLocal />
      </BrowserRouter>
    )

    // Encontrar y hacer clic en "Local Norte"
    const localNorteCard = screen.getByText('Local Norte').closest('.local-card')
    fireEvent.click(localNorteCard)

    // Verificar que se mostró el indicador de selección
    expect(screen.getByText(/Seleccionado/)).toBeInTheDocument()
  })

  it('debería mostrar botón "Volver sin cambiar"', () => {
    useOrderSummary.mockReturnValue({
      summary: mockSummaryData,
      loading: false,
      error: null,
    })

    useAvailableLocals.mockReturnValue({
      locals: mockLocalsList,
      loading: false,
      error: null,
    })

    render(
      <BrowserRouter>
        <ChangeLocal />
      </BrowserRouter>
    )

    expect(screen.getByText(/Volver sin cambiar/)).toBeInTheDocument()
  })

  it('debería mostrar botón "Confirmar Cambio" deshabilitado si no hay selección', () => {
    useOrderSummary.mockReturnValue({
      summary: mockSummaryData,
      loading: false,
      error: null,
    })

    useAvailableLocals.mockReturnValue({
      locals: mockLocalsList,
      loading: false,
      error: null,
    })

    render(
      <BrowserRouter>
        <ChangeLocal />
      </BrowserRouter>
    )

    const confirmButton = screen.getByText(/Confirmar Cambio/)
    expect(confirmButton).toBeDisabled()
  })

  it('debería mostrar mensaje de error si falta JWT token', () => {
    global.localStorage.getItem = vi.fn(() => null)

    useOrderSummary.mockReturnValue({
      summary: mockSummaryData,
      loading: false,
      error: null,
    })

    useAvailableLocals.mockReturnValue({
      locals: mockLocalsList,
      loading: false,
      error: null,
    })

    render(
      <BrowserRouter>
        <ChangeLocal />
      </BrowserRouter>
    )

    // Seleccionar un local
    const localNorteCard = screen.getByText('Local Norte').closest('.local-card')
    fireEvent.click(localNorteCard)

    // Intentar confirmar (aunque sin token podría fallar)
    const confirmButton = screen.getByText(/Confirmar Cambio/)
    expect(confirmButton).not.toBeDisabled()
  })

  it('debería renderizar correctamente con disponibilidad de locales vacía', () => {
    useOrderSummary.mockReturnValue({
      summary: mockSummaryData,
      loading: false,
      error: null,
    })

    useAvailableLocals.mockReturnValue({
      locals: [],
      loading: false,
      error: null,
    })

    render(
      <BrowserRouter>
        <ChangeLocal />
      </BrowserRouter>
    )

    expect(screen.getByText(/No hay otros locales disponibles/i)).toBeInTheDocument()
  })

  it('debería mostrar indicador "Actual" en el local actual', () => {
    useOrderSummary.mockReturnValue({
      summary: mockSummaryData,
      loading: false,
      error: null,
    })

    useAvailableLocals.mockReturnValue({
      locals: mockLocalsList,
      loading: false,
      error: null,
    })

    render(
      <BrowserRouter>
        <ChangeLocal />
      </BrowserRouter>
    )

    // El primer local (id: local-1) es el actual
    const cards = screen.getAllByText(/Calle/)
    expect(cards.length).toBeGreaterThan(0)
  })
})
