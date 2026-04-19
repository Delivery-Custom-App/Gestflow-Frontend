import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import CategoryTypeahead from './CategoryTypeahead'

const loadCategoriesForLocalCached = vi.fn()

vi.mock('../../lib/apiClient', () => ({
  getAuthContext: vi.fn(() => Promise.resolve({ token: 't' })),
}))

vi.mock('../../lib/inventoryApi', () => ({
  loadCategoriesForLocalCached: (...args) => loadCategoriesForLocalCached(...args),
}))

describe('CategoryTypeahead (HU-87)', () => {
  const localId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'

  beforeEach(() => {
    loadCategoriesForLocalCached.mockReset()
    loadCategoriesForLocalCached.mockResolvedValue([
      { id: '1', name: 'Bebidas', is_active: true },
      { id: '2', name: 'Verduras', is_active: true },
    ])
  })

  it('carga sugerencias y permite elegir una categoría existente', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(
      <CategoryTypeahead localId={localId} value="" onChange={onChange} disabled={false} />,
    )

    const input = screen.getByPlaceholderText(/Escribe o elige/i)
    await user.click(input)

    expect(await screen.findByRole('button', { name: 'Bebidas' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Verduras' }))
    expect(onChange).toHaveBeenCalledWith('Verduras')
  })

  it('filtra por texto (typeahead)', async () => {
    const user = userEvent.setup()
    render(<CategoryTypeahead localId={localId} value="ver" onChange={() => {}} disabled={false} />)

    await user.click(screen.getByPlaceholderText(/Escribe o elige/i))

    expect(await screen.findByRole('button', { name: 'Verduras' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Bebidas' })).not.toBeInTheDocument()
  })
})
