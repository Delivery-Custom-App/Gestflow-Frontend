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
})
