import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { apiRequest } from './apiClient'
import {
  displayNameFromEmail,
  v2ListAllUsers,
  v2GetGlobalStats,
  v2GetBusinessStats,
  v2GetAuditLog,
  v2GetObservability,
} from './v2SuperAdminAdapter'

vi.mock('./apiClient', () => ({
  apiRequest: vi.fn(),
}))

const businesses = [
  { id: 'b1', name: 'Panadería Centro', plan: 'pro', is_active: true, created_at: '2026-01-01' },
  { id: 'b2', name: 'Sucursal Sur', plan: null, is_active: false, created_at: '2026-01-01' },
]
const users = [
  { id: 'u1', email: 'ana.perez@x.com', role: 'ADMIN', business_id: 'b1', is_active: true },
  { id: 'u2', email: 'juan@x.com', role: 'EMPLEADO', business_id: 'b1', is_active: false },
  { id: 'u3', email: 'no-business@x.com', role: 'SUPERADMIN', business_id: null },
]
const locals = [
  { id: 'l1', business_id: 'b1' },
  { id: 'l2', business_id: 'b2' },
]
const orders = [
  { id: 'o1', local_id: 'l1', status: 'paid', total: 1000, created_at: '2026-09-01T00:00:00Z' },
  { id: 'o2', local_id: 'l1', status: 'cancelled', total: 5000, created_at: '2026-09-01T00:00:00Z' },
  { id: 'o3', local_id: 'l2', status: 'paid', total: 300, created_at: '2026-01-01T00:00:00Z' },
]

function mockPlatform() {
  apiRequest.mockImplementation((path) => {
    if (path === '/businesses') return Promise.resolve(businesses)
    if (path === '/users') return Promise.resolve(users)
    if (path === '/locals') return Promise.resolve(locals)
    if (path === '/orders') return Promise.resolve(orders)
    if (path.startsWith('/audit')) return Promise.resolve([])
    return Promise.resolve(null)
  })
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-09-15T12:00:00Z'))
})

afterEach(() => {
  vi.useRealTimers()
  vi.clearAllMocks()
})

describe('displayNameFromEmail', () => {
  it('sin email → "—"', () => {
    expect(displayNameFromEmail(null)).toBe('—')
    expect(displayNameFromEmail('')).toBe('—')
  })

  it('formatea el local-part capitalizando palabras', () => {
    expect(displayNameFromEmail('ana.perez@x.com')).toBe('Ana Perez')
    expect(displayNameFromEmail('juan_carlos-lopez@x.com')).toBe('Juan Carlos Lopez')
  })

  it('local-part vacío cae al email completo', () => {
    expect(displayNameFromEmail('@x.com')).toBe('@x.com')
  })
})

describe('v2ListAllUsers', () => {
  it('lista todos los usuarios mapeados con nombre de negocio', async () => {
    mockPlatform()
    const rows = await v2ListAllUsers()
    expect(rows).toHaveLength(3)
    const ana = rows.find((r) => r.id === 'u1')
    expect(ana.name).toBe('Ana Perez')
    expect(ana.business_name).toBe('Panadería Centro')
  })

  it('usuario sin business_id → business_name null', async () => {
    mockPlatform()
    const rows = await v2ListAllUsers()
    const sinBiz = rows.find((r) => r.id === 'u3')
    expect(sinBiz.business_name).toBeNull()
  })

  it('filtra por role', async () => {
    mockPlatform()
    const rows = await v2ListAllUsers({ role: 'admin' })
    expect(rows).toHaveLength(1)
    expect(rows[0].id).toBe('u1')
  })

  it('filtra por businessId', async () => {
    mockPlatform()
    const rows = await v2ListAllUsers({ businessId: 'b1' })
    expect(rows).toHaveLength(2)
  })
})

