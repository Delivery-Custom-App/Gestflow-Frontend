/**
 * El tour de bienvenida del encargado ya no presenta "Ventas del Día": empieza
 * en Administración y cada paso del menú llega al dashboard del local.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { OnboardingProvider, useOnboarding } from './OnboardingContext'

const navegar = vi.fn()
vi.mock('react-router', () => ({ useNavigate: () => navegar }))
vi.mock('./AuthContext', () => ({ useAuth: () => ({ user: { id: 'enc' }, userRole: 'Admin', assignedLocalId: 'l1' }) }))
vi.mock('../hooks/useLocals', () => ({ useLocals: () => ({ locales: [{ id: 'l1' }] }) }))

function Tour() {
  const { active, step, steps, next, restart } = useOnboarding()
  return (
    <div>
      <button type="button" onClick={restart}>empezar</button>
      <button type="button" onClick={next}>siguiente</button>
      <p>{active ? `paso ${step}: ${steps[step].title}` : 'tour cerrado'}</p>
      <ul>{steps.map((s) => <li key={s.target}>{s.title}</li>)}</ul>
    </div>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  try { localStorage.setItem('siba_onboarding_enc', '1') } catch { /* sin storage */ }
})

describe('Tour de bienvenida del encargado', () => {
  it('no presenta "Ventas del Día"', () => {
    render(<OnboardingProvider><Tour /></OnboardingProvider>)
    expect(screen.queryByText('Ventas del Día')).not.toBeInTheDocument()
    expect(screen.getAllByRole('listitem').map((li) => li.textContent)).toEqual(['Administración', 'POS Restaurante', 'Inventario'])
  })

  it('empieza en Administración y cada paso llega al dashboard del local', async () => {
    const user = userEvent.setup()
    render(<OnboardingProvider><Tour /></OnboardingProvider>)

    await user.click(screen.getByRole('button', { name: 'empezar' }))
    expect(screen.getByText('paso 0: Administración')).toBeInTheDocument()
    expect(navegar).toHaveBeenLastCalledWith('/local/l1/dashboard')

    await user.click(screen.getByRole('button', { name: 'siguiente' }))
    await user.click(screen.getByRole('button', { name: 'siguiente' }))
    expect(screen.getByText('paso 2: Inventario')).toBeInTheDocument()
    expect(navegar).toHaveBeenCalledTimes(3)

    await user.click(screen.getByRole('button', { name: 'siguiente' }))
    expect(screen.getByText('tour cerrado')).toBeInTheDocument()
  })
})
