/** La caja física manda (#133 y #140): rutas y reglas de la apertura y el cierre. */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { apiRequest, formatApiErrorDetail } from './apiClient'
import { V2_FEATURES } from './v2Features'
import {
  abrirCajaFisica, aperturasDelLocal, asignarCajaAMaquina, crearNombreDe, resumenesDeHoy, sumarResumenDelDia, cajasAbiertas, cerrarCajaFisica, desgloseParaApi, faltaNota,
  listarAperturas, listarCajasFisicasDelLocal, mensajeCajaFisica, registrarMovimientoCajaFisica,
  resumenParaPantalla, revisarCierreCajaFisica, ultimoCierreDe, validarMovimientoCajaFisica,
} from './cajaFisica'
import { estadoDeMaquina, maxPorMaquina } from './maquinasCobro'
import { forzarTermino } from './supervision'

vi.mock('./apiClient', async (importOriginal) => ({ ...(await importOriginal()), apiRequest: vi.fn() }))

beforeEach(() => { vi.clearAllMocks(); apiRequest.mockResolvedValue({}) })
afterEach(() => { V2_FEATURES.cajaFisicaManda = false })

describe('desglose y estado de las cajas', () => {
  it('desgloseParaApi manda solo las denominaciones contadas, con su tipo', () => {
    expect(desgloseParaApi({ 20000: 2, 10000: 1, 500: 3, 100: 0 })).toEqual([
      { denominacion: 20000, tipo: 'billete', cantidad: 2 },
      { denominacion: 10000, tipo: 'billete', cantidad: 1 },
      { denominacion: 500, tipo: 'moneda', cantidad: 3 },
    ])
    expect(desgloseParaApi({})).toEqual([])
  })

  it('cajasAbiertas: solo las activas y abiertas ahora', () => {
    const cajas = [
      { id: 'a', is_active: true, abierta: true },
      { id: 'b', is_active: true, abierta: false },
      { id: 'c', is_active: false, abierta: true },
    ]
    expect(cajasAbiertas(cajas).map((c) => c.id)).toEqual(['a'])
    expect(cajasAbiertas(undefined)).toEqual([])
  })

  it('ultimoCierreDe toma lo contado, cuándo y quién; sin cierre es null', () => {
    expect(ultimoCierreDe({ ultimo_cierre: { monto_cierre_declarado: '50000.00', cerrada_at: '2026-10-21T09:25:09Z', cerrada_por_email: 'admin@demo' } }))
      .toEqual({ contado: 50000, cerradaAt: '2026-10-21T09:25:09Z', cerro: 'admin@demo' })
    expect(ultimoCierreDe({ ultimo_cierre: null })).toBeNull()
    expect(ultimoCierreDe({})).toBeNull()
  })

  it('lista las cajas del local con su nombre', async () => {
    apiRequest.mockResolvedValueOnce([{ id: 'cf-1', nombre: 'Caja principal', abierta: true }])
    expect(await listarCajasFisicasDelLocal('loc-1')).toEqual([{ id: 'cf-1', nombre: 'Caja principal', name: 'Caja principal', abierta: true }])
    expect(apiRequest).toHaveBeenCalledWith('/cajas-fisicas?local_id=loc-1')
  })
})

