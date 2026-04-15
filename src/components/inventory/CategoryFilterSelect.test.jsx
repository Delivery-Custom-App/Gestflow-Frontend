import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import CategoryFilterSelect from './CategoryFilterSelect'

describe('CategoryFilterSelect (HU-47)', () => {
  const options = [
    { id: 'aaa', name: 'Bebidas' },
    { id: 'bbb', name: 'Granos' },
  ]

  it('lista todas + opciones por id/nombre', () => {
    render(<CategoryFilterSelect value="" onChange={() => {}} options={options} />)
    expect(screen.getByRole('combobox', { name: /filtrar por categoría/i })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Todas las categorías' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Bebidas' })).toHaveValue('aaa')
    expect(screen.getByRole('option', { name: 'Granos' })).toHaveValue('bbb')
  })

  it('notifica onChange con el id de categoría', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<CategoryFilterSelect value="" onChange={onChange} options={options} />)
    await user.selectOptions(screen.getByRole('combobox', { name: /filtrar por categoría/i }), 'bbb')
    expect(onChange).toHaveBeenCalledWith('bbb')
  })

  it('respeta value controlado', () => {
    render(<CategoryFilterSelect value="aaa" onChange={() => {}} options={options} />)
    expect(screen.getByRole('combobox', { name: /filtrar por categoría/i })).toHaveValue('aaa')
  })
})