describe('v2GetGlobalStats', () => {
  it('excluye órdenes canceladas y separa por mes/negocio', async () => {
    mockPlatform()
    const stats = await v2GetGlobalStats()
    expect(stats.totals.orders).toBe(2) // o1, o3 (o2 cancelada)
    expect(stats.totals.monthly_orders).toBe(1) // solo o1 cae en septiembre
    expect(stats.totals.active_businesses).toBe(1)
    const tenantB1 = stats.tenants.find((t) => t.id === 'b1')
    expect(tenantB1.orders).toBe(1)
    expect(tenantB1.revenue).toBe(1000)
    expect(tenantB1.plan).toBe('pro')
    const tenantB2 = stats.tenants.find((t) => t.id === 'b2')
    expect(tenantB2.plan).toBe('starter') // default cuando plan es null
  })
})

describe('v2GetBusinessStats', () => {
  it('lanza 404 si el negocio no existe', async () => {
    mockPlatform()
    await expect(v2GetBusinessStats('no-existe')).rejects.toMatchObject({ status: 404 })
  })

  it('arma stats del negocio incluyendo admins y audit', async () => {
    mockPlatform()
    const res = await v2GetBusinessStats('b1')
    expect(res.business.id).toBe('b1')
    expect(res.stats.users).toBe(2)
    expect(res.stats.admins).toBe(1)
    expect(res.admins[0].name).toBe('Ana Perez')
    expect(res.audit).toEqual([])
  })

  it('si el audit log falla, cae a []', async () => {
    apiRequest.mockImplementation((path) => {
      if (path === '/businesses') return Promise.resolve(businesses)
      if (path === '/users') return Promise.resolve(users)
      if (path === '/locals') return Promise.resolve(locals)
      if (path === '/orders') return Promise.resolve(orders)
      if (path.startsWith('/audit')) return Promise.reject(new Error('boom'))
      return Promise.resolve(null)
    })
    const res = await v2GetBusinessStats('b1')
    expect(res.audit).toEqual([])
  })
})

describe('v2GetAuditLog', () => {
  it('arma query sin params opcionales', async () => {
    apiRequest.mockResolvedValue([{ id: 'a1' }])
    const res = await v2GetAuditLog()
    expect(apiRequest).toHaveBeenCalledWith('/audit?limit=50&offset=0', { token: undefined })
    expect(res).toEqual([{ id: 'a1' }])
  })

  it('incluye business_id y action cuando se pasan', async () => {
    apiRequest.mockResolvedValue([])
    await v2GetAuditLog({ businessId: 'b1', action: 'login', limit: 10, offset: 5 }, 'tok')
    expect(apiRequest).toHaveBeenCalledWith(
      '/audit?business_id=b1&action=login&limit=10&offset=5',
      { token: 'tok' },
    )
  })

  it('respuesta no-array → []', async () => {
    apiRequest.mockResolvedValue(null)
    const res = await v2GetAuditLog()
    expect(res).toEqual([])
  })
})

describe('v2GetObservability', () => {
  it('aplica defaults cuando el backend no manda campos', async () => {
    apiRequest.mockResolvedValue(null)
    const res = await v2GetObservability('tok')
    expect(res.unavailable).toBe(false)
    expect(res.tenants).toEqual([])
    expect(res.endpoints).toEqual([])
    expect(res.business_id).toBeNull()
  })

  it('respeta los valores del backend cuando vienen', async () => {
    apiRequest.mockResolvedValue({
      generated_at: '2026-09-15T00:00:00Z',
      started_at: '2026-09-01T00:00:00Z',
      unavailable: true,
      business_id: 'b1',
      tenants: [{ id: 'b1' }],
      endpoints: [{ path: '/x' }],
    })
    const res = await v2GetObservability('tok', { businessId: 'b1' })
    expect(apiRequest).toHaveBeenCalledWith('/tenant-manager/observability?business_id=b1', { token: 'tok' })
    expect(res.unavailable).toBe(true)
    expect(res.tenants).toEqual([{ id: 'b1' }])
  })
})
