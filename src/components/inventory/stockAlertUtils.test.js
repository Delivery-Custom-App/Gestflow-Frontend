import { describe, it, expect } from 'vitest'
import { getStockStatusMeta, getStockAlertLevel } from './stockAlertUtils'

describe('stockAlertUtils HU-44', () => {
  it('usa stock_status del API', () => {
    expect(getStockAlertLevel({ stock_status: 'CRITICO', stock_current: 5 })).toBe('critical')
    expect(getStockStatusMeta({ stock_status: 'CRITICO' }).variant).toBe('critical')
    expect(getStockStatusMeta({ stock_status: 'CRITICO' }).label).toBe('Crítico')

    expect(getStockStatusMeta({ stock_status: 'BAJO' }).variant).toBe('low')
    expect(getStockStatusMeta({ stock_status: 'BAJO' }).label).toBe('Bajo')

    expect(getStockStatusMeta({ stock_status: 'OPTIMO' }).variant).toBe('optimal')
    expect(getStockStatusMeta({ stock_status: 'OPTIMO' }).label).toBe('Óptimo')
  })
})
