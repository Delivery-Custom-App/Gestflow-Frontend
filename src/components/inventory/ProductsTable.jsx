function formatClp(value) {
  if (value == null || Number.isNaN(Number(value))) return '—'
  return new Intl.NumberFormat('es-CL').format(Number(value))
}

function getStockStatus(row) {
  const stockCurrent = Number(row.stock_current ?? 0)
  if (row.stock_min != null && stockCurrent <= Number(row.stock_min)) {
    return 'Crítico'
  }
  if (row.stock_max != null && stockCurrent < Math.max(1, Math.floor(Number(row.stock_max) / 4))) {
    return 'Bajo'
  }
  return 'Óptimo'
}

function ProductsTable({ items, loading, error, currentPage, totalPages, onPageChange }) {
  const showPagination = !error && !loading && totalPages > 1

  return (
    <div className="scd-table-wrap">
      <table className="scd-table">
        <thead>
          <tr>
            <th>Producto</th>
            <th>Categoría</th>
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
              <td colSpan={9} className="scd-table-empty">
                {error}
              </td>
            </tr>
          ) : null}
          {!error && loading ? (
            <tr>
              <td colSpan={9} className="scd-table-empty">
                Cargando productos…
              </td>
            </tr>
          ) : null}
          {!error && !loading && items.length === 0 ? (
            <tr>
              <td colSpan={9} className="scd-table-empty">
                No hay productos registrados en este local.
              </td>
            </tr>
          ) : null}
          {!error && !loading
            ? items.map((row) => {
                const stockCurrent = Number(row.stock_current ?? 0)
                const unitCost = Number(row.unit_cost_clp ?? 0)
                const total = stockCurrent * unitCost
                const stockMin = row.stock_min == null ? '—' : String(row.stock_min)
                const stockMax = row.stock_max == null ? '—' : String(row.stock_max)

                return (
                  <tr key={row.inventory_id ?? row.product_id}>
                    <td>
                      <div style={{ fontWeight: 700 }}>{row.product_name || row.name || '—'}</div>
                      {row.supplier_name ? (
                        <div style={{ color: '#64748b', fontSize: '0.78rem' }}>{row.supplier_name}</div>
                      ) : null}
                    </td>
                    <td>{row.category_name || '—'}</td>
                    <td>{stockCurrent}</td>
                    <td>{stockMin}</td>
                    <td>{stockMax}</td>
                    <td>{formatClp(unitCost)}</td>
                    <td>{formatClp(total)}</td>
                    <td>{getStockStatus(row)}</td>
                    <td>—</td>
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
            Pagina {currentPage} de {totalPages}
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
