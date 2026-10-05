import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import UmbralFlujoDrawer from './UmbralFlujoDrawer'

const UMBRAL = { horas: 1, medium: 5, high: 15 }

describe('UmbralFlujoDrawer', () => {
  it('explica qué se cuenta, en qué período, cada color y la flecha', () => {
    render(<UmbralFlujoDrawer umbral={UMBRAL} onGuardar={vi.fn()} onClose={vi.fn()} />)
    const explicacion = screen.getByRole('region', { name: 'Cómo se lee' })

    expect(explicacion).toHaveTextContent(/ventas \(órdenes no canceladas\)/)
    expect(explicacion).toHaveTextContent(/en la última hora/)
    expect(explicacion).toHaveTextContent('Verde, flujo bajo: menos de 5 ventas.')
    expect(explicacion).toHaveTextContent('Amarillo, flujo medio: desde 5 ventas.')
    expect(explicacion).toHaveTextContent('Rojo, flujo alto: desde 15 ventas.')
    expect(explicacion).toHaveTextContent(/flecha compara la última hora con la anterior/)
    expect(explicacion).toHaveTextContent(/El mismo umbral vale para todas las franquicias/)
    expect(explicacion).toHaveTextContent(/Se actualiza solo/)
  })

  it('guarda el período en horas y los umbrales', async () => {
    const onGuardar = vi.fn()
    const user = userEvent.setup()
    render(<UmbralFlujoDrawer umbral={UMBRAL} onGuardar={onGuardar} onClose={vi.fn()} />)

    await user.clear(screen.getByLabelText('Período (horas)'))
    await user.type(screen.getByLabelText('Período (horas)'), '3')
    await user.clear(screen.getByLabelText('Flujo alto desde'))
    await user.type(screen.getByLabelText('Flujo alto desde'), '30')
    await user.click(screen.getByRole('button', { name: 'Guardar' }))

    expect(onGuardar).toHaveBeenCalledWith({ horas: 3, medium: 5, high: 30 })
  })

  it('no guarda un umbral inválido y dice por qué', async () => {
    const onGuardar = vi.fn()
    const user = userEvent.setup()
    render(<UmbralFlujoDrawer umbral={UMBRAL} onGuardar={onGuardar} onClose={vi.fn()} />)

    await user.clear(screen.getByLabelText('Flujo medio desde'))
    await user.type(screen.getByLabelText('Flujo medio desde'), '20')
    await user.click(screen.getByRole('button', { name: 'Guardar' }))

    expect(screen.getByRole('alert')).toHaveTextContent('menor que el de flujo alto')
    expect(onGuardar).not.toHaveBeenCalled()
  })

  it('avisa que se guarda en este navegador', () => {
    render(<UmbralFlujoDrawer umbral={UMBRAL} onGuardar={vi.fn()} onClose={vi.fn()} />)
    expect(screen.getByText(/Se guarda en este navegador/)).toBeInTheDocument()
  })
})
