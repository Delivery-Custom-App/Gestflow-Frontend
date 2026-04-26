import { getStockStatusMeta } from './stockAlertUtils'

/** Badge de estado de stock (variantes de color por nivel). */
function StockStatusBadge({ row }) {
  const { label, variant } = getStockStatusMeta(row)
  return (
    <span className={`scd-stock-badge scd-stock-badge--${variant}`} data-stock-status={variant}>
      {label}
    </span>
  )
}

export default StockStatusBadge
