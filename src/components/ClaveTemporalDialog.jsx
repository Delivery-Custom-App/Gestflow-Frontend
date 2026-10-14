import { useState } from 'react'
import { Copy, Check } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

/**
 * Clave temporal después de restablecerla (T-61). El backend la devuelve una
 * sola vez (`temporary_password`, con `Cache-Control: no-store`): vive solo en
 * el estado de este diálogo, no se guarda en localStorage ni se registra, y
 * desaparece al cerrarlo.
 */
export default function ClaveTemporalDialog({ nombre, clave, correoEnviado, onClose }) {
  const [copiada, setCopiada] = useState(false)
  const [errorCopia, setErrorCopia] = useState('')

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(clave)
      setCopiada(true)
      setErrorCopia('')
    } catch {
      setErrorCopia('No se pudo copiar: selecciónala y cópiala a mano.')
    }
  }

  return (
    <Dialog open onOpenChange={(abierto) => { if (!abierto) onClose() }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Clave temporal de {nombre}</DialogTitle>
          <DialogDescription>Se muestra una sola vez. Al cerrar esta ventana ya no se puede volver a ver.</DialogDescription>
        </DialogHeader>
        <div className="flex items-center gap-2">
          <code data-testid="clave-temporal" className="flex-1 select-all rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))] px-3 py-2 font-mono text-lg tracking-wider text-[hsl(var(--foreground))]">
            {clave}
          </code>
          <Button type="button" variant="outline" onClick={copiar} aria-label="Copiar la clave temporal">
            {copiada ? <Check size={15} /> : <Copy size={15} />} {copiada ? 'Copiada' : 'Copiar'}
          </Button>
        </div>
        {errorCopia && <p className="text-xs text-red-600">{errorCopia}</p>}
        {correoEnviado ? (
          <p className="text-sm text-[hsl(var(--muted-foreground))]">También se envió por correo.</p>
        ) : (
          <p role="alert" className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-800/50 dark:bg-amber-950/30 dark:text-amber-300">
            No se pudo enviar por correo: entrégala en mano.
          </p>
        )}
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          Se cerraron sus sesiones abiertas y deberá cambiar esta clave al entrar.
        </p>
        <div className="flex justify-end">
          <Button type="button" onClick={onClose}>Listo</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
