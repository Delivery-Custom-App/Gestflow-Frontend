/** Mis sesiones (T-74): lectura, orden y cómo se nombra cada dispositivo. */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { apiRequest } from './apiClient'
import {
  cerrarSesionesDe, fechaHora, listarMisSesiones, listarSesionesDe, nombreDelDispositivo, resumirUserAgent, textoDelCierre,
  validarMotivoSesion,
} from './sesiones'

vi.mock('./apiClient', () => ({ apiRequest: vi.fn() }))

const CHROME_WINDOWS = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36'
const EDGE_WINDOWS = `${CHROME_WINDOWS} Edg/129.0`
const SAFARI_IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
const FIREFOX_LINUX = 'Mozilla/5.0 (X11; Linux x86_64; rv:130.0) Gecko/20100101 Firefox/130.0'

beforeEach(() => { vi.clearAllMocks() })

describe('listarMisSesiones', () => {
  it('pide GET /auth/sessions, deja fuera las cerradas y pone la actual primero', async () => {
    apiRequest.mockResolvedValue([
      { id: 's1', activa: true, es_actual: false, last_seen_at: '2026-10-14T10:00:00Z' },
      { id: 's2', activa: false, es_actual: false, last_seen_at: '2026-10-14T12:00:00Z' },
      { id: 's3', activa: true, es_actual: true, last_seen_at: '2026-10-14T09:00:00Z' },
      { id: 's4', activa: true, es_actual: false, last_seen_at: '2026-10-14T11:00:00Z' },
    ])
    const filas = await listarMisSesiones()
    expect(apiRequest).toHaveBeenCalledWith('/auth/sessions')
    expect(filas.map((s) => s.id)).toEqual(['s3', 's4', 's1'])
  })
})

describe('nombre del dispositivo', () => {
  it('usa el nombre que dio la app al iniciar sesión', () => {
    expect(nombreDelDispositivo({ device_name: 'Tablet barra', user_agent: CHROME_WINDOWS })).toBe('Tablet barra')
  })

  it('sin nombre, resume el user agent', () => {
    expect(nombreDelDispositivo({ device_name: null, user_agent: CHROME_WINDOWS })).toBe('Chrome en Windows')
    expect(resumirUserAgent(EDGE_WINDOWS)).toBe('Edge en Windows')
    expect(resumirUserAgent(SAFARI_IPHONE)).toBe('Safari en iPhone o iPad')
    expect(resumirUserAgent(FIREFOX_LINUX)).toBe('Firefox en Linux')
  })

  it('un user agent que no se reconoce se muestra recortado, y sin nada dice desconocido', () => {
    expect(resumirUserAgent('Python-urllib/3.11')).toBe('Python-urllib/3.11')
    expect(resumirUserAgent('x'.repeat(60))).toBe(`${'x'.repeat(40)}…`)
    expect(resumirUserAgent('')).toBe('Dispositivo desconocido')
  })
})

describe('fechaHora', () => {
  it('fecha y hora en formato chileno, "—" sin dato', () => {
    expect(fechaHora('2026-10-14T12:30:00')).toMatch(/^14-10-2026 12:30$/)
    expect(fechaHora(null)).toBe('—')
    expect(fechaHora('no es fecha')).toBe('—')
  })
})

describe('sesiones de otra persona (T-53)', () => {
  it('lista con incluir_cerradas y deja las abiertas primero', async () => {
    apiRequest.mockResolvedValue([
      { id: 'c', activa: false, revoked_at: '2026-10-14T10:00:00Z' },
      { id: 'a', activa: true, last_seen_at: '2026-10-14T09:00:00Z' },
    ])
    const filas = await listarSesionesDe('u 1', { incluirCerradas: true })
    expect(apiRequest).toHaveBeenCalledWith('/users/u%201/sessions?incluir_cerradas=true')
    expect(filas.map((s) => s.id)).toEqual(['a', 'c'])
  })

  it('cerrar manda motivo y session_id (null = todas)', async () => {
    apiRequest.mockResolvedValue({ cerradas: 2, sesiones: [] })
    await cerrarSesionesDe('u1', { motivo: '  Perdió el celular ', sessionId: null })
    expect(apiRequest).toHaveBeenCalledWith('/users/u1/sessions/cerrar', { method: 'POST', body: { motivo: 'Perdió el celular', session_id: null } })
  })

  it('el motivo va de 3 a 300 caracteres', () => {
    expect(validarMotivoSesion('ab')).toMatch(/al menos 3/)
    expect(validarMotivoSesion('x'.repeat(301))).toMatch(/300/)
    expect(validarMotivoSesion('Perdió el celular')).toBeNull()
  })

  it('textoDelCierre traduce revoked_kind', () => {
    expect(textoDelCierre({ revoked_kind: 'admin' })).toBe('La cerró el administrador')
    expect(textoDelCierre({ revoked_kind: 'password' })).toMatch(/clave/)
    expect(textoDelCierre({ revoked_kind: 'otro' })).toBe('otro')
  })
})
