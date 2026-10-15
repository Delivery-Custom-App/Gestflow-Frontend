/** Gráficos del Inicio del dueño: la comparativa mensual muestra «—» si un mes falla (T-28). */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import FranchiseSalesCharts from './FranchiseSalesCharts'
import { fetchBusinessSalesSummary } from '@/lib/businessSalesSummary'

vi.mock('@/lib/businessSalesSummary', () => ({ fetchBusinessSalesSummary: vi.fn() }))

const semana = { days: [], total: 0, changeVsYesterday: null }

describe('FranchiseSalesCharts · comparativa mensual', () => {
  it('muestra el total de cada mes y «—» en el que falló', async () => {
    fetchBusinessSalesSummary.mockResolvedValue({
      weekly: semana,
      monthly: {
        monthsSpan: 2,
        accumulatedPercent: null,
        months: [
          { label: 'Sep', total: 125000, momPercent: null },
          { label: 'Oct', total: null, momPercent: null },
        ],
      },
    })
    render(<FranchiseSalesCharts locales={[{ id: 'A' }]} />)
    expect(await screen.findByTestId('mes-Sep')).toHaveTextContent('125.000')
    expect(screen.getByTestId('mes-Oct')).toHaveTextContent('—')
    expect(screen.getByTestId('mes-Oct')).not.toHaveTextContent('$0')
  })
})
