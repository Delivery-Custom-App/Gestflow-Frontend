import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import MenuItemRow from './MenuItemRow'

const item = { key: 'p:1', name: 'Bebida', description: 'Lata 350ml', price: 1500 }

describe('MenuItemRow', () => {
  it('muestra nombre, descripción y precio', () => {
    render(<MenuItemRow item={item} qty={0} onAdd={() => {}} onRemove={() => {}} />)
    expect(screen.getByText('Bebida')).toBeInTheDocument()
    expect(screen.getByText('Lata 350ml')).toBeInTheDocument()
    expect(screen.getByText('$1.500')).toBeInTheDocument()
  })

  it('sin cantidad no muestra el botón de restar ni el contador', () => {
    render(<MenuItemRow item={item} qty={0} onAdd={() => {}} onRemove={() => {}} />)
    expect(screen.queryByText('−')).not.toBeInTheDocument()
  })

  it('con cantidad > 0 muestra contador y botón de restar', () => {
    render(<MenuItemRow item={item} qty={2} onAdd={() => {}} onRemove={() => {}} />)
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('−')).toBeInTheDocument()
  })

  it('tocar + llama onAdd con la key del item', async () => {
    const user = userEvent.setup()
    const onAdd = vi.fn()
    render(<MenuItemRow item={item} qty={0} onAdd={onAdd} onRemove={() => {}} />)
    await user.click(screen.getByText('+'))
    expect(onAdd).toHaveBeenCalledWith('p:1')
  })

  it('tocar − llama onRemove con la key del item', async () => {
    const user = userEvent.setup()
    const onRemove = vi.fn()
    render(<MenuItemRow item={item} qty={1} onAdd={() => {}} onRemove={onRemove} />)
    await user.click(screen.getByText('−'))
    expect(onRemove).toHaveBeenCalledWith('p:1')
  })
})
