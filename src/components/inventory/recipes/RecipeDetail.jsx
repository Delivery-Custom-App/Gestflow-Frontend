import './recipes.css'

function formatCLP(value) {
  if (value == null || Number.isNaN(Number(value))) return '—'
  return new Intl.NumberFormat('es-CL', {
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(Math.round(Number(value)))
}

function RecipeDetail({ recipe, onClose, onEdit, onDelete }) {
  if (!recipe) return null

  const costPerPortion = recipe.yield_portions > 0 ? recipe.total_cost / recipe.yield_portions : 0

  return (
    <div className="recipe-detail__overlay" onClick={onClose}>
      <div className="recipe-detail__modal" onClick={(e) => e.stopPropagation()}>
        <div className="recipe-detail__header">
          <h2 className="recipe-detail__title">{recipe.name}</h2>
          <button
            type="button"
            className="recipe-detail__close"
            onClick={onClose}
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>

        {recipe.description && (
          <p className="recipe-detail__description">{recipe.description}</p>
        )}

        <div className="recipe-detail__section">
          <h3 className="recipe-detail__section-title">📊 Resumen Financiero</h3>
          <div className="recipe-detail__grid">
            <div className="recipe-detail__item">
              <span className="recipe-detail__label">Precio de Venta</span>
              <span className="recipe-detail__value">${formatCLP(recipe.price_sale)}</span>
            </div>
            <div className="recipe-detail__item">
              <span className="recipe-detail__label">Costo Total (Receta)</span>
              <span className="recipe-detail__value recipe-detail__value--cost">${formatCLP(recipe.total_cost)}</span>
            </div>
            <div className="recipe-detail__item">
              <span className="recipe-detail__label">Costo x Porción</span>
              <span className="recipe-detail__value">${formatCLP(costPerPortion)}</span>
            </div>
            <div className="recipe-detail__item">
              <span className="recipe-detail__label">Margen de Ganancia</span>
              <span className={`recipe-detail__value ${recipe.profit_margin_percent >= 30 ? 'recipe-detail__value--good' : ''}`}>
                {recipe.profit_margin_percent?.toFixed(1)}%
              </span>
            </div>
            <div className="recipe-detail__item">
              <span className="recipe-detail__label">Porciones que Rinde</span>
              <span className="recipe-detail__value">{recipe.yield_portions}</span>
            </div>
            <div className="recipe-detail__item">
              <span className="recipe-detail__label">Categoría</span>
              <span className="recipe-detail__value">{recipe.category_name || '—'}</span>
            </div>
          </div>
        </div>

        {recipe.ingredients && recipe.ingredients.length > 0 && (
          <div className="recipe-detail__section">
            <h3 className="recipe-detail__section-title">🥘 Ingredientes ({recipe.ingredients.length})</h3>
            <table className="recipe-detail__ingredients-table">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Cantidad</th>
                  <th>Costo Unitario</th>
                  <th>Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {recipe.ingredients.map((ing, idx) => (
                  <tr key={idx}>
                    <td className="recipe-detail__ingredient-name">{ing.product_name}</td>
                    <td>
                      {ing.quantity_required} {ing.unit}
                    </td>
                    <td>${formatCLP(ing.unit_cost_clp)}</td>
                    <td>${formatCLP(ing.ingredient_subtotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="recipe-detail__footer">
          <button
            type="button"
            className="recipe-detail__btn recipe-detail__btn--secondary"
            onClick={onClose}
          >
            Cerrar
          </button>
          <button
            type="button"
            className="recipe-detail__btn recipe-detail__btn--primary"
            onClick={onEdit}
          >
            Editar Receta
          </button>
          <button
            type="button"
            className="recipe-detail__btn recipe-detail__btn--danger"
            onClick={() => {
              if (window.confirm(`¿Eliminar receta "${recipe.name}"?`)) {
                onDelete()
              }
            }}
          >
            Eliminar
          </button>
        </div>
      </div>
    </div>
  )
}

export default RecipeDetail
