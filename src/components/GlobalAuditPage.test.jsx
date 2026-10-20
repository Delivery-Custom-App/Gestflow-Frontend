/** Paginación numerada de la auditoría global. */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import GlobalAuditPage from './GlobalAuditPage'
import { getAuditLog, getAuditPageCount, listBusinesses } from '../lib/superAdminApi'

vi.mock('../lib/apiClient', () => ({
  getAuthContext: vi.fn().mockResolvedValue({ token: 't' }),
  formatApiErrorDetail: (d) => d,
}))
vi.mock('../lib/superAdminApi', () => ({ getAuditLog: vi.fn(), getAuditPageCount: vi.fn(), listBusinesses: vi.fn() }))
vi.mock('../lib/v2Features', () => ({ isV2FeatureEnabled: () => true }))

const filas = (n, desde = 0) => Array.from({ length: n }, (_, i) => ({
  id: `e${desde + i}`, action: 'user.create', actor_email: `u${desde + i}@x.cl`, created_at: '2026-10-16T12:00:00',
}))

beforeEach(() => {
  vi.clearAllMocks()
  listBusinesses.mockResolvedValue([])
  getAuditPageCount.mockRejectedValue(new Error('sin conteo'))
})

describe('GlobalAuditPage — paginación', () => {
  it('con una sola página incompleta no muestra paginación', async () => {
    getAuditLog.mockResolvedValue(filas(10))
    render(<GlobalAuditPage />)
    await screen.findByText('u0@x.cl')
    expect(screen.queryByRole('navigation', { name: 'Paginación' })).toBeNull()
  })

  it('una página llena ofrece la siguiente; al hacer clic en su número pide ese offset', async () => {
    getAuditLog.mockResolvedValueOnce(filas(50)).mockResolvedValueOnce(filas(7, 50))
    render(<GlobalAuditPage />)
    await screen.findByText('u0@x.cl')

    expect(screen.getByRole('button', { name: 'Página 1' })).toHaveAttribute('aria-current', 'page')
    await userEvent.click(screen.getByRole('button', { name: 'Página 2' }))

    await screen.findByText('u50@x.cl')
    expect(getAuditLog).toHaveBeenLastCalledWith({ businessId: undefined, limit: 50, offset: 50 }, 't')
    // La última página (incompleta) mantiene la navegación para poder volver.
    expect(screen.getByRole('button', { name: 'Página 1' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Página 2' })).toHaveAttribute('aria-current', 'page')
    expect(screen.queryByRole('button', { name: 'Página 3' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Siguiente' })).toBeDisabled()
  })

  it('si la página siguiente viene vacía, vuelve a la anterior y no la ofrece', async () => {
    getAuditLog.mockResolvedValueOnce(filas(50)).mockResolvedValueOnce([]).mockResolvedValueOnce(filas(50))
    render(<GlobalAuditPage />)
    await screen.findByText('u0@x.cl')

    await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
    await screen.findByText('u0@x.cl')
    expect(screen.getByRole('button', { name: 'Página 1' })).toHaveAttribute('aria-current', 'page')
  })

  it('con el total de páginas calculado muestra la última y permite saltar a ella', async () => {
    getAuditPageCount.mockResolvedValue(9)
    getAuditLog.mockResolvedValueOnce(filas(50)).mockResolvedValueOnce(filas(12, 400))
    render(<GlobalAuditPage />)
    await screen.findByText('u0@x.cl')

    const ultima = await screen.findByRole('button', { name: 'Página 9' })
    await userEvent.click(ultima)

    await screen.findByText('u400@x.cl')
    expect(getAuditLog).toHaveBeenLastCalledWith({ businessId: undefined, limit: 50, offset: 400 }, 't')
    expect(screen.getByRole('button', { name: 'Siguiente' })).toBeDisabled()
  })
})
