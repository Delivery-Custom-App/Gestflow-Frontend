/**
 * Inicio del dueño: reemplaza a "Tus franquicias". Desde aquí se llega a las
 * franquicias y a los usuarios del negocio.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import LocalsGrid from './LocalsGrid'

vi.mock('./FranchisesMap', () => ({ default: () => null }))
vi.mock('./FranchiseSalesCharts', () => ({ default: () => null }))

const LOCALES = [
  { id: 'loc-1', name: 'Sucursal Centro', sales_model: 'RESTAURANT' },
  { id: 'loc-2', name: 'Mostrador Express', sales_model: 'AL_PASO' },
]

const montar = (props = {}) => render(
  <LocalsGrid locales={LOCALES} onLocalSelect={() => {}} onCreateLocal={() => {}} {...props} />,
)

describe('LocalsGrid — Inicio del dueño', () => {
  it('la pantalla se llama Inicio y ya no "Tus franquicias"', () => {
    montar()

    expect(screen.getByRole('heading', { level: 1, name: 'Inicio' })).toBeInTheDocument()
    expect(screen.queryByText('Tus franquicias')).not.toBeInTheDocument()
  })

  it('sigue llevando a cada franquicia', () => {
    montar()

    expect(screen.getAllByText('Sucursal Centro').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Mostrador Express').length).toBeGreaterThan(0)
  })

  it('lleva a los usuarios del negocio', async () => {
    const onShowUsers = vi.fn()
    const user = userEvent.setup()
    montar({ onShowUsers })

    await user.click(screen.getByRole('button', { name: 'Usuarios' }))

    expect(onShowUsers).toHaveBeenCalled()
  })

  it('sin acceso a usuarios no ofrece el botón', () => {
    montar()

    expect(screen.queryByRole('button', { name: 'Usuarios' })).not.toBeInTheDocument()
  })

  it('la guía habla del Inicio y explica el acceso a los usuarios', async () => {
    const user = userEvent.setup()
    montar({ onShowUsers: () => {} })

    await user.click(screen.getByRole('button', { name: /cómo funciona esta pantalla/i }))

    expect(screen.getByRole('heading', { name: 'Guía — Inicio' })).toBeInTheDocument()
    expect(screen.getByText('Usuarios del negocio')).toBeInTheDocument()
    expect(screen.queryByText(/Guía — Tus Franquicias/i)).not.toBeInTheDocument()
  })

  it('"Umbral de flujo" es un botón propio, fuera de Opciones, y guarda el nuevo umbral', async () => {
    const onGuardarUmbral = vi.fn()
    const user = userEvent.setup()
    montar({ umbral: { horas: 2, medium: 5, high: 15 }, onGuardarUmbral })

    expect(screen.getByText(/Flujo de las últimas 2 horas/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Umbral de flujo' }))
    const panel = screen.getByRole('dialog', { name: 'Umbral de flujo' })
    expect(panel).toHaveTextContent(/las últimas 2 horas/)

    await user.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(onGuardarUmbral).toHaveBeenCalledWith({ horas: 2, medium: 5, high: 15 })
    expect(screen.queryByRole('dialog', { name: 'Umbral de flujo' })).not.toBeInTheDocument()
  })

  it('"Eliminar franquicia": sin permiso, no aparece', () => {
    montar()
    expect(screen.getByRole('button', { name: 'Umbral de flujo' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Eliminar franquicia' })).not.toBeInTheDocument()
  })

  it('con permiso, el botón se llama "Eliminar franquicia" (antes "Opciones")', () => {
    montar({ canDeleteLocals: true })
    expect(screen.getByRole('button', { name: 'Eliminar franquicia' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Opciones' })).not.toBeInTheDocument()
  })

  it('sin permiso para eliminar, la guía no menciona el botón Eliminar franquicia', async () => {
    const user = userEvent.setup()
    montar()

    await user.click(screen.getByRole('button', { name: /cómo funciona esta pantalla/i }))

    expect(screen.getByText('Botón Umbral de flujo')).toBeInTheDocument()
    expect(screen.queryByText('Botón Eliminar franquicia')).not.toBeInTheDocument()
  })

  it('con permiso para eliminar, la guía explica el botón Eliminar franquicia', async () => {
    const user = userEvent.setup()
    montar({ canDeleteLocals: true })

    await user.click(screen.getByRole('button', { name: /cómo funciona esta pantalla/i }))

    expect(screen.getByText('Botón Eliminar franquicia')).toBeInTheDocument()
  })

  it('"Mis franquicias" titula la lista, después de las ventas generales', () => {
    montar()
    expect(screen.getByRole('heading', { name: 'Mis franquicias' })).toBeInTheDocument()
  })

  it('el color de cada franquicia sale del umbral recibido', () => {
    montar({ umbral: { horas: 1, medium: 2, high: 4 }, salesCounts: { 'loc-1': 4, 'loc-2': 1 } })
    const fila = (nombre) => screen.getAllByRole('row').find((r) => r.textContent.includes(nombre))
    expect(fila('Sucursal Centro')).toHaveTextContent(/Alto/)
    expect(fila('Mostrador Express')).toHaveTextContent(/Bajo/)
  })
})
