/** Identidad del dispositivo para las sesiones (T-50). */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { DEVICE_ID_KEY, _reiniciarDispositivo, nombreDelEquipo, obtenerDeviceId } from './dispositivo'
import { loginWithPassword } from './authClient'

beforeEach(() => {
  window.localStorage.clear()
  _reiniciarDispositivo()
})
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('obtenerDeviceId', () => {
  it('se crea la primera vez, se guarda y se reutiliza', () => {
    const id = obtenerDeviceId()
    expect(id).toMatch(/^[0-9a-f-]{36}$/)
    expect(window.localStorage.getItem(DEVICE_ID_KEY)).toBe(id)
    expect(obtenerDeviceId()).toBe(id)
  })

  it('si localStorage falla, usa uno en memoria estable y no lanza', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('bloqueado') })
    const a = obtenerDeviceId()
    const b = obtenerDeviceId()
    expect(a).toBeTruthy()
    expect(b).toBe(a)
  })
})

describe('nombreDelEquipo', () => {
  it('describe el navegador y el sistema', () => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36',
    )
    expect(nombreDelEquipo()).toBe('Chrome en Windows')
  })
})

describe('login', () => {
  it('manda device_id y device_name; dos inicios en el mismo navegador usan el mismo id', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve({ access_token: 'AT', user: { id: 1 } }) })
    vi.stubGlobal('fetch', fetchMock)

    await loginWithPassword({ email: 'a@a.cl', password: 'x' })
    await loginWithPassword({ email: 'a@a.cl', password: 'x' })

    const cuerpos = fetchMock.mock.calls.map(([, init]) => JSON.parse(init.body))
    expect(cuerpos[0]).toMatchObject({ email: 'a@a.cl', password: 'x' })
    expect(cuerpos[0].device_id).toBeTruthy()
    expect(cuerpos[0].device_name).toBeTruthy()
    expect(cuerpos[1].device_id).toBe(cuerpos[0].device_id)
  })
})
