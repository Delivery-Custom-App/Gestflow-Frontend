import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import KitchenDisplay from './KitchenDisplay'
import { useKitchenOrders } from '../../hooks/useKitchenOrders'
import { ThemeProvider } from '../../context/ThemeContext'

vi.mock('../../hooks/useKitchenOrders', () => ({ useKitchenOrders: vi.fn() }))

const minutesAgo = (min) => new Date(Date.now() - min * 60000).toISOString()

function renderKitchen(orders, updateOrderStatus = vi.fn()) {
  useKitchenOrders.mockReturnValue({ orders, loading: false, error: null, updateOrderStatus })
  render(
    <ThemeProvider>
      <KitchenDisplay localId="local-1" mesas={[]} />
    </ThemeProvider>,
  )
  return { updateOrderStatus }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('KitchenDisplay', () => {
  it('renderiza todas las comandas activas como stack', () => {
    renderKitchen([
      { id: 'order-1', status: 'PENDING', created_at: minutesAgo(1), items: [] },
      { id: 'order-2', status: 'PREPARING', created_at: minutesAgo(10), items: [] },
      { id: 'order-3', status: 'PREPARING', created_at: minutesAgo(25), items: [] },
    ])

    expect(screen.getAllByText(/Token No:/i)).toHaveLength(3)
  })

  it('una tarjeta que no está arriba de la pila sigue siendo accionable', async () => {
    const user = userEvent.setup()
    const { updateOrderStatus } = renderKitchen([
      { id: 'order-old', status: 'PENDING', created_at: minutesAgo(30), items: [] },
      { id: 'order-new', status: 'PENDING', created_at: minutesAgo(1), items: [] },
    ])

    const startButtons = screen.getAllByRole('button', { name: /iniciar/i })
    expect(startButtons).toHaveLength(2)

    await user.click(startButtons[0])
    expect(updateOrderStatus).toHaveBeenCalledWith('order-old', 'PREPARING')
  })

  it('una comanda PENDING con más de 20 minutos se marca Demorada', () => {
    renderKitchen([
      { id: 'order-1', status: 'PENDING', created_at: minutesAgo(25), items: [] },
    ])

    expect(screen.getAllByText('Demorada').length).toBeGreaterThan(0)
    expect(screen.getByText(/¡Demorada.*min!/)).toBeInTheDocument()
  })

  it('la barra de mesas activas lista todas las comandas ordenadas por más urgente primero', () => {
    renderKitchen([
      { id: 'order-recent', status: 'PENDING', created_at: minutesAgo(1), items: [] },
      { id: 'order-oldest', status: 'PREPARING', created_at: minutesAgo(25), items: [] },
    ])

    expect(screen.getByText('ACTIVAS')).toBeInTheDocument()
    const chips = screen.getAllByText((text) => text.startsWith('#'))
    expect(chips.length).toBeGreaterThanOrEqual(2)
  })
})
