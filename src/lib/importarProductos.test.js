/** Importar productos desde planilla (T-60). */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { apiRequest, getAuthContext } from './apiClient'
import { esperarImportacion, resumenImportacion, subirPlanilla, validarPlanilla } from './importarProductos'

vi.mock('./apiClient', () => ({ apiRequest: vi.fn(), getAuthContext: vi.fn() }))

const archivo = (nombre, size = 100) => ({ name: nombre, size })

beforeEach(() => {
  vi.clearAllMocks()
  getAuthContext.mockResolvedValue({ token: 'tok' })
  vi.stubGlobal('fetch', vi.fn())
})
afterEach(() => { vi.unstubAllGlobals() })

describe('validarPlanilla', () => {
  it('acepta .xlsx y .csv de hasta 5 MB', () => {
    expect(validarPlanilla(archivo('productos.xlsx'))).toBeNull()
    expect(validarPlanilla(archivo('PRODUCTOS.CSV'))).toBeNull()
    expect(validarPlanilla(archivo('productos.pdf'))).toMatch(/\.xlsx o \.csv/)
    expect(validarPlanilla(archivo('grande.xlsx', 6 * 1024 * 1024))).toMatch(/5 MB/)
    expect(validarPlanilla(null)).toMatch(/Elige/)
  })
})

describe('subirPlanilla', () => {
  it('manda multipart con file y local_id', async () => {
    fetch.mockResolvedValue({ ok: true, status: 202, json: () => Promise.resolve({ id: 'job-1', status: 'pending' }) })
    const file = new File(['Nombre;Precio;Costo'], 'productos.csv', { type: 'text/csv' })
    const job = await subirPlanilla(file, 'loc-1')
    expect(job).toEqual({ id: 'job-1', status: 'pending' })
    const [ruta, init] = fetch.mock.calls[0]
    expect(ruta).toMatch(/\/api\/products\/import$/)
    expect(init.method).toBe('POST')
    expect(init.headers).toEqual({ Authorization: 'Bearer tok' })
    expect(init.body.get('local_id')).toBe('loc-1')
    expect(init.body.get('file').name).toBe('productos.csv')
  })

  it('un archivo inválido no se sube', async () => {
    await expect(subirPlanilla(archivo('x.pdf'), 'loc-1')).rejects.toThrow(/\.xlsx o \.csv/)
    expect(fetch).not.toHaveBeenCalled()
  })
})

describe('esperarImportacion y resumen', () => {
  it('consulta el trabajo hasta completed', async () => {
    apiRequest
      .mockResolvedValueOnce({ id: 'job-1', status: 'processing' })
      .mockResolvedValueOnce({ id: 'job-1', status: 'completed', succeeded_rows: 3, updated_rows: 1, failed_rows: 1, errors: [{ row: 4, error: 'Precio es obligatorio' }] })
    const job = await esperarImportacion({ id: 'job-1', status: 'pending' }, { esperar: () => Promise.resolve() })
    expect(apiRequest).toHaveBeenCalledWith('/products/import/job-1')
    expect(resumenImportacion(job)).toEqual({
      estado: 'completed', creadas: 2, actualizadas: 1, conError: 1,
      errores: [{ fila: 4, texto: 'Fila 4: Precio es obligatorio' }],
    })
  })

  it('row 0 es un error del archivo entero', () => {
    const r = resumenImportacion({ status: 'failed', errors: [{ row: 0, error: 'Falta local_id' }] })
    expect(r.errores[0].texto).toBe('Archivo: Falta local_id')
  })
})
