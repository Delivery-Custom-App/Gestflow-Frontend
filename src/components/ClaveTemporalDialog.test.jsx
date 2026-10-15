/** Clave temporal al restablecer (T-61). */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ClaveTemporalDialog from './ClaveTemporalDialog'

afterEach(() => { vi.restoreAllMocks() })

describe('ClaveTemporalDialog', () => {
  it('«Copiar» la deja en el portapapeles', async () => {
    const user = userEvent.setup()
    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue()
    render(<ClaveTemporalDialog nombre="Ana" clave="yndRTRPF" correoEnviado onClose={() => {}} />)

    await user.click(screen.getByRole('button', { name: 'Copiar la clave temporal' }))
    expect(writeText).toHaveBeenCalledWith('yndRTRPF')
    expect(screen.getByText('Copiada')).toBeInTheDocument()
  })

  it('con el correo enviado no pide entregarla en mano', () => {
    render(<ClaveTemporalDialog nombre="Ana" clave="x" correoEnviado onClose={() => {}} />)
    expect(screen.getByText('También se envió por correo.')).toBeInTheDocument()
    expect(screen.queryByText(/entrégala en mano/)).not.toBeInTheDocument()
  })

  it('si no se puede copiar, lo dice', async () => {
    const user = userEvent.setup()
    vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(new Error('no'))
    render(<ClaveTemporalDialog nombre="Ana" clave="x" correoEnviado={false} onClose={() => {}} />)
    await user.click(screen.getByRole('button', { name: 'Copiar la clave temporal' }))
    expect(screen.getByText(/cópiala a mano/)).toBeInTheDocument()
  })
})
