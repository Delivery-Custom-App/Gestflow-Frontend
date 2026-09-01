import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import MenuCategoryAccordion from './MenuCategoryAccordion'

const items = [
  { key: 'p:1', name: 'Bebida', price: 1500 },
  { key: 'p:2', name: 'Papas',  price: 2500 },
]

describe('MenuCategoryAccordion', () => {
  it('muestra el label y la cantidad de productos', () => {
    render(<MenuCategoryAccordion label="Bebidas" items={items} selectedQtys={{}} onAdd={() => {}} onRemove={() => {}} />)
    expect(screen.getByText('Bebidas')).toBeInTheDocument()
    expect(screen.getByText('2 productos')).toBeInTheDocument()
  })

  it('abierta por defecto: muestra las filas de producto', () => {
    render(<MenuCategoryAccordion label="Bebidas" items={items} selectedQtys={{}} onAdd={() => {}} onRemove={() => {}} />)
    expect(screen.getByText('Bebida')).toBeInTheDocument()
    expect(screen.getByText('Papas')).toBeInTheDocument()
  })

  it('sin productos muestra el mensaje vacío', () => {
    render(<MenuCategoryAccordion label="Postres" items={[]} selectedQtys={{}} onAdd={() => {}} onRemove={() => {}} />)
    expect(screen.getByText('No dispone de productos')).toBeInTheDocument()
  })

  it('muestra el badge con la suma de cantidades seleccionadas', () => {
    render(<MenuCategoryAccordion label="Bebidas" items={items} selectedQtys={{ 'p:1': 2, 'p:2': 1 }} onAdd={() => {}} onRemove={() => {}} />)
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('tocar el header colapsa/expande la lista', async () => {
    const user = userEvent.setup()
    render(<MenuCategoryAccordion label="Bebidas" items={items} selectedQtys={{}} onAdd={() => {}} onRemove={() => {}} />)
    expect(screen.getByText('Bebida')).toBeInTheDocument()
    await user.click(screen.getByText('Bebidas'))
    expect(screen.queryByText('Bebida')).not.toBeInTheDocument()
  })

  it('renderItem opcional reemplaza la fila por defecto', () => {
    render(
      <MenuCategoryAccordion
        label="Bebidas"
        items={items}
        selectedQtys={{}}
        onAdd={() => {}}
        onRemove={() => {}}
        renderItem={(it) => <div key={it.key}>custom:{it.name}</div>}
      />
    )
    expect(screen.getByText('custom:Bebida')).toBeInTheDocument()
    expect(screen.getByText('custom:Papas')).toBeInTheDocument()
  })
})
