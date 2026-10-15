/** Diálogo de importación desde planilla (T-60). */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ImportarPlanillaDialog from './ImportarPlanillaDialog'
import { descargarPlantilla, esperarImportacion, subirPlanilla } from '../../lib/importarProductos'

vi.mock('../../lib/importarProductos', async (importOriginal) => ({
  ...(await importOriginal()),
  descargarPlantilla: vi.fn(() => Promise.resolve()),
  subirPlanilla: vi.fn(),
  esperarImportacion: vi.fn(),
}))

beforeEach(() => { vi.clearAllMocks() })

describe('ImportarPlanillaDialog', () => {
  it('descarga la plantilla', async () => {
    const user = userEvent.setup()
    render(<ImportarPlanillaDialog localId="loc-1" onClose={() => {}} />)
    await user.click(screen.getByRole('button', { name: /Descargar plantilla/ }))
    expect(descargarPlantilla).toHaveBeenCalled()
  })

  it('sube el archivo del local activo y muestra nuevos, actualizados y errores con su fila', async () => {
    const user = userEvent.setup()
    const onImportado = vi.fn()
    subirPlanilla.mockResolvedValue({ id: 'job-1', status: 'pending' })
    esperarImportacion.mockResolvedValue({ id: 'job-1', status: 'completed', succeeded_rows: 2, updated_rows: 1, failed_rows: 1, errors: [{ row: 4, error: 'Precio es obligatorio' }] })
    render(<ImportarPlanillaDialog localId="loc-1" onClose={() => {}} onImportado={onImportado} />)
    const file = new File(['x'], 'productos.csv', { type: 'text/csv' })
    await user.upload(screen.getByLabelText(/Archivo/), file)
    await user.click(screen.getByRole('button', { name: /Importar$/ }))

    expect(subirPlanilla).toHaveBeenCalledWith(file, 'loc-1')
    expect(await screen.findByTestId('importados-nuevos')).toHaveTextContent('1')
    expect(screen.getByTestId('importados-actualizados')).toHaveTextContent('1')
    expect(screen.getByTestId('importados-error')).toHaveTextContent('1')
    expect(within(screen.getByRole('list', { name: 'Errores de la importación' })).getByText('Fila 4: Precio es obligatorio')).toBeInTheDocument()
    expect(onImportado).toHaveBeenCalled()
  })

  it('rechaza un archivo que no es .xlsx ni .csv sin subirlo', async () => {
    const user = userEvent.setup({ applyAccept: false })
    render(<ImportarPlanillaDialog localId="loc-1" onClose={() => {}} />)
    await user.upload(screen.getByLabelText(/Archivo/), new File(['x'], 'foto.png', { type: 'image/png' }))
    expect(screen.getByRole('alert')).toHaveTextContent(/\.xlsx o \.csv/)
    expect(screen.getByRole('button', { name: /Importar$/ })).toBeEnabled()
    await user.click(screen.getByRole('button', { name: /Importar$/ }))
    expect(subirPlanilla).not.toHaveBeenCalled()
  })
})
