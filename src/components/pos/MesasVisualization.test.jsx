/**
 * La grilla de mesas con grupos: un grupo se ve como una sola unidad de
 * atención y solo se pueden elegir mesas libres para juntarlas.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import MesasVisualization from './MesasVisualization'

const MESAS = [
  { id: 'm-1', name: 'Mesa 1', nombre: 'Mesa 1', state: 'libre', capacidad: 4 },
  { id: 'm-2', name: 'Mesa 2', nombre: 'Mesa 2', state: 'libre', capacidad: 4 },
  { id: 'm-3', name: 'Mesa 3', nombre: 'Mesa 3', state: 'ocupada', capacidad: 2 },
]

const GRUPO = { id: 'g-1', etiqueta: 'Grupo 1', mesaIds: ['m-1', 'm-2'], capacidad: 8 }

describe('MesasVisualization — grupos de mesas', () => {
  let onToggleSeleccion
  let onDeshacerGrupo
  let onMesaSelect

  beforeEach(() => {
    vi.clearAllMocks()
    onToggleSeleccion = vi.fn()
    onDeshacerGrupo = vi.fn()
    onMesaSelect = vi.fn()
  })

  const conGrupo = new Map([['m-1', GRUPO], ['m-2', GRUPO]])

  it('las mesas agrupadas se ven como una sola unidad de atención', () => {
    render(<MesasVisualization mesas={MESAS} gruposPorMesa={conGrupo} onDeshacerGrupo={onDeshacerGrupo} />)

    const distintivos = screen.getAllByText(/Grupo 1 · 2 mesas · 8 personas/)
    expect(distintivos).toHaveLength(2)
  })

  it('un grupo se puede separar desde la mesa', async () => {
    const user = userEvent.setup()
    render(<MesasVisualization mesas={MESAS} gruposPorMesa={conGrupo} onDeshacerGrupo={onDeshacerGrupo} />)

    await user.click(screen.getAllByRole('button', { name: /separar/i })[0])

    expect(onDeshacerGrupo).toHaveBeenCalledWith(GRUPO)
  })

  it('sin grupos no aparece ningún distintivo', () => {
    render(<MesasVisualization mesas={MESAS} gruposPorMesa={new Map()} />)

    expect(screen.queryByText(/Grupo 1/)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /separar/i })).not.toBeInTheDocument()
  })

  it('al agrupar, elegir una mesa libre la selecciona en vez de abrirla', async () => {
    const user = userEvent.setup()
    render(
      <MesasVisualization
        mesas={MESAS} modoAgrupar seleccionadas={new Set()}
        onToggleSeleccion={onToggleSeleccion} onMesaSelect={onMesaSelect}
      />,
    )

    await user.click(screen.getByText('Mesa 1').closest('button'))

    expect(onToggleSeleccion).toHaveBeenCalledWith(expect.objectContaining({ id: 'm-1' }))
    expect(onMesaSelect).not.toHaveBeenCalled()
  })

  it('una mesa ocupada no se puede elegir: el backend solo junta mesas libres', async () => {
    const user = userEvent.setup()
    render(
      <MesasVisualization
        mesas={MESAS} modoAgrupar seleccionadas={new Set()}
        onToggleSeleccion={onToggleSeleccion} onMesaSelect={onMesaSelect}
      />,
    )

    await user.click(screen.getByText('Mesa 3').closest('button'))

    expect(onToggleSeleccion).not.toHaveBeenCalled()
  })

  it('una mesa que ya está en un grupo tampoco se puede volver a elegir', async () => {
    const user = userEvent.setup()
    render(
      <MesasVisualization
        mesas={MESAS} gruposPorMesa={conGrupo} modoAgrupar seleccionadas={new Set()}
        onToggleSeleccion={onToggleSeleccion}
      />,
    )

    await user.click(screen.getByText('Mesa 1').closest('button'))

    expect(onToggleSeleccion).not.toHaveBeenCalled()
  })

  it('fuera del modo agrupar, tocar una mesa la abre como siempre', async () => {
    const user = userEvent.setup()
    render(<MesasVisualization mesas={MESAS} onMesaSelect={onMesaSelect} onToggleSeleccion={onToggleSeleccion} />)

    await user.click(screen.getByText('Mesa 1').closest('button'))

    expect(onMesaSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 'm-1' }))
    expect(onToggleSeleccion).not.toHaveBeenCalled()
  })

  it('mientras se agrupa no se ofrece editar ni borrar mesas', () => {
    const { container } = render(
      <MesasVisualization
        mesas={MESAS} modoAgrupar seleccionadas={new Set()}
        onEditMesa={vi.fn()} onDeleteMesa={vi.fn()} onToggleSeleccion={onToggleSeleccion}
      />,
    )

    const tarjeta = screen.getByText('Mesa 1').closest('div.group')
    expect(within(tarjeta).getByLabelText('Editar mesa').closest('div')).toHaveClass('invisible')
    expect(container).toBeTruthy()
  })
})
