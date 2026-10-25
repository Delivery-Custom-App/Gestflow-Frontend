import { useParams } from 'react-router'
import { useSelectedLocal } from '../../hooks/useSelectedLocal'
import { useInventarioDelLocal } from '../../hooks/useInventarioDelLocal'
import InventoryShell from './InventoryShell'
import ProductosInventario from './unificado/ProductosInventario'

/** Control de stock: la tabla de Productos del inventario unificado (#176). */
function StockControlDashboard() {
  const { localId } = useParams()
  const selectedLocal = useSelectedLocal(localId)
  const inventario = useInventarioDelLocal(localId)
  return (
    <InventoryShell>
      <div className="flex flex-col gap-4 px-6 py-6 pb-10">
        <header>
          <h1 className="text-xl font-bold text-[hsl(var(--foreground))]">Control de stock</h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">Precio, costo, stock y «En venta» de cada producto con stock</p>
        </header>
        <ProductosInventario localId={localId} salesModel={selectedLocal?.sales_model} {...inventario} />
      </div>
    </InventoryShell>
  )
}

export default StockControlDashboard
