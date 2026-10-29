/**
 * Pantalla de login ante un error de validación del backend (#166).
 *
 * El navegador deja enviar «juan@gmail» (para HTML es un correo válido) y el
 * backend lo rechaza con un 422 cuyo `detail` es una lista; la pantalla mostraba
 * «[object Object]». Se monta con el proveedor real y solo se simula la red.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import LoginPage from './LoginPage'
import { AppAuthProvider } from '../context/AuthContext'

function respuesta(status, body) {
  return { ok: status < 400, status, statusText: '', headers: { get: () => null }, json: () => Promise.resolve(body) }
}

const CORREO_INVALIDO = {
  detail: [{
    type: 'value_error',
    loc: ['body', 'email'],
    msg: 'value is not a valid email address: The part after the @-sign is not valid. It should have a period.',
    input: 'juan@gmail',
  }],
}
const MENSAJE_CORREO_INVALIDO = 'email: value is not a valid email address: The part after the @-sign is not valid. It should have a period.'

describe('LoginPage · errores del backend', () => {
  beforeEach(() => {
    window.localStorage.clear()
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    window.localStorage.clear()
  })

  const montar = () => render(
    <AppAuthProvider>
      <LoginPage />
    </AppAuthProvider>,
  )

  async function entrar(user, correo, clave = 'demo123') {
    await user.clear(screen.getByLabelText('Correo electrónico'))
    await user.type(screen.getByLabelText('Correo electrónico'), correo)
    await user.clear(screen.getByLabelText('Contraseña'))
    await user.type(screen.getByLabelText('Contraseña'), clave)
    await user.click(screen.getByRole('button', { name: /entrar/i }))
  }

  it('con «juan@gmail» muestra el motivo del backend y no «[object Object]»', async () => {
    const user = userEvent.setup()
    fetch.mockResolvedValueOnce(respuesta(422, CORREO_INVALIDO))
    montar()

    await entrar(user, 'juan@gmail')

    expect(await screen.findByText(MENSAJE_CORREO_INVALIDO)).toBeInTheDocument()
    expect(screen.queryByText(/\[object Object\]/)).not.toBeInTheDocument()
    // La petición salió con el correo tal como se escribió.
    expect(JSON.parse(fetch.mock.calls[0][1].body).email).toBe('juan@gmail')
  })

  it('sigue mostrando «Credenciales inválidas» cuando el backend manda el detalle como texto', async () => {
    const user = userEvent.setup()
    fetch.mockResolvedValueOnce(respuesta(401, { detail: 'Credenciales inválidas' }))
    montar()

    await entrar(user, 'centro.admin@demo.gestflow.dev', 'mala')

    expect(await screen.findByText('Credenciales inválidas')).toBeInTheDocument()
  })

  it('al reintentar con otro error, el mensaje anterior se reemplaza', async () => {
    const user = userEvent.setup()
    fetch
      .mockResolvedValueOnce(respuesta(422, CORREO_INVALIDO))
      .mockResolvedValueOnce(respuesta(401, { detail: 'Credenciales inválidas' }))
    montar()

    await entrar(user, 'juan@gmail')
    expect(await screen.findByText(MENSAJE_CORREO_INVALIDO)).toBeInTheDocument()

    await entrar(user, 'juan@gmail.com')

    expect(await screen.findByText('Credenciales inválidas')).toBeInTheDocument()
    expect(screen.queryByText(MENSAJE_CORREO_INVALIDO)).not.toBeInTheDocument()
  })

  it('al reintentar con un correo bueno entra y no queda ningún error en pantalla', async () => {
    const user = userEvent.setup()
    fetch
      .mockResolvedValueOnce(respuesta(422, CORREO_INVALIDO))
      .mockResolvedValueOnce(respuesta(200, { access_token: 'AT1', user: { id: 'u-1', email: 'juan@gmail.com', role: 'ADMIN' } }))
    montar()

    await entrar(user, 'juan@gmail')
    expect(await screen.findByText(MENSAJE_CORREO_INVALIDO)).toBeInTheDocument()

    await entrar(user, 'juan@gmail.com')

    await vi.waitFor(() => expect(window.localStorage.getItem('gestflow-auth-token')).toBe('AT1'))
    expect(screen.queryByText(MENSAJE_CORREO_INVALIDO)).not.toBeInTheDocument()
    expect(screen.queryByText(/\[object Object\]/)).not.toBeInTheDocument()
  })
})
