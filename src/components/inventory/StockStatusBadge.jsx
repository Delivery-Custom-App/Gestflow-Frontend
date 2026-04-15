import { getStockStatusMeta } from './stockAlertUtils'

/** HU-44: badge de estado de stock (colores diferenciados). */
function StockStatusBadge({ row }) {
  const { label, variant } = getStockStatusMeta(row)
  return (
    <span className={`scd-stock-badge scd-stock-badge--${variant}`} data-stock-status={variant}>
      {label}
    </span>
  )
}

export default StockStatusBadge
