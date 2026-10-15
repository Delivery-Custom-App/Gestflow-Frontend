import { useState } from 'react'
import { Download, Upload } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogBody, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  descargarPlantilla, esperarImportacion, resumenImportacion, subirPlanilla, validarPlanilla,
} from '../../lib/importarProductos'

const textoError = (e, porDefecto) => String(e?.detail || e?.message || porDefecto).replace(/^\d{3}:\s*/, '')

/**
 * Importar productos desde una planilla (T-60): descargar la plantilla, subir
 * un .xlsx o .csv (hasta 5 MB) para el local activo y ver el resultado: filas
 * nuevas, actualizadas y con error, con su número de fila.
 */
export default function ImportarPlanillaDialog({ localId, onClose, onImportado }) {
  const [archivo, setArchivo] = useState(null)
  const [error, setError] = useState('')
  const [fase, setFase] = useState('elegir') // elegir | subiendo | listo
  const [resumen, setResumen] = useState(null)

  const elegir = (e) => {
    const file = e.target.files?.[0] || null
    setArchivo(file)
    setError(file ? validarPlanilla(file) || '' : '')
  }

  const plantilla = async () => {
    setError('')
    try { await descargarPlantilla() } catch (e) { setError(textoError(e, 'No se pudo descargar la plantilla')) }
  }

  const importar = async (e) => {
    e.preventDefault()
    const problema = validarPlanilla(archivo)
    if (problema) { setError(problema); return }
    setFase('subiendo')
    setError('')
    try {
      const trabajo = await esperarImportacion(await subirPlanilla(archivo, localId))
      setResumen(resumenImportacion(trabajo))
      setFase('listo')
      if (trabajo?.status === 'completed') onImportado?.()
    } catch (err) {
      setError(textoError(err, 'No se pudo importar la planilla'))
      setFase('elegir')
    }
  }

  return (
    <Dialog open onOpenChange={(abierto) => { if (!abierto && fase !== 'subiendo') onClose() }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Importar productos desde planilla</DialogTitle>
          <DialogDescription>
            Los productos quedan en el menú de este local y, si la planilla trae Stock, también su stock. Si un producto ya existe (por Código o, sin código, por Nombre) se actualiza.
          </DialogDescription>
        </DialogHeader>
        <DialogBody>

        {fase !== 'listo' ? (
          <form onSubmit={importar} className="flex flex-col gap-4">
            <Button type="button" variant="outline" className="self-start" onClick={plantilla} disabled={fase === 'subiendo'}>
              <Download size={14} /> Descargar plantilla
            </Button>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="planilla-archivo">Archivo (.xlsx o .csv separado por «;», hasta 5 MB)</Label>
              <input id="planilla-archivo" type="file" accept=".xlsx,.csv" onChange={elegir} disabled={fase === 'subiendo'} className="text-sm" />
            </div>
            {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={onClose} disabled={fase === 'subiendo'}>Cancelar</Button>
              <Button type="submit" disabled={fase === 'subiendo' || !archivo}>
                <Upload size={14} /> {fase === 'subiendo' ? 'Importando…' : 'Importar'}
              </Button>
            </div>
          </form>
        ) : (
          <div role="status" className="flex flex-col gap-3">
            <p className="text-sm font-semibold text-[hsl(var(--foreground))]">
              {resumen.estado === 'failed' ? 'La importación falló.' : 'Importación terminada.'}
            </p>
            <ul className="grid grid-cols-3 gap-2 text-center text-sm">
              <li className="rounded-lg border border-[hsl(var(--border))] p-2"><strong data-testid="importados-nuevos">{resumen.creadas}</strong><br />nuevos</li>
              <li className="rounded-lg border border-[hsl(var(--border))] p-2"><strong data-testid="importados-actualizados">{resumen.actualizadas}</strong><br />actualizados</li>
              <li className="rounded-lg border border-[hsl(var(--border))] p-2"><strong data-testid="importados-error">{resumen.conError}</strong><br />con error</li>
            </ul>
            {resumen.errores.length > 0 && (
              <ul aria-label="Errores de la importación" className="max-h-48 overflow-y-auto rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-700">
                {resumen.errores.map((e, i) => <li key={`${e.fila}-${i}`}>{e.texto}</li>)}
              </ul>
            )}
            <div className="flex justify-end">
              <Button type="button" onClick={onClose}>Listo</Button>
            </div>
          </div>
        )}
      </DialogBody>
      </DialogContent>
    </Dialog>
  )
}
