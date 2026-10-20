import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { apiRequest } from './apiClient'
import {
  displayNameFromEmail,
  v2ListAllUsers,
  v2GetGlobalStats,
  v2GetBusinessStats,
  v2GetAuditLog,
  v2GetAuditPageCount,
  v2GetPlatformSummary,
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
  { id: 'o1', local_id: 'l1', status: 'completed', total: 1000, created_at: '2026-09-01T12:00:00Z' },
  { id: 'o2', local_id: 'l1', status: 'cancelled', total: 5000, created_at: '2026-09-01T12:00:00Z' },
  { id: 'o3', local_id: 'l2', status: 'completed', total: 300, created_at: '2026-01-01T12:00:00Z' },
]

function mockPlatform() {
  apiRequest.mockImplementation((path) => {
    if (path === '/businesses') return Promise.resolve(businesses)
    if (path === '/users') return Promise.resolve(users)
    if (path === '/locals') return Promise.resolve(locals)
    if (path.startsWith('/orders?')) {
      const query = new URLSearchParams(path.split('?')[1])
      const statuses = query.getAll('status')
      const matches = orders.filter((order) => {
        if (String(order.local_id) !== query.get('local_id')) return false
        if (statuses.length && !statuses.includes(order.status)) return false
        const created = new Date(order.created_at)
        if (query.has('date_from') && created < new Date(query.get('date_from'))) return false
        if (query.has('date_to') && created >= new Date(query.get('date_to'))) return false
        return true
      })
      return Promise.resolve({ data: matches.slice(0, Number(query.get('limit'))), total: matches.length })
    }
    if (path.startsWith('/reports/sales?')) {
      const query = new URLSearchParams(path.split('?')[1])
      const matches = orders.filter((order) => order.local_id === query.get('local_id')
        && order.status === 'completed'
        && order.created_at.slice(0, 10) >= query.get('start_date')
        && order.created_at.slice(0, 10) <= query.get('end_date'))
      return Promise.resolve({ total_sales: matches.reduce((sum, order) => sum + order.total, 0), total_orders: matches.length })
    }
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
  it('usa conteos y reportes del servidor, sin descargar órdenes', async () => {
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
    expect(apiRequest).not.toHaveBeenCalledWith('/orders', expect.anything())
    expect(apiRequest.mock.calls.filter(([path]) => String(path).startsWith('/orders?')).every(([, options]) => options.withTotal === true)).toBe(true)
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
    expect(res.stats.orders).toBe(1)
    expect(res.stats.revenue).toBe(1000)
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

describe('v2GetAuditPageCount', () => {
  // Simula una auditoría de `total` eventos que no manda X-Total-Count.
  const simular = (total) => apiRequest.mockImplementation((path, opts = {}) => {
    const offset = Number(new URL(path, 'http://x').searchParams.get('offset'))
    const data = offset < total ? [{ id: `e${offset}` }] : []
    return Promise.resolve(opts.withTotal ? { data, total: null } : data)
  })

  beforeEach(() => vi.clearAllMocks())

  it.each([
    [0, 0], [1, 1], [50, 1], [51, 2], [100, 2], [101, 3], [450, 9], [451, 10], [3333, 67],
  ])('%i eventos → %i páginas', async (eventos, paginas) => {
    simular(eventos)
    expect(await v2GetAuditPageCount({ pageSize: 50 }, 't')).toBe(paginas)
  })

  it('usa X-Total-Count si el backend lo manda, con una sola petición', async () => {
    apiRequest.mockResolvedValue({ data: [{ id: 'e0' }], total: 123 })
    expect(await v2GetAuditPageCount({ pageSize: 50 }, 't')).toBe(3)
    expect(apiRequest).toHaveBeenCalledTimes(1)
  })

  it('filtra por negocio', async () => {
    simular(10)
    await v2GetAuditPageCount({ businessId: 'b1', pageSize: 50 }, 't')
    expect(apiRequest.mock.calls[0][0]).toContain('business_id=b1')
  })
})

describe('v2GetPlatformSummary', () => {
  beforeEach(() => vi.clearAllMocks())

  it('hace una sola llamada y la deja con la forma que usa el Resumen Global', async () => {
    apiRequest.mockResolvedValue({
      generated_at: '2026-10-14T12:00:00Z',
      start_date: '2026-10-01',
      end_date: '2026-10-14',
      businesses_total: 3,
      businesses_active: 2,
      users_total: 9,
      locals_total: 4,
      orders_period: 7,
      revenue_period: '12300.50',
      orders_by_status: [{ status: 'completed', count: 5 }, { status: 'open', count: 0 }],
      users_by_role: [{ role: 'ADMIN', count: 2 }],
      businesses_by_plan: [{ plan: 'pro', count: 1 }, { plan: null, count: 2 }],
      by_business: [
        { business_id: 'b1', name: 'Alfa', plan: 'pro', is_active: false, locals_count: 2, users_count: 3, orders: 5, sales: '9000.00' },
      ],
    })

    const r = await v2GetPlatformSummary({ startDate: '2026-10-01', endDate: '2026-10-14' }, 'tok')

    expect(apiRequest).toHaveBeenCalledExactlyOnceWith(
      '/reports/platform-summary?start_date=2026-10-01&end_date=2026-10-14',
      { token: 'tok' },
    )
    expect(r.totals).toEqual({ businesses: 3, active_businesses: 2, users: 9, locals: 4 })
    expect(r.sales).toMatchObject({ total_orders: 7, total_sales: 12300.5 })
    expect(r.sales.by_business).toEqual([{ business_id: 'b1', name: 'Alfa', total_orders: 5, total_sales: 9000 }])
    expect(r.orders_by_status).toEqual({ completed: 5, open: 0 })
    expect(r.users_by_role).toEqual({ ADMIN: 2 })
    expect(r.businesses_by_plan).toEqual({ pro: 1, starter: 2 })
    expect(r.tenants[0]).toEqual({ id: 'b1', name: 'Alfa', plan: 'pro', is_active: false, locals: 2, users: 3 })
  })
})