describe('rutas de la apertura y el cierre', () => {
  it('abrir manda el desglose (obligatorio, vacío es $0) y la nota solo si hay', async () => {
    await abrirCajaFisica('cf-1', { cantidades: { 20000: 2 } })
    expect(apiRequest).toHaveBeenLastCalledWith('/cajas-fisicas/cf-1/abrir', { method: 'POST', body: { apertura_desglose: [{ denominacion: 20000, tipo: 'billete', cantidad: 2 }] } })
    await abrirCajaFisica('cf-1', { cantidades: {}, nota: '  Se depositó  ' })
    expect(apiRequest).toHaveBeenLastCalledWith('/cajas-fisicas/cf-1/abrir', { method: 'POST', body: { apertura_desglose: [], nota_apertura: 'Se depositó' } })
  })

  it('revisar y cerrar usan sus rutas', async () => {
    await revisarCierreCajaFisica('cf-1')
    expect(apiRequest).toHaveBeenLastCalledWith('/cajas-fisicas/cf-1/cierre')
    await cerrarCajaFisica('cf-1', { cantidades: { 10000: 5 }, nota: 'Faltó cambio' })
    expect(apiRequest).toHaveBeenLastCalledWith('/cajas-fisicas/cf-1/cerrar', { method: 'POST', body: { cierre_desglose: [{ denominacion: 10000, tipo: 'billete', cantidad: 5 }], nota_cierre: 'Faltó cambio' } })
  })

  it('historial paginado con X-Total-Count', async () => {
    apiRequest.mockResolvedValueOnce({ data: [{ id: 'ap-1' }], total: 12 })
    expect(await listarAperturas('cf-1', { offset: 10 })).toEqual({ aperturas: [{ id: 'ap-1' }], total: 12 })
    expect(apiRequest).toHaveBeenCalledWith('/cajas-fisicas/cf-1/aperturas?limit=10&offset=10', { withTotal: true })
  })

  it('ingreso o retiro en la caja física; asignar caja a una máquina', async () => {
    await registrarMovimientoCajaFisica('cf-1', { tipo: 'egreso', monto: 20000, note: 'Depósito' })
    expect(apiRequest).toHaveBeenLastCalledWith('/cajas-fisicas/cf-1/movimientos', { method: 'POST', body: { tipo: 'egreso', monto: 20000, payment_method: 'cash', note: 'Depósito' } })
    await asignarCajaAMaquina('pm-1', 'cf-2')
    expect(apiRequest).toHaveBeenLastCalledWith('/pos-machines/pm-1', { method: 'PATCH', body: { caja_fisica_id: 'cf-2' } })
    await asignarCajaAMaquina('pm-1', '')
    expect(apiRequest).toHaveBeenLastCalledWith('/pos-machines/pm-1', { method: 'PATCH', body: { caja_fisica_id: null } })
  })

  it('un retiro exige nota; la caja no tiene gastos', () => {
    expect(validarMovimientoCajaFisica({ tipo: 'egreso', monto: 1000, note: '' })).toMatch(/nota/)
    expect(validarMovimientoCajaFisica({ tipo: 'ingreso', monto: 1000, note: '' })).toBeNull()
    expect(validarMovimientoCajaFisica({ tipo: 'ingreso', monto: 0 })).toMatch(/mayor que \$0/)
    expect(validarMovimientoCajaFisica({ tipo: 'gasto', monto: 1000 })).toMatch(/ingreso o un retiro/)
  })
})

describe('errores y resumen', () => {
  it('el 422 de la nota se detecta y se explica sin el nombre del campo', () => {
    const err = Object.assign(new Error('422'), { status: 422, detail: 'Contaste $40.000 y el último cierre de esta caja dejó $50.000: explica la diferencia en nota_apertura' })
    expect(faltaNota(err)).toBe(true)
    expect(mensajeCajaFisica(err)).toBe('Contaste $40.000 y el último cierre de esta caja dejó $50.000: explica la diferencia en la nota')
    expect(faltaNota(Object.assign(new Error('409'), { status: 409, detail: 'La caja ya está abierta' }))).toBe(false)
  })

  it('el resumen de la apertura se pasa a lo que muestra la pantalla', () => {
    expect(resumenParaPantalla({
      fondo: '50000.00', ventas_por_medio: { efectivo: '12000.00', tarjeta: '8000.00', transferencia: '0.00', otros: '0.00' },
      total_ingresos_manuales: '5000.00', total_retiros: '20000.00', efectivo_esperado: '47000.00',
      monto_cierre_declarado: '46000.00', diferencia: '-1000.00',
    })).toEqual({
      fondo: 50000, ventas: { efectivo: 12000, tarjeta: 8000, transferencia: 0, otros: 0 },
      ingresosCaja: 5000, retiros: 20000, esperado: 47000, contado: 46000, diferencia: -1000,
    })
  })
})

