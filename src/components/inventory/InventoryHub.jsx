import { useParams } from 'react-router'
import { useInventarioDelLocal } from '../../hooks/useInventarioDelLocal'
import InventoryShell from './InventoryShell'
import ResumenInventario from './unificado/ResumenInventario'

/** Estado Inventario: el Resumen del inventario unificado (#175). */
function InventoryHub() {
  const { localId } = useParams()
  const inventario = useInventarioDelLocal(localId)
  return (
    <InventoryShell>
      <div className="flex flex-col gap-4 px-6 py-6 pb-10">
        <header>
          <h1 className="text-xl font-bold text-[hsl(var(--foreground))]">Inventario</h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">Cómo está el stock y qué hay que reponer</p>
        </header>
        <ResumenInventario localId={localId} filas={inventario.filas} loading={inventario.loading} recargar={inventario.recargar} />
      </div>
    </InventoryShell>
  )
}

export default InventoryHub
