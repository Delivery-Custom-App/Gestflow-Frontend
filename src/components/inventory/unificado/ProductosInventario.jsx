import { useCallback, useMemo, useState } from 'react'
import { FileSpreadsheet, PackagePlus, Plus, Search, Tags } from 'lucide-react'
import {
  cambiarEnVentaEnLocal,
  cambiarSiSePrepara,
  corregirConteo,
  deleteInventoryItem,
  empezarAControlarStock,
  patchInventoryProductUnitCost,
  patchInventoryStock,
  patchProduct,
  registrarMerma,
  removeFromLocalMenu,
  sumarUnidades,
} from '../../../lib/inventoryApi'
import { ESTADOS_STOCK, contarPorEstado, filtrarFilas } from '../../../lib/inventarioUnificado'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import ProductsTable from '../ProductsTable'
import CategoryFilterSelect from '../CategoryFilterSelect'
import RegistrarStockModal from '../RegistrarStockModal'
import HistorialStockModal from '../HistorialStockModal'
import NuevoProductoModal from '../NuevoProductoModal'
import CategoriasDialog from '../CategoriasDialog'
import ImportarCatalogoDrawer from '../ImportarCatalogoDrawer'
import ImportarPlanillaDialog from '../ImportarPlanillaDialog'

const POR_PAGINA = 10

/**
 * Inventario · Productos (#176): los productos que se venden con stock, en
 * una tabla con precio, costo, stock, estado y «En venta» (solo este local),
 * y sus acciones. Reúne Control de stock y lo del Menú para estos productos.
 */