describe('máquinas y turnos (#133 y #140)', () => {
  it('una máquina se comparte entre 3 personas con la caja física mandando (2 antes)', () => {
    expect(maxPorMaquina()).toBe(2)
    expect(estadoDeMaquina({ activa: true, ocupacion: 2 })).toBe('llena')
    V2_FEATURES.cajaFisicaManda = true
    expect(maxPorMaquina()).toBe(3)
    expect(estadoDeMaquina({ activa: true, ocupacion: 2 })).toBe('compartible')
    expect(estadoDeMaquina({ activa: true, ocupacion: 3 })).toBe('llena')
  })

  it('forzarTermino manda para_cerrar_la_caja solo cuando se pide', async () => {
    await forzarTermino('t-1', { motivo: 'Cierre de caja', cerrarSesion: true, paraCerrarLaCaja: true })
    expect(apiRequest).toHaveBeenLastCalledWith('/cajas/t-1/forzar-termino', { method: 'POST', body: { motivo: 'Cierre de caja', cerrar_sesion: true, para_cerrar_la_caja: true } })
    await forzarTermino('t-1', { motivo: 'Se fue' })
    expect(apiRequest).toHaveBeenLastCalledWith('/cajas/t-1/forzar-termino', { method: 'POST', body: { motivo: 'Se fue' } })
  })
})

describe('el 409 del cierre trae un detail con estructura', () => {
  it('se muestra su mensaje, no el JSON', () => {
    expect(formatApiErrorDetail({ motivo: 'turnos_abiertos', mensaje: 'Hay 1 empleado(s) todavía en turno en esta caja', turnos: [] }))
      .toBe('Hay 1 empleado(s) todavía en turno en esta caja')
    expect(formatApiErrorDetail({ otra: 'cosa' })).toBe('{"otra":"cosa"}')
  })
})

describe('registro de aperturas del local', () => {
  it('junta las aperturas de todas las cajas, de la más nueva a la más vieja, con el nombre de su caja', async () => {
    apiRequest.mockImplementation(async (ruta) => (ruta.startsWith('/cajas-fisicas/cf-1/')
      ? { data: [{ id: 'a1', abierta_at: '2026-10-20T10:00:00Z' }, { id: 'a3', abierta_at: '2026-10-21T10:00:00Z' }], total: 2 }
      : { data: [{ id: 'a2', abierta_at: '2026-10-20T15:00:00Z' }], total: 1 }))
    const aperturas = await aperturasDelLocal([{ id: 'cf-1', name: 'Caja principal' }, { id: 'cf-2', name: 'Caja terraza' }])
    expect(aperturas.map((a) => [a.id, a.cajaNombre])).toEqual([['a3', 'Caja principal'], ['a2', 'Caja terraza'], ['a1', 'Caja principal']])
    expect(apiRequest).toHaveBeenCalledWith('/cajas-fisicas/cf-1/aperturas?limit=20&offset=0', { withTotal: true })
  })

  it('si una caja falla, igual muestra las demás', async () => {
    apiRequest.mockImplementation(async (ruta) => {
      if (ruta.startsWith('/cajas-fisicas/cf-1/')) throw new Error('500')
      return { data: [{ id: 'a2', abierta_at: '2026-10-20T15:00:00Z' }], total: 1 }
    })
    expect((await aperturasDelLocal([{ id: 'cf-1' }, { id: 'cf-2', name: 'Caja terraza' }])).map((a) => a.id)).toEqual(['a2'])
  })
})

