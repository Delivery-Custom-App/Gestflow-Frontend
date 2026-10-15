import { useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { cambiarEstadoCajaFisica, eliminarCajaFisica } from '../../lib/administrativeApi'

const TEXTOS = {
  desactivar: {
    titulo: 'Desactivar caja física',
    cuerpo: 'Deja de ofrecerse al abrir turnos. Sus turnos, arqueos y movimientos se conservan, y puedes reactivarla cuando quieras.',
    boton: 'Desactivar',
    haciendo: 'Desactivando…',
    variante: 'danger',
  },
  reactivar: {
    titulo: 'Reactivar caja física',
    cuerpo: 'Vuelve a ofrecerse al abrir turnos.',
    boton: 'Reactivar',
    haciendo: 'Reactivando…',
    variante: 'default',
  },
  eliminar: {
    titulo: 'Eliminar caja física',
    cuerpo: 'Se borra para siempre. Solo se puede si nunca tuvo turnos y no tiene lectores POS anclados; si no, queda desactivada (archivada).',
    boton: 'Eliminar para siempre',
    haciendo: 'Eliminando…',
    variante: 'danger',
  },
}

/**
 * Confirmación para desactivar, reactivar o eliminar una caja física (T-75).
 * El backend lo hace en dos pasos: primero se desactiva (archiva) y recién
 * una desactivada, sin turnos históricos ni lectores, se puede eliminar. Si
 * el backend la rechaza, el motivo aparece aquí y la caja sigue en la lista.
 */
export default function CajaFisicaEstadoDialog({ cajaFisica, accion, onClose, onSaved }) {
  const [error, setError] = useState('')
  const [trabajando, setTrabajando] = useState(false)
  const texto = TEXTOS[accion]
  if (!texto) return null
  const nombre = cajaFisica?.name || 'Caja física sin nombre'

  const confirmar = async () => {
    setTrabajando(true)
    setError('')
    try {
      if (accion === 'eliminar') await eliminarCajaFisica(cajaFisica.id)
      else await cambiarEstadoCajaFisica(cajaFisica.id, accion === 'reactivar')
      onSaved()
      onClose()
    } catch (e) {
      setError(String(e?.detail || e?.message || 'No se pudo completar la acción').replace(/^\d{3}:\s*/, ''))
      setTrabajando(false)
    }
  }

  return (
    <Dialog open onOpenChange={(abierto) => { if (!abierto && !trabajando) onClose() }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{texto.titulo}</DialogTitle>
          <DialogDescription>
            <strong className="text-[hsl(var(--foreground))]">{nombre}</strong>. {texto.cuerpo}
          </DialogDescription>
        </DialogHeader>
        {error && (
          <p role="alert" className="mx-6 mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600 dark:border-red-800/50 dark:bg-red-950/30 dark:text-red-400">
            {error}
          </p>
        )}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={trabajando}>
            {error ? 'Cerrar' : 'Cancelar'}
          </Button>
          <Button type="button" variant={texto.variante} onClick={confirmar} disabled={trabajando}>
            {trabajando ? texto.haciendo : texto.boton}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
