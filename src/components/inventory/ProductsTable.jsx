import { useState, useMemo, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Pencil, ChevronRight, ChevronDown } from 'lucide-react'
import StockStatusBadge from './StockStatusBadge'
import { stockLevelFromRow } from './stockAlertUtils'

const ROW_CLASS =
  'border-b border-[hsl(var(--border))] transition-colors hover:bg-[hsl(var(--muted)/0.5)] data-[state=selected]:bg-[hsl(var(--accent))]'
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCLPOrDash as formatClp } from '../../lib/formatCLP'

const STATUS_LABEL = { OPTIMO: 'óptimo', BAJO: 'bajo', CRITICO: 'crítico' }

function ProductsTable({
  items,
  loading,
  error,
  currentPage,
  pageSize = 10,
  onPageChange,
  onEmptyAction,
  onPatchStock,
  onPatchUnitCost,
  onPatchProductName,
  onDeleteItem,
  statusFilters = [],
}) {
  const [editingRow, setEditingRow] = useState(null)
  const [nameDraft, setNameDraft] = useState('')
  const [maxStockDraft, setMaxStockDraft] = useState('')
  const [minStockDraft, setMinStockDraft] = useState('')
  const [costDraft, setCostDraft] = useState('')
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [expandedGroups, setExpandedGroups] = useState(new Set())

  // Group items by product name + category; groups with 1 row render as-is, >1 render as expandable
  const groupedItems = useMemo(() => {
    const map = new Map()
    for (const row of items) {
      const raw = (row.product_name || row.name || '').trim()
      const display = raw ? raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase() : ''
      const key = `${raw.toLowerCase()}|${(row.category_name || '').toLowerCase()}`
      if (!map.has(key)) map.set(key, { key, display, rows: [] })
      map.get(key).rows.push(row)
    }
    return Array.from(map.values())
  }, [items])

  useEffect(() => { setExpandedGroups(new Set()) }, [items])

  // Paginar grupos (no items crudos) para que el agrupamiento funcione entre páginas
  const groupedTotalPages = Math.max(1, Math.ceil(groupedItems.length / pageSize))
  const safePage = Math.min(Math.max(1, currentPage), groupedTotalPages)
  const pagedGroups = groupedItems.slice((safePage - 1) * pageSize, safePage * pageSize)

  const toggleGroup = (key) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const showPagination = !error && !loading && groupedTotalPages > 1
  const showCount = !error && !loading && groupedItems.length > 0

  const closeEditModal = () => {
    setEditingRow(null)
    setNameDraft('')
    setMaxStockDraft('')
    setMinStockDraft('')
    setCostDraft('')
    setFormError('')
    setConfirmDelete(false)
  }

  const openEditModal = (row) => {
    setEditingRow(row)
    setNameDraft(row.product_name || row.name || '')
    setMaxStockDraft(row.stock_max != null ? String(row.stock_max) : '')
    setMinStockDraft(String(row.stock_min ?? 0))
    setCostDraft(String(Math.round(Number(row.unit_cost_clp ?? 0))))
    setFormError('')
  }

  const submitRowUpdate = async () => {
    if (!editingRow) return

    const newName      = nameDraft.trim()
    const maxStockValue = maxStockDraft.trim() === '' ? null : Number(maxStockDraft)
    const minStockValue = Number(minStockDraft)
    const unitCostValue = Number(costDraft)

    if (!newName) { setFormError('El nombre no puede estar vacío.'); return }
    if (maxStockValue !== null && (!Number.isFinite(maxStockValue) || maxStockValue < 0)) {
      setFormError('El stock máximo debe ser un número válido mayor o igual a 0.'); return
    }
    if (!Number.isFinite(minStockValue) || minStockValue < 0) {
      setFormError('El stock mínimo debe ser un número válido mayor o igual a 0.'); return
    }
    if (!Number.isFinite(unitCostValue) || unitCostValue <= 0) {
      setFormError('El costo unitario debe ser un número válido mayor a 0.'); return
    }

    const nextMaxStock   = maxStockValue !== null ? Math.floor(maxStockValue) : null
    const nextMinStock   = Math.floor(minStockValue)
    const nextUnitCost   = Math.round(unitCostValue)
    const currentName    = (editingRow.product_name || editingRow.name || '').trim()
    const currentMaxStock = editingRow.stock_max != null ? Number(editingRow.stock_max) : null
    const currentMinStock = Number(editingRow.stock_min ?? 0)
    const currentUnitCost = Math.round(Number(editingRow.unit_cost_clp ?? 0))

    setSaving(true)
    setFormError('')
    try {
      if (onPatchProductName && newName !== currentName) {
        await onPatchProductName(editingRow, newName)
      }

      const stockPatchBody = {}
      if (nextMaxStock !== null && nextMaxStock !== currentMaxStock) stockPatchBody.max_stock = nextMaxStock
      if (nextMinStock !== currentMinStock) stockPatchBody.min_stock = nextMinStock
      if (onPatchStock && Object.keys(stockPatchBody).length > 0) {
        await onPatchStock(editingRow, stockPatchBody)
      }

      if (onPatchUnitCost && nextUnitCost !== currentUnitCost) {
        await onPatchUnitCost(editingRow, nextUnitCost)
      }

      closeEditModal()
    } catch (e) {
      setFormError(e?.message || 'No se pudieron guardar los cambios.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {showCount ? (
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          {(() => {
            const from = pagedGroups.length === 0 ? 0 : (safePage - 1) * pageSize + 1
            const to = (safePage - 1) * pageSize + pagedGroups.length
            return `Mostrando ${from}–${to} de ${groupedItems.length} productos`
          })()}
        </p>
      ) : null}

      <div className="rounded-md border border-[hsl(var(--border))] w-full">
        <Table className="w-full table-fixed text-xs">
          <TableHeader>
            <TableRow className="bg-[hsl(var(--muted)/0.4)]">
              <TableHead className="w-[18%] font-semibold">Producto</TableHead>
              <TableHead className="w-[12%] font-semibold">Categoría</TableHead>
              <TableHead className="w-[10%] font-semibold text-right text-emerald-700">Actual</TableHead>
              <TableHead className="w-[8%] font-semibold text-right text-amber-600">Mín.</TableHead>
              <TableHead className="w-[8%] font-semibold text-right text-sky-600">Máx.</TableHead>
              <TableHead className="w-[12%] font-semibold text-right">Costo (CLP)</TableHead>
              <TableHead className="w-[13%] font-semibold text-right">Val. total</TableHead>
              <TableHead className="w-[10%] font-semibold">Estado</TableHead>
              <TableHead className="w-[9%] font-semibold">Gestionar</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {error ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-[hsl(var(--destructive))] py-8">
                  {error}
                </TableCell>
              </TableRow>
            ) : null}
            {!error && loading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={`skel-${i}`}>
                    {Array.from({ length: 9 }).map((_, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-4 w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              : null}
            {!error && !loading && items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="py-12">
                  {statusFilters.length > 0 ? (
                    <div className="flex flex-col items-center gap-1 text-center">
                      <p className="font-semibold text-[hsl(var(--foreground))]">
                        Usted no cuenta con productos con estado{' '}
                        {statusFilters.map((s) => STATUS_LABEL[s] ?? s.toLowerCase()).join(' o ')}.
                      </p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2 text-center">
                      <p className="font-semibold text-[hsl(var(--foreground))]">
                        No hay productos registrados en este local.
                      </p>
                      <p className="text-sm text-[hsl(var(--muted-foreground))]">
                        Crea el primer producto para comenzar a gestionar inventario.
                      </p>
                      {onEmptyAction ? (
                        <Button type="button" className="mt-2" onClick={onEmptyAction}>
                          Crear primer producto
                        </Button>
                      ) : null}
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ) : null}
            <AnimatePresence initial={false}>
            {!error && !loading
              ? pagedGroups.flatMap(({ key, display, rows }, gIdx) => {
                  const isMulti = rows.length > 1
                  const isExpanded = expandedGroups.has(key)

                  const renderDataRow = (row, index, isSubRow = false) => {
                    const stockCurrent = Number(row.stock_current ?? 0)
                    const unitCost = Number(row.unit_cost_clp ?? 0)
                    const total =
                      row.total_value != null && row.total_value !== ''
                        ? Number(row.total_value)
                        : stockCurrent * unitCost
                    const stockMin = row.stock_min == null ? '—' : String(row.stock_min)
                    const stockMax = row.stock_max == null ? '—' : String(row.stock_max)
                    const level = stockLevelFromRow(row)
                    const actualCls = level === 'critical' ? 'text-red-600 font-bold' : level === 'low' ? 'text-amber-600 font-semibold' : 'text-emerald-600 font-semibold'
                    return (
                      <motion.tr
                        key={row.inventory_id ?? row.product_id}
                        className={`${ROW_CLASS} ${isSubRow ? 'bg-[hsl(var(--muted)/0.15)]' : ''}`}
                        initial={{ opacity: 0, y: isSubRow ? -4 : 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, x: -10 }}
                        transition={{ delay: index * 0.03, duration: 0.2, ease: 'easeOut' }}
                      >
                        <TableCell>
                          {isSubRow ? (
                            <div className="pl-4 flex items-center gap-1 truncate">
                              <span className="text-[hsl(var(--muted-foreground))] select-none shrink-0">└</span>
                              <div className="flex flex-col min-w-0">
                                <span className="font-medium truncate">{display}</span>
                                {row.supplier_name ? (
                                  <span className="text-[10px] text-[hsl(var(--muted-foreground))] truncate">
                                    {row.supplier_name} · stock: {row.stock_current ?? 0}
                                  </span>
                                ) : (
                                  <span className="text-[10px] text-amber-600 font-semibold truncate">
                                    Emergencia · stock: {row.stock_current ?? 0}
                                  </span>
                                )}
                              </div>
                            </div>
                          ) : (
                            <div className="font-bold truncate">{display || '—'}</div>
                          )}
                        </TableCell>
                        <TableCell className="truncate">{row.category_name || '—'}</TableCell>
                        <TableCell className={`text-right tabular-nums ${actualCls}`}>{stockCurrent}</TableCell>
                        <TableCell className="text-right tabular-nums text-amber-600 font-medium">{stockMin}</TableCell>
                        <TableCell className="text-right tabular-nums text-sky-600 font-medium">{stockMax}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatClp(unitCost)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatClp(total)}</TableCell>
                        <TableCell>
                          <StockStatusBadge row={row} />
                        </TableCell>
                        <TableCell>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditModal(row)}
                            className="h-7 px-2 text-xs gap-1 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--primary))]"
                          >
                            <Pencil size={12} />
                            Editar
                          </Button>
                        </TableCell>
                      </motion.tr>
                    )
                  }

                  if (!isMulti) {
                    return [renderDataRow(rows[0], gIdx)]
                  }

                  // Multi-supplier group: aggregate header + expandable sub-rows
                  const totalStock = rows.reduce((s, r) => s + Number(r.stock_current ?? 0), 0)
                  const totalValue = rows.reduce((s, r) => {
                    const sc = Number(r.stock_current ?? 0)
                    const uc = Number(r.unit_cost_clp ?? 0)
                    return s + (r.total_value != null && r.total_value !== '' ? Number(r.total_value) : sc * uc)
                  }, 0)

                  const headerRow = (
                    <motion.tr
                      key={`grp-${key}`}
                      className={`${ROW_CLASS} cursor-pointer select-none`}
                      onClick={() => toggleGroup(key)}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      transition={{ delay: gIdx * 0.04, duration: 0.22, ease: 'easeOut' }}
                    >
                      <TableCell>
                        <div className="flex items-center gap-2 font-bold">
                          {isExpanded
                            ? <ChevronDown size={14} className="shrink-0 text-[hsl(var(--muted-foreground))]" />
                            : <ChevronRight size={14} className="shrink-0 text-[hsl(var(--muted-foreground))]" />
                          }
                          {display || '—'}
                          <span className="text-[10px] font-semibold bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] rounded px-1.5 py-0.5 ml-0.5">
                            {rows.length} fuentes
                          </span>
                          {rows.some((r) => !r.supplier_name) && (
                            <span className="text-[10px] font-semibold bg-amber-100 text-amber-700 rounded px-1.5 py-0.5">
                              inc. emergencia
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="truncate">{rows[0].category_name || '—'}</TableCell>
                      <TableCell className="text-right tabular-nums">{totalStock}</TableCell>
                      <TableCell className="text-right text-[hsl(var(--muted-foreground))]">—</TableCell>
                      <TableCell className="text-right text-[hsl(var(--muted-foreground))]">—</TableCell>
                      <TableCell className="text-right text-[hsl(var(--muted-foreground))]">—</TableCell>
                      <TableCell className="text-right tabular-nums">{formatClp(totalValue)}</TableCell>
                      <TableCell className="text-[hsl(var(--muted-foreground))]">—</TableCell>
                      <TableCell />
                    </motion.tr>
                  )

                  const subRows = isExpanded
                    ? rows.map((row, i) => renderDataRow(row, i, true))
                    : []

                  return [headerRow, ...subRows]
                })
              : null}
            </AnimatePresence>
          </TableBody>
        </Table>
      </div>

      {/* Edit drawer */}
      <div
        className={`fixed inset-0 bg-black/60 transition-opacity duration-300 ${
          editingRow ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        style={{ zIndex: 500 }}
        onClick={() => { if (!saving && !deleting) closeEditModal() }}
      />
      <div
        className={`fixed inset-y-0 right-0 w-full max-w-md bg-[hsl(var(--card))] shadow-2xl border-l border-[hsl(var(--border))] flex flex-col transform transition-transform duration-300 ease-in-out ${
          editingRow ? 'translate-x-0' : 'translate-x-full'
        }`}
        style={{ zIndex: 501 }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-[hsl(var(--border))] shrink-0">
          <div>
            <h2 className="text-base font-bold text-[hsl(var(--foreground))]">Editar producto</h2>
            {editingRow && (
              <p className="text-sm text-[hsl(var(--muted-foreground))] mt-0.5 font-medium">
                {editingRow.product_name || editingRow.name || 'Producto'}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={closeEditModal}
            disabled={saving || deleting}
            className="rounded-lg p-2 hover:bg-[hsl(var(--muted))] transition-colors disabled:opacity-50"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[hsl(var(--muted-foreground))]"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-6 flex flex-col gap-5">
          {formError && (
            <p className="rounded-md bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-2.5" role="alert">
              {formError}
            </p>
          )}

          <div className="flex flex-col gap-2">
            <Label htmlFor="edit-name" className="text-sm font-semibold">Nombre</Label>
            <Input
              id="edit-name"
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              placeholder="Nombre del producto"
              disabled={saving}
              className="h-10"
            />
          </div>

          {editingRow?.supplier_name && (
            <div className="flex flex-col gap-1.5">
              <Label className="text-sm font-semibold">Proveedor</Label>
              <div className="flex items-center justify-between rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.4)] px-3 py-2 text-sm">
                <span className="font-medium truncate">{editingRow.supplier_name}</span>
                <span className="text-xs text-[hsl(var(--muted-foreground))] shrink-0 ml-2">
                  Stock actual: <span className="font-semibold text-[hsl(var(--foreground))]">{editingRow.stock_current ?? 0}</span>
                </span>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="edit-min-stock" className="text-sm font-semibold">Stock Mínimo</Label>
              <Input
                id="edit-min-stock"
                type="number"
                min={0}
                value={minStockDraft}
                onChange={(e) => setMinStockDraft(e.target.value)}
                disabled={saving}
                className="h-10"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="edit-max-stock" className="text-sm font-semibold">Stock Máximo</Label>
              <Input
                id="edit-max-stock"
                type="number"
                min={0}
                placeholder="Sin límite"
                value={maxStockDraft}
                onChange={(e) => setMaxStockDraft(e.target.value)}
                disabled={saving}
                className="h-10"
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="edit-cost" className="text-sm font-semibold">Costo Unitario (CLP)</Label>
            <Input
              id="edit-cost"
              type="number"
              min={1}
              step={1}
              value={costDraft}
              onChange={(e) => setCostDraft(e.target.value)}
              disabled={saving}
              className="h-10"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-[hsl(var(--border))] px-6 py-4 flex flex-col gap-3">
          {confirmDelete && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 flex items-center justify-between gap-3">
              <span className="text-sm text-red-700 font-medium">¿Eliminar este producto?</span>
              <div className="flex gap-2">
                <Button type="button" variant="destructive" size="sm" disabled={deleting}
                  onClick={async () => {
                    if (!editingRow || !onDeleteItem) return
                    setDeleting(true)
                    try { await onDeleteItem(editingRow); closeEditModal() }
                    catch (e) { setFormError(e?.message || 'No se pudo eliminar.'); setConfirmDelete(false) }
                    finally { setDeleting(false) }
                  }}>
                  {deleting ? 'Eliminando...' : 'Confirmar'}
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => setConfirmDelete(false)} disabled={deleting}>
                  No
                </Button>
              </div>
            </div>
          )}
          <div className="flex items-center justify-between gap-3">
            <Button type="button" variant="outline" onClick={closeEditModal} disabled={saving || deleting}>
              Cancelar
            </Button>
            <div className="flex gap-2">
              {!confirmDelete && (
                <Button type="button" variant="destructive" disabled={saving || deleting}
                  onClick={() => setConfirmDelete(true)}>
                  Eliminar
                </Button>
              )}
              <Button type="button" onClick={submitRowUpdate} disabled={saving || deleting || confirmDelete}>
                {saving ? 'Guardando...' : 'Guardar cambios'}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {showPagination ? (
        <div className="flex items-center justify-center gap-3 mt-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onPageChange(safePage - 1)}
            disabled={safePage <= 1}
          >
            Anterior
          </Button>
          <span className="text-sm text-[hsl(var(--muted-foreground))]">
            Página {safePage} de {groupedTotalPages}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onPageChange(safePage + 1)}
            disabled={safePage >= groupedTotalPages}
          >
            Siguiente
          </Button>
        </div>
      ) : null}
    </div>
  )
}

export default ProductsTable
