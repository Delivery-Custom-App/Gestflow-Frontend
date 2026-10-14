import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

/**
 * Confirmación para dar de baja una mesa (`DELETE /mesas/{id}`). Es una baja
 * lógica: la mesa deja el plano, sus pedidos anteriores se conservan y se
 * puede reactivar. La ven el encargado y el dueño (el empleado no). Si el
 * backend la rechaza (409: en uso o dentro de un grupo) el motivo aparece aquí
 * y la mesa sigue.
 */
export default function DeleteMesaModal({ mesa, onClose, onConfirm, isDeleting = false, error = null }) {
  const [showError] = useState(error)

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span aria-hidden="true">⚠️</span> Eliminar Mesa
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <p className="text-sm text-[hsl(var(--foreground))]">
            ¿Estás seguro que deseas eliminar la mesa <strong>{mesa.name}</strong>?
          </p>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            La mesa deja de aparecer en el plano. <strong>Sus pedidos anteriores se conservan</strong> y
            se puede reactivar más adelante.
          </p>

          {/* Info de la mesa */}
          <div className="rounded-lg border border-[hsl(var(--border))] divide-y divide-[hsl(var(--border))]">
            <div className="flex justify-between items-center px-3 py-2">
              <span className="text-xs text-[hsl(var(--muted-foreground))]">Nombre</span>
              <span className="text-xs font-medium">{mesa.name}</span>
            </div>
            <div className="flex justify-between items-center px-3 py-2">
              <span className="text-xs text-[hsl(var(--muted-foreground))]">Zona</span>
              <span className="text-xs font-medium">{mesa.zona || 'General'}</span>
            </div>
            <div className="flex justify-between items-center px-3 py-2">
              <span className="text-xs text-[hsl(var(--muted-foreground))]">Capacidad</span>
              <span className="text-xs font-medium">{mesa.capacidad} personas</span>
            </div>
          </div>

          {/* Error backend */}
          {(showError || error) && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-[hsl(var(--destructive))]">
              <strong>⚠️ No se puede eliminar:</strong>
              <p className="mt-0.5">{showError || error}</p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isDeleting}
          >
            {showError || error ? 'Cerrar' : 'Cancelar'}
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={() => onConfirm(mesa.id)}
            disabled={isDeleting || !!(showError || error)}
          >
            {isDeleting ? 'Eliminando...' : 'Eliminar Mesa'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
