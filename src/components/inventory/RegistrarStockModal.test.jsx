import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import RegistrarStockModal from './RegistrarStockModal'

const ROW = { product_name: 'Bebida lata', stock_current: 20 }

describe('RegistrarStockModal', () => {
  it('sumar: dice cuánto hay, muestra cuánto quedará y guarda solo lo que llegó', async () => {
    const onGuardar = vi.fn(() => Promise.resolve())
    const user = userEvent.setup()
    render(<RegistrarStockModal modo="sumar" row={ROW} onGuardar={onGuardar} onClose={vi.fn()} />)

    expect(screen.getByRole('dialog', { name: 'Sumar unidades' })).toHaveTextContent('El sistema tiene 20 unidades')
    await user.type(screen.getByLabelText('¿Cuántas unidades llegaron?'), '24')
    expect(screen.getByText('Quedarán 44 unidades.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Guardar' }))

    await waitFor(() => expect(onGuardar).toHaveBeenCalledWith({ cantidad: 24 }))
  })

  it('sumar sin cantidad no guarda', async () => {
    const onGuardar = vi.fn()
    const user = userEvent.setup()
    render(<RegistrarStockModal modo="sumar" row={ROW} onGuardar={onGuardar} onClose={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Indica cuántas unidades llegaron.')
    expect(onGuardar).not.toHaveBeenCalled()
  })

  it('corregir: muestra la diferencia con el sistema y guarda lo contado', async () => {
    const onGuardar = vi.fn(() => Promise.resolve())
    const user = userEvent.setup()
    render(<RegistrarStockModal modo="corregir" row={ROW} onGuardar={onGuardar} onClose={vi.fn()} />)

    await user.type(screen.getByLabelText('¿Cuántas unidades contaste?'), '18')
    expect(screen.getByText('Diferencia: -2 unidades.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Guardar' }))

    await waitFor(() => expect(onGuardar).toHaveBeenCalledWith({ cantidad: 18 }))
  })

  it('corregir a 0 es válido (se acabó)', async () => {
    const onGuardar = vi.fn(() => Promise.resolve())
    const user = userEvent.setup()
    render(<RegistrarStockModal modo="corregir" row={ROW} onGuardar={onGuardar} onClose={vi.fn()} />)

    await user.type(screen.getByLabelText('¿Cuántas unidades contaste?'), '0')
    await user.click(screen.getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(onGuardar).toHaveBeenCalledWith({ cantidad: 0 }))
  })

  it('empezar: pide las unidades, el mínimo y el nivel crítico opcional', async () => {
    const onGuardar = vi.fn(() => Promise.resolve())
    const user = userEvent.setup()
    render(<RegistrarStockModal modo="empezar" row={{ product_name: 'Agua mineral' }} onGuardar={onGuardar} onClose={vi.fn()} />)

    await user.type(screen.getByLabelText('Unidades que hay hoy'), '30')
    await user.clear(screen.getByLabelText('Mínimo'))
    await user.type(screen.getByLabelText('Mínimo'), '10')
    await user.type(screen.getByLabelText('Nivel crítico'), '4')
    await user.click(screen.getByRole('button', { name: 'Guardar' }))

    await waitFor(() => expect(onGuardar).toHaveBeenCalledWith({ stockActual: 30, stockMin: 10, stockCritical: 4 }))
  })

  it('empezar: el nivel crítico no puede superar el mínimo', async () => {
    const onGuardar = vi.fn()
    const user = userEvent.setup()
    render(<RegistrarStockModal modo="empezar" row={{ product_name: 'Agua mineral' }} onGuardar={onGuardar} onClose={vi.fn()} />)

    await user.type(screen.getByLabelText('Unidades que hay hoy'), '30')
    await user.type(screen.getByLabelText('Nivel crítico'), '5')
    await user.click(screen.getByRole('button', { name: 'Guardar' }))

    expect(screen.getByRole('alert')).toHaveTextContent('no puede ser mayor que el mínimo')
    expect(onGuardar).not.toHaveBeenCalled()
  })

  it('si el backend falla, lo dice y no cierra', async () => {
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(<RegistrarStockModal modo="sumar" row={ROW} onGuardar={() => Promise.reject(new Error('No autorizado'))} onClose={onClose} />)

    await user.type(screen.getByLabelText('¿Cuántas unidades llegaron?'), '5')
    await user.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('No autorizado')
    expect(onClose).not.toHaveBeenCalled()
  })
})
