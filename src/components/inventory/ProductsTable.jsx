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
  const [editingRow, setEditingRow] = useState(null)
  const [stockDraft, setStockDraft] = useState('')
  const [costDraft, setCostDraft] = useState('')
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)

  const showPagination = !error && !loading && totalPages > 1
  const showCount = !error && !loading && totalCount > 0

  const closeEditModal = () => {
    setEditingRow(null)
    setStockDraft('')
    setCostDraft('')
    setFormError('')
  }

  const openEditModal = (row) => {
    setEditingRow(row)
    setStockDraft(String(row.stock_current ?? 0))
    setCostDraft(String(Math.round(Number(row.unit_cost_clp ?? 0))))
    setFormError('')
  }

  const submitRowUpdate = async () => {
    if (!editingRow) return
    const stockValue = Number(stockDraft)
    const unitCostValue = Number(costDraft)

    if (!Number.isFinite(stockValue) || stockValue < 0) {
      setFormError('El stock actual debe ser un número válido mayor o igual a 0.')
      return
    }
    if (!Number.isFinite(unitCostValue) || unitCostValue <= 0) {
      setFormError('El costo unitario debe ser un número válido mayor a 0.')
      return
    }

    const nextStock = Math.floor(stockValue)
    const nextUnitCost = Math.round(unitCostValue)
    const currentStock = Number(editingRow.stock_current ?? 0)
    const currentUnitCost = Math.round(Number(editingRow.unit_cost_clp ?? 0))

    setSaving(true)
    setFormError('')
    try {
      if (onPatchStock && nextStock !== currentStock) {
        await onPatchStock(editingRow, { stock: nextStock })
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
                return (
                  <tr key={row.inventory_id ?? row.product_id}>
                    <td>
                      <div style={{ fontWeight: 700 }}>{row.product_name || row.name || '—'}</div>
                    </td>
                    <td>{row.category_name || '—'}</td>
                    <td className="scd-table-supplier">{row.supplier_name?.trim() || '—'}</td>
                    <td>
                      {stockCurrent}
                    </td>
                    <td>{stockMin}</td>
                    <td>{stockMax}</td>
                    <td>
                      {formatClp(unitCost)}
                    </td>
                    <td>{formatClp(total)}</td>
                    <td>
                      <StockStatusBadge row={row} />
                    </td>
                    <td className="scd-table-actions-hint">
                      <button type="button" className="scd-inline-edit-btn" onClick={() => openEditModal(row)}>
                        Editar stock/costo
                      </button>
                    </td>
                  </tr>
                )
              })
            : null}
        </tbody>
      </table>
      {editingRow ? (
        <div className="npmodal-backdrop" role="presentation" onClick={closeEditModal}>
          <section
            className="npmodal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-stock-cost-title"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="npmodal-head">
              <h2 id="edit-stock-cost-title">Editar stock y costo</h2>
              <button type="button" className="npmodal-close" onClick={closeEditModal} aria-label="Cerrar modal">
                ×
              </button>
            </header>
            <div className="npmodal-form">
              <p className="scd-actions-hint">
                {editingRow.product_name || editingRow.name || 'Producto'}
              </p>
              {formError ? <div className="npmodal-error">{formError}</div> : null}
              <div className="npmodal-row npmodal-row--2">
                <label className="npmodal-field">
                  <span>Stock actual</span>
                  <input
                    type="number"
                    min={0}
                    value={stockDraft}
                    onChange={(e) => setStockDraft(e.target.value)}
                    disabled={saving}
                    aria-label="Editar stock actual"
                  />
                </label>
                <label className="npmodal-field">
                  <span>Costo unitario (CLP)</span>
                  <input
                    type="number"
                    min={1}
                    step={1}
                    value={costDraft}
                    onChange={(e) => setCostDraft(e.target.value)}
                    disabled={saving}
                    aria-label="Editar costo unitario"
                  />
                </label>
              </div>
              <div className="npmodal-actions">
                <button type="button" className="npmodal-btn npmodal-btn--ghost" onClick={closeEditModal} disabled={saving}>
                  Cancelar
                </button>
                <button type="button" className="npmodal-btn npmodal-btn--primary" onClick={submitRowUpdate} disabled={saving}>
                  {saving ? 'Guardando...' : 'Guardar cambios'}
                </button>
              </div>
            </div>
          </section>
        </div>
      ) : null}
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