describe('el nombre de quien abrió o cerró', () => {
  const usuarios = [{ id: 'u-1', email: 'centro.admin@demo', first_name: 'Carla', last_name: 'Muñoz' }]
  const yo = { id: 'u-yo', email: 'admin@demo', first_name: 'Dueño', last_name: 'Demo' }

  it('se busca por id o por correo, también quien tiene la sesión; si no aparece, queda el correo', () => {
    const nombreDe = crearNombreDe(usuarios, yo)
    expect(nombreDe('u-1', 'centro.admin@demo')).toBe('Carla Muñoz')
    expect(nombreDe(null, 'CENTRO.ADMIN@demo')).toBe('Carla Muñoz')
    expect(nombreDe(null, 'admin@demo')).toBe('Dueño Demo')
    expect(nombreDe(null, 'otro@demo')).toBe('otro@demo')
    expect(nombreDe(null, null)).toBe('—')
  })
})

describe('resumen del día con las aperturas (#133)', () => {
  const R = (o) => ({ fondo: '0', ventas_por_medio: { efectivo: '0', tarjeta: '0', transferencia: '0', otros: '0' }, total_vendido: '0', total_ingresos_manuales: '0', total_retiros: '0', efectivo_esperado: '0', monto_cierre_declarado: null, diferencia: null, ...o })

  it('suma fondo, ventas, ingresos, retiros y esperado de todas; contado y diferencia solo de las cerradas', () => {
    const dia = sumarResumenDelDia([
      { apertura: { id: 'a1', status: 'closed' }, resumen: R({ fondo: '40000.00', ventas_por_medio: { efectivo: '2500.00', tarjeta: '8000.00', transferencia: '0', otros: '0' }, total_vendido: '10500.00', total_ingresos_manuales: '1000.00', total_retiros: '5000.00', efectivo_esperado: '38500.00', monto_cierre_declarado: '20000.00', diferencia: '-18500.00' }) },
      { apertura: { id: 'a2', status: 'open' }, resumen: R({ fondo: '20000.00', ventas_por_medio: { efectivo: '2500.00', tarjeta: '0', transferencia: '0', otros: '0' }, total_vendido: '2500.00', efectivo_esperado: '22500.00' }) },
      { apertura: { id: 'a3', status: 'open' }, resumen: null },
    ])
    expect(dia).toMatchObject({
      aperturas: 3, abiertas: 2, cerradas: 1, sinResumen: 1,
      fondo: 60000, ventas: { efectivo: 5000, tarjeta: 8000, transferencia: 0, otros: 0 }, totalVendido: 13000,
      ingresosCaja: 1000, retiros: 5000, esperado: 61000, contado: 20000, diferencia: -18500,
    })
  })

  it('sin cajas cerradas, contado y diferencia quedan en null', () => {
    const dia = sumarResumenDelDia([{ apertura: { status: 'open' }, resumen: R({ fondo: '1000' }) }])
    expect(dia.contado).toBeNull()
    expect(dia.diferencia).toBeNull()
    expect(dia.fondo).toBe(1000)
  })

  it('resumenesDeHoy toma solo las aperturas del día y pide el resumen de cada una', async () => {
    apiRequest.mockImplementation(async (ruta) => {
      if (ruta.includes('/aperturas?')) return { data: [{ id: 'hoy', business_date: '2026-10-21', abierta_at: '2026-10-21T12:00:00Z' }, { id: 'ayer', business_date: '2026-10-20', abierta_at: '2026-10-20T12:00:00Z' }], total: 2 }
      if (ruta.endsWith('/hoy/resumen')) return { fondo: '5000.00' }
      throw new Error('no esperado')
    })
    const items = await resumenesDeHoy([{ id: 'cf-1', name: 'Caja principal' }], '2026-10-21')
    expect(items).toEqual([{ apertura: expect.objectContaining({ id: 'hoy', cajaNombre: 'Caja principal' }), resumen: { fondo: '5000.00' } }])
  })
})