export default function ProductosInventario({ localId, salesModel, filas = [], setFilas, categorias = [], loading, error, recargar }) {
  const [estado, setEstado] = useState('TODOS')
  const [busqueda, setBusqueda] = useState('')
  const [categoria, setCategoria] = useState('')
  const [pagina, setPagina] = useState(1)
  const [actionError, setActionError] = useState('')
  const [togglingId, setTogglingId] = useState('')
  const [registrando, setRegistrando] = useState(null) // { row, modo }
  const [historialDe, setHistorialDe] = useState(null)
  const [nuevoAbierto, setNuevoAbierto] = useState(false)
  const [categoriasAbierto, setCategoriasAbierto] = useState(false)
  const [catalogoAbierto, setCatalogoAbierto] = useState(false)
  const [planillaAbierta, setPlanillaAbierta] = useState(false)

  const cuenta = useMemo(() => contarPorEstado(filas), [filas])
  const filtradas = useMemo(() => filtrarFilas(filas, { estado, busqueda, categoria }), [filas, estado, busqueda, categoria])
  const totalPaginas = Math.max(1, Math.ceil(filtradas.length / POR_PAGINA))
  const paginaSegura = Math.min(pagina, totalPaginas)
  const visibles = filtradas.slice((paginaSegura - 1) * POR_PAGINA, paginaSegura * POR_PAGINA)

  const conRecarga = useCallback((accion, porDefecto) => async (...args) => {
    setActionError('')
    try {
      await accion(...args)
      await recargar()
    } catch (e) {
      setActionError(e?.message || porDefecto)
      throw e
    }
  }, [recargar])

  const handlePatchStock = conRecarga((row, body) => patchInventoryStock(localId, row.inventory_id, body), 'No se pudo actualizar el stock.')
  const handlePatchUnitCost = conRecarga((row, costo) => patchInventoryProductUnitCost(localId, row.product_id, { unitCost: costo }), 'No se pudo actualizar el costo.')
  const handlePatchPrice = conRecarga((row, price) => patchProduct(row.product_id, { price }), 'No se pudo actualizar el precio.')
  const handlePatchName = conRecarga((row, name) => patchProduct(row.product_id, { name: name.trim() }), 'No se pudo actualizar el nombre.')
  const handlePatchCategory = conRecarga((row, categoryId) => patchProduct(row.product_id, { category_id: categoryId }), 'No se pudo actualizar la categoría.')
  const handleDelete = conRecarga((row) => deleteInventoryItem(localId, row.inventory_id), 'No se pudo eliminar del stock del local.')
  const handlePasarAPlato = conRecarga((row) => cambiarSiSePrepara(localId, row.product_id, { prepara: true }), 'No se pudo pasar a Platos preparados.')
  const handleQuitarDelMenu = conRecarga((row) => removeFromLocalMenu(row.local_product_id), 'No se pudo quitar del menú.')

  // «En venta» cambia solo este local; se ve al instante y se deshace si falla.
  const handleToggleEnVenta = async (row) => {
    const siguiente = row.en_venta === false
    const id = String(row.local_product_id)
    const marcar = (valor) => setFilas?.((prev) => prev.map((f) => (String(f.local_product_id) === id ? { ...f, en_venta: valor } : f)))
    setTogglingId(id)
    setActionError('')
    marcar(siguiente)
    try {
      await cambiarEnVentaEnLocal(row.local_product_id, siguiente)
    } catch (e) {
      marcar(!siguiente)
      setActionError(e?.message || 'No se pudo cambiar «En venta».')
    } finally {
      setTogglingId('')
    }
  }

  const guardarRegistro = async (datos) => {
    const { row, modo } = registrando
    if (modo === 'sumar') await sumarUnidades(row.inventory_id, datos.cantidad, datos.motivo)
    else if (modo === 'corregir') await corregirConteo(row.inventory_id, datos.cantidad, datos.motivo)
    else if (modo === 'merma') await registrarMerma(row.inventory_id, datos.cantidad, datos.motivo)
    else await empezarAControlarStock(localId, row.product_id, datos)
    setRegistrando(null)
    await recargar()
  }

  const cambiarFiltro = (setter) => (valor) => { setter(valor); setPagina(1) }

  return (
    <section aria-labelledby="inventario-productos" className="flex flex-col gap-4">
      <h2 id="inventario-productos" className="sr-only">Productos</h2>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="group" aria-label="Filtrar por estado de stock" className="flex flex-wrap gap-2">
          {ESTADOS_STOCK.map((e) => (
            <button key={e.id} type="button" aria-pressed={estado === e.id} onClick={() => cambiarFiltro(setEstado)(e.id)}
              className={cn('inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-sm transition-colors',
                estado === e.id
                  ? 'border-[hsl(var(--foreground))] bg-[hsl(var(--foreground))] font-bold text-[hsl(var(--background))]'
                  : 'border-[hsl(var(--border))] bg-[hsl(var(--card))] font-medium text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]')}>
              {e.label}
              <span className="rounded-full bg-[hsl(var(--primary)/0.15)] px-1.5 text-[11px] font-bold tabular-nums">{cuenta[e.id]}</span>
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => setCategoriasAbierto(true)}>
            <Tags size={14} className="mr-1" /> Categorías
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => setCatalogoAbierto(true)}>
            <PackagePlus size={14} className="mr-1" /> Importar del catálogo
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => setPlanillaAbierta(true)}>
            <FileSpreadsheet size={14} className="mr-1" /> Importar desde planilla
          </Button>
          <Button type="button" size="sm" onClick={() => setNuevoAbierto(true)}>
            <Plus size={14} className="mr-1" /> Nuevo producto
          </Button>
        </div>
      </div>

      <search className="flex flex-wrap items-center gap-3" aria-label="Buscar productos">
        <div className="relative min-w-[200px] flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" aria-hidden="true">
            <Search size={16} />
          </span>
          <input type="search" placeholder="Buscar por nombre de producto…" value={busqueda}
            onChange={(e) => cambiarFiltro(setBusqueda)(e.target.value)} aria-label="Buscar productos por nombre" autoComplete="off"
            className="h-9 w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--card))] pl-9 pr-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary)/0.3)]" />
        </div>
        <CategoryFilterSelect value={categoria} onChange={cambiarFiltro(setCategoria)} options={categorias} />
      </search>

      {actionError && (
        <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{actionError}</p>
      )}

      <ProductsTable
        items={visibles}
        loading={loading && filas.length === 0}
        error={error}
        currentPage={paginaSegura}
        totalPages={totalPaginas}
        totalCount={filtradas.length}
        pageSize={POR_PAGINA}
        onPageChange={setPagina}
        onEmptyAction={() => setNuevoAbierto(true)}
        onPatchStock={handlePatchStock}
        onPatchUnitCost={handlePatchUnitCost}
        onPatchPrice={handlePatchPrice}
        onPatchProductName={handlePatchName}
        onPatchCategory={handlePatchCategory}
        onDeleteItem={handleDelete}
        onRegistrar={(row, modo) => (modo === 'historial' ? setHistorialDe(row) : setRegistrando({ row, modo }))}
        onToggleEnVenta={handleToggleEnVenta}
        onPasarAPlato={handlePasarAPlato}
        onQuitarDelMenu={handleQuitarDelMenu}
        togglingId={togglingId}
        statusFilters={estado === 'TODOS' ? [] : [estado]}
        categoriesCatalog={categorias}
      />

      {historialDe && (
        <HistorialStockModal row={historialDe} onClose={() => setHistorialDe(null)}
          onCorregirConteo={(row) => { setHistorialDe(null); setRegistrando({ row, modo: 'corregir' }) }} />
      )}
      {registrando && (
        <RegistrarStockModal modo={registrando.modo} row={registrando.row} onGuardar={guardarRegistro} onClose={() => setRegistrando(null)} />
      )}
      {categoriasAbierto && (
        <CategoriasDialog localId={localId} categorias={categorias} onClose={() => setCategoriasAbierto(false)} onCambio={recargar} />
      )}
      {catalogoAbierto && (
        <ImportarCatalogoDrawer localId={localId} salesModel={salesModel} yaEnElMenu={filas.map((f) => f.product_name)}
          onClose={() => setCatalogoAbierto(false)} onImportado={recargar} />
      )}
      {planillaAbierta && (
        <ImportarPlanillaDialog localId={localId} onClose={() => setPlanillaAbierta(false)} onImportado={recargar} />
      )}
      <NuevoProductoModal open={nuevoAbierto} localId={localId} onClose={() => setNuevoAbierto(false)}
        onSuccess={() => { setPagina(1); recargar() }} />
    </section>
  )
}
