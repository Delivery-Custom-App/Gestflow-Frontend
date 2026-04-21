import './recipes.css'

function formatCLP(value) {
  if (value == null || Number.isNaN(Number(value))) return '—'
  return new Intl.NumberFormat('es-CL', {
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(Math.round(Number(value)))
}

function RecipesList({
  recipes,
  loading,
  error,
  onViewDetail,
  onToggleStatus,
  onDelete,
  onEdit,
  searchTerm,
}) {
  const filtered = recipes.filter((recipe) =>
    recipe.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="recipes-list__container">
      {/* Mobile cards */}
      <div className="recipes-list__cards" aria-label="Listado de recetas (móvil)">
        {error ? (
          <div className="recipes-list__error">{error}</div>
        ) : null}
        {!error && loading ? (
          <div className="recipes-list__loading">Cargando recetas…</div>
        ) : null}
        {!error && !loading && filtered.length === 0 ? (
          <div className="recipes-list__empty-state">
            <p className="recipes-list__empty-title">
              {searchTerm ? 'No se encontraron recetas' : 'No hay recetas registradas'}
            </p>
            <p className="recipes-list__empty-subtitle">
              {searchTerm ? 'Intenta con otro término de búsqueda' : 'Crea la primera receta para comenzar'}
            </p>
          </div>
        ) : null}

        {!error &&
          !loading &&
          filtered.map((recipe) => (
            <article
              key={recipe.id}
              className={`recipes-card ${recipe.is_active ? '' : 'recipes-card--inactive'}`}
            >
              <div className="recipes-card__head">
                <div className="recipes-card__title-wrap">
                  <div className="recipes-card__title">{recipe.name}</div>
                  {recipe.category_name ? (
                    <div className="recipes-card__subtitle">{recipe.category_name}</div>
                  ) : null}
                </div>
                <span
                  className={`recipes-card__status ${
                    recipe.is_active ? 'recipes-card__status--active' : 'recipes-card__status--inactive'
                  }`}
                >
                  {recipe.is_active ? 'Activa' : 'Inactiva'}
                </span>
              </div>

              {recipe.description ? (
                <p className="recipes-card__desc">{recipe.description}</p>
              ) : null}

              <div className="recipes-card__grid">
                <div className="recipes-card__kv">
                  <span className="recipes-card__k">Costo</span>
                  <span className="recipes-card__v">${formatCLP(recipe.total_cost)}</span>
                </div>
                <div className="recipes-card__kv">
                  <span className="recipes-card__k">Venta</span>
                  <span className="recipes-card__v">${formatCLP(recipe.price_sale)}</span>
                </div>
                <div className="recipes-card__kv">
                  <span className="recipes-card__k">Margen</span>
                  <span className="recipes-card__v">{recipe.profit_margin_percent?.toFixed(1)}%</span>
                </div>
                <div className="recipes-card__kv">
                  <span className="recipes-card__k">Porciones</span>
                  <span className="recipes-card__v">{recipe.yield_portions}</span>
                </div>
              </div>

              <div className="recipes-card__actions">
                <button
                  type="button"
                  className="recipes-card__btn"
                  onClick={() => onViewDetail(recipe.id)}
                >
                  Ver
                </button>
                <button
                  type="button"
                  className="recipes-card__btn"
                  onClick={() => onEdit(recipe)}
                >
                  Editar
                </button>
                <button
                  type="button"
                  className="recipes-card__btn"
                  onClick={() => onToggleStatus(recipe.id, !recipe.is_active)}
                >
                  {recipe.is_active ? 'Desactivar' : 'Activar'}
                </button>
                <button
                  type="button"
                  className="recipes-card__btn recipes-card__btn--danger"
                  onClick={() => {
                    if (window.confirm(`¿Eliminar receta "${recipe.name}"?`)) {
                      onDelete(recipe.id)
                    }
                  }}
                >
                  Eliminar
                </button>
              </div>
            </article>
          ))}
      </div>

      <div className="recipes-list__table-wrapper">
        <table className="recipes-list__table">
          <thead>
            <tr>
              <th>Receta</th>
              <th>Categoría</th>
              <th>Costo Total</th>
              <th>Precio Venta</th>
              <th>Margen</th>
              <th>Porciones</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {error ? (
              <tr>
                <td colSpan={8} className="recipes-list__error">
                  {error}
                </td>
              </tr>
            ) : null}
            {!error && loading ? (
              <tr>
                <td colSpan={8} className="recipes-list__loading">
                  Cargando recetas…
                </td>
              </tr>
            ) : null}
            {!error && !loading && filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="recipes-list__empty">
                  <div className="recipes-list__empty-state">
                    <p className="recipes-list__empty-title">
                      {searchTerm ? 'No se encontraron recetas' : 'No hay recetas registradas'}
                    </p>
                    <p className="recipes-list__empty-subtitle">
                      {searchTerm ? 'Intenta con otro término de búsqueda' : 'Crea la primera receta para comenzar'}
                    </p>
                  </div>
                </td>
              </tr>
            ) : null}
            {!error &&
              !loading &&
              filtered.map((recipe) => (
                <tr key={recipe.id} className={!recipe.is_active ? 'recipes-list__row--inactive' : ''}>
                  <td>
                    <div className="recipes-list__recipe-name">{recipe.name}</div>
                    {recipe.description && (
                      <div className="recipes-list__recipe-desc">{recipe.description}</div>
                    )}
                  </td>
                  <td>{recipe.category_name || '—'}</td>
                  <td className="recipes-list__cost">${formatCLP(recipe.total_cost)}</td>
                  <td className="recipes-list__price">${formatCLP(recipe.price_sale)}</td>
                  <td className={`recipes-list__margin ${recipe.profit_margin_percent >= 30 ? 'recipes-list__margin--good' : ''}`}>
                    {recipe.profit_margin_percent?.toFixed(1)}%
                  </td>
                  <td className="recipes-list__portions">{recipe.yield_portions}</td>
                  <td>
                    <span className={`recipes-list__status ${recipe.is_active ? 'recipes-list__status--active' : 'recipes-list__status--inactive'}`}>
                      {recipe.is_active ? '✓ Activa' : '◯ Inactiva'}
                    </span>
                  </td>
                  <td>
                    <div className="recipes-list__actions">
                      <button
                        type="button"
                        className="recipes-list__action-btn recipes-list__action-btn--view"
                        onClick={() => onViewDetail(recipe.id)}
                        title="Ver detalles"
                      >
                        👁️
                      </button>
                      <button
                        type="button"
                        className="recipes-list__action-btn recipes-list__action-btn--edit"
                        onClick={() => onEdit(recipe)}
                        title="Editar"
                      >
                        ✏️
                      </button>
                      <button
                        type="button"
                        className="recipes-list__action-btn recipes-list__action-btn--toggle"
                        onClick={() => onToggleStatus(recipe.id, !recipe.is_active)}
                        title={recipe.is_active ? 'Desactivar' : 'Activar'}
                      >
                        {recipe.is_active ? '⊘' : '⊚'}
                      </button>
                      <button
                        type="button"
                        className="recipes-list__action-btn recipes-list__action-btn--delete"
                        onClick={() => {
                          if (window.confirm(`¿Eliminar receta "${recipe.name}"?`)) {
                            onDelete(recipe.id)
                          }
                        }}
                        title="Eliminar"
                      >
                        🗑️
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default RecipesList
