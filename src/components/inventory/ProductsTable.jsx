import { useState } from 'react'
import StockStatusBadge from './StockStatusBadge'

function formatClp(value) {
  if (value == null || Number.isNaN(Number(value))) return '—'
  return new Intl.NumberFormat('es-CL', {
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(Math.round(Number(value)))
}

function ProductsTable({
  items,
  loading,
  error,
  currentPage,
  totalPages,
  totalCount = 0,
  pageSize = 10,
  onPageChange,
  onEmptyAction,
  onPatchStock,
  onPatchUnitCost,
}) {
  const [stockEditId, setStockEditId] = useState(null)
  const [stockDraft, setStockDraft] = useState('')
  const [costEditId, setCostEditId] = useState(null)
  const [costDraft, setCostDraft] = useState('')
  const [saving, setSaving] = useState(false)

  const showPagination = !error && !loading && totalPages > 1
  const showCount = !error && !loading && totalCount > 0

  const closeEdits = () => {
    setStockEditId(null)
    setCostEditId(null)
    setStockDraft('')
    setCostDraft('')
  }

  const startStockEdit = (row) => {
    setCostEditId(null)
    setCostDraft('')
    setStockEditId(row.inventory_id != null ? String(row.inventory_id) : '')
    setStockDraft(String(row.stock_current ?? 0))
  }

  const startCostEdit = (row) => {
    setStockEditId(null)
    setStockDraft('')
    setCostEditId(row.inventory_id != null ? String(row.inventory_id) : '')
    setCostDraft(String(Math.round(Number(row.unit_cost_clp ?? 0))))
  }

  const submitStock = async (row) => {
    if (!onPatchStock) return
    const n = Number(stockDraft)
    if (!Number.isFinite(n) || n < 0) return
    setSaving(true)
    try {
      await onPatchStock(row, { stock: Math.floor(n) })
      closeEdits()
    } finally {
      setSaving(false)
    }
  }

  const submitCost = async (row) => {
    if (!onPatchUnitCost) return
    const n = Number(costDraft)
    if (!Number.isFinite(n) || n <= 0) return
    setSaving(true)
    try {
      await onPatchUnitCost(row, Math.round(n))
      closeEdits()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="scd-table-wrap">
      {showCount ? (
        <p className="scd-table-meta">
          {(() => {
            const from = items.length === 0 ? 0 : (currentPage - 1) * pageSize + 1
            const to = (currentPage - 1) * pageSize + items.length
            return `Mostrando ${from}–${to} de ${totalCount} productos`
          })()}
        </p>
      ) : null}
      <table className="scd-table">
        <thead>
          <tr>
            <th>Producto</th>
            <th>Categoría</th>
            <th>Proveedor</th>
            <th>Stock actual</th>
            <th>Stock mín.</th>
            <th>Stock máx.</th>
            <th>Costo unit. (CLP)</th>
            <th>Valor total</th>
            <th>Estado</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {error ? (
            <tr>
              <td colSpan={10} className="scd-table-empty">
                {error}
              </td>
            </tr>
          ) : null}
          {!error && loading ? (
            <tr>
              <td colSpan={10} className="scd-table-empty">
                Cargando productos…
              </td>
            </tr>
          ) : null}
          {!error && !loading && items.length === 0 ? (
            <tr>
              <td colSpan={10} className="scd-table-empty">
                <div className="scd-empty-state">
                  <p className="scd-empty-title">No hay productos registrados en este local.</p>
                  <p className="scd-empty-subtitle">Crea el primer producto para comenzar a gestionar inventario.</p>
                  {onEmptyAction ? (
                    <button type="button" className="scd-empty-btn" onClick={onEmptyAction}>
                      Crear primer producto
                    </button>
                  ) : null}
                </div>
              </td>
            </tr>
          ) : null}
          {!error && !loading
            ? items.map((row) => {
                const stockCurrent = Number(row.stock_current ?? 0)
                const unitCost = Number(row.unit_cost_clp ?? 0)
                const total =
                  row.total_value != null && row.total_value !== ''
                    ? Number(row.total_value)
                    : stockCurrent * unitCost
                const stockMin = row.stock_min == null ? '—' : String(row.stock_min)
                const stockMax = row.stock_max == null ? '—' : String(row.stock_max)
                const iid = row.inventory_id != null ? String(row.inventory_id) : ''
                const editingStock = stockEditId === iid
                const editingCost = costEditId === iid

                return (
                  <tr key={row.inventory_id ?? row.product_id}>
                    <td>
                      <div style={{ fontWeight: 700 }}>{row.product_name || row.name || '—'}</div>
                    </td>
                    <td>{row.category_name || '—'}</td>
                    <td className="scd-table-supplier">{row.supplier_name?.trim() || '—'}</td>
                    <td>
                      {editingStock ? (
                        <div className="scd-inline-edit">
                          <input
                            type="number"
                            min={0}
                            className="scd-inline-edit-input"
                            value={stockDraft}
                            onChange={(e) => setStockDraft(e.target.value)}
                            disabled={saving}
                            aria-label="Nuevo stock"
                          />
                          <button
                            type="button"
                            className="scd-inline-edit-btn"
                            disabled={saving}
                            onClick={() => submitStock(row)}
                          >
                            Guardar
                          </button>
                          <button type="button" className="scd-inline-edit-btn scd-inline-edit-btn--ghost" disabled={saving} onClick={closeEdits}>
                            Cancelar
                          </button>
                        </div>
                      ) : (
                        <span className="scd-cell-with-action">
                          {stockCurrent}
                          {onPatchStock ? (
                            <button type="button" className="scd-cell-edit" onClick={() => startStockEdit(row)} aria-label="Editar stock">
                              Editar
                            </button>
                          ) : null}
                        </span>
                      )}
                    </td>
                    <td>{stockMin}</td>
                    <td>{stockMax}</td>
                    <td>
                      {editingCost ? (
                        <div className="scd-inline-edit">
                          <input
                            type="number"
                            min={1}
                            step={1}
                            className="scd-inline-edit-input"
                            value={costDraft}
                            onChange={(e) => setCostDraft(e.target.value)}
                            disabled={saving}
                            aria-label="Nuevo costo unitario"
                          />
                          <button
                            type="button"
                            className="scd-inline-edit-btn"
                            disabled={saving}
                            onClick={() => submitCost(row)}
                          >
                            Guardar
                          </button>
                          <button type="button" className="scd-inline-edit-btn scd-inline-edit-btn--ghost" disabled={saving} onClick={closeEdits}>
                            Cancelar
                          </button>
                        </div>
                      ) : (
                        <span className="scd-cell-with-action">
                          {formatClp(unitCost)}
                          {onPatchUnitCost ? (
                            <button type="button" className="scd-cell-edit" onClick={() => startCostEdit(row)} aria-label="Editar costo">
                              Editar
                            </button>
                          ) : null}
                        </span>
                      )}
                    </td>
                    <td>{formatClp(total)}</td>
                    <td>
                      <StockStatusBadge row={row} />
                    </td>
                    <td className="scd-table-actions-hint">
                      <span className="scd-actions-hint">Editar en columnas Stock / Costo</span>
                    </td>
                  </tr>
                )
              })
            : null}
        </tbody>
      </table>
      {showPagination ? (
        <div className="scd-pagination">
          <button
            type="button"
            className="scd-pagination-btn"
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage <= 1}
          >
            Anterior
          </button>
          <span className="scd-pagination-info">
            Página {currentPage} de {totalPages}
          </span>
          <button
            type="button"
            className="scd-pagination-btn"
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage >= totalPages}
          >
            Siguiente
          </button>
        </div>
      ) : null}
    </div>
  )
}

export default ProductsTable
