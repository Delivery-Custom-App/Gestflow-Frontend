import { describe, it, expect } from 'vitest'
import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ConteoEfectivo from './ConteoEfectivo'

function Conteo({ inicial = {} }) {
  const [cantidades, setCantidades] = useState(inicial)
  return <ConteoEfectivo cantidades={cantidades} onChange={setCantidades} />
}

describe('ConteoEfectivo', () => {
  it('muestra cada billete y cada moneda con su cantidad, en 0 al empezar', () => {
    render(<Conteo />)
    for (const b of ['$20.000', '$10.000', '$5.000', '$2.000', '$1.000']) {
      expect(screen.getByLabelText(`Cantidad de billetes de ${b}`)).toHaveValue('')
    }
    for (const m of ['$500', '$100', '$50', '$10']) {
      expect(screen.getByLabelText(`Cantidad de monedas de ${m}`)).toBeInTheDocument()
    }
    expect(screen.getByTestId('total-efectivo')).toHaveTextContent('$0')
  })

  it('con + y − se cuenta y los totales se calculan solos', async () => {
    const user = userEvent.setup()
    render(<Conteo />)

    await user.click(screen.getByRole('button', { name: 'Agregar uno: billetes de $20.000' }))
    await user.click(screen.getByRole('button', { name: 'Agregar uno: billetes de $20.000' }))
    await user.click(screen.getByRole('button', { name: 'Agregar uno: monedas de $500' }))
    await user.click(screen.getByRole('button', { name: 'Quitar uno: billetes de $20.000' }))

    expect(screen.getByLabelText('Cantidad de billetes de $20.000')).toHaveValue('1')
    expect(screen.getByTestId('total-billete')).toHaveTextContent('$20.000')
    expect(screen.getByTestId('total-moneda')).toHaveTextContent('$500')
    expect(screen.getByTestId('total-efectivo')).toHaveTextContent('$20.500')
  })

  it('también se puede escribir la cantidad; lo que no es número se ignora', async () => {
    const user = userEvent.setup()
    render(<Conteo />)

    await user.type(screen.getByLabelText('Cantidad de billetes de $1.000'), '1a2')
    expect(screen.getByLabelText('Cantidad de billetes de $1.000')).toHaveValue('12')
    expect(screen.getByTestId('total-efectivo')).toHaveTextContent('$12.000')
  })

  it('no baja de 0: "−" queda desactivado sin billetes', () => {
    render(<Conteo />)
    expect(screen.getByRole('button', { name: 'Quitar uno: billetes de $5.000' })).toBeDisabled()
  })

  it('los botones y los campos miden 44 px de alto (h-11), para tablet', () => {
    render(<Conteo />)
    expect(screen.getByRole('button', { name: 'Agregar uno: monedas de $10' })).toHaveClass('h-11')
    expect(screen.getByLabelText('Cantidad de monedas de $10')).toHaveClass('h-11')
  })
})
