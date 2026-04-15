import { useState, useEffect } from 'react'
import { apiRequest } from '../../../lib/apiClient'
import './recipes.css'

function CreateRecipeModal({ isOpen, recipe, categories, onSave, onCancel, localId }) {
  const [formData, setFormData] = useState({
    category_id: '',
    name: '',
    description: '',
    price_sale: '',
    yield_portions: 1,
  })

  const [ingredients, setIngredients] = useState([])
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(false)
  const [savingLoading, setSavingLoading] = useState(false)
  const [errors, setErrors] = useState({})
  const [newIngredient, setNewIngredient] = useState({
    product_id: '',
    quantity_required: '',
    unit: 'kg',
  })

  useEffect(() => {
    if (!isOpen) return

    if (recipe) {
      setFormData({
        category_id: recipe.category_id || '',
        name: recipe.name || '',
        description: recipe.description || '',
        price_sale: recipe.price_sale || '',
        yield_portions: recipe.yield_portions || 1,
      })
      setIngredients(recipe.ingredients ? [...recipe.ingredients] : [])
    } else {
      setFormData({
        category_id: '',
        name: '',
        description: '',
        price_sale: '',
        yield_portions: 1,
      })
      setIngredients([])
    }
    setNewIngredient({ product_id: '', quantity_required: '', unit: 'kg' })
    setErrors({})

    // Fetch products
    fetchProducts()
  }, [isOpen, recipe])

  const fetchProducts = async () => {
    setLoading(true)
    try {
      const data = await apiRequest(`/products?local_id=${localId}`)
      setProducts(data || [])
    } catch (err) {
      console.error('Error fetching products:', err)
      setErrors((prev) => ({ ...prev, products: 'Error cargando productos' }))
    } finally {
      setLoading(false)
    }
  }

  const handleFormChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: name === 'yield_portions' ? Math.max(1, parseInt(value) || 1) : value,
    }))
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }))
    }
  }

  const handleIngredientChange = (e) => {
    const { name, value } = e.target
    setNewIngredient((prev) => ({
      ...prev,
      [name]: value,
    }))
  }

  const addIngredient = () => {
    if (!newIngredient.product_id || !newIngredient.quantity_required) {
      setErrors((prev) => ({
        ...prev,
        ingredient: 'Selecciona producto y cantidad',
      }))
      return
    }

    const product = products.find((p) => p.id === parseInt(newIngredient.product_id))
    if (!product) return

    const isDuplicate = ingredients.some(
      (ing) => ing.product_id === parseInt(newIngredient.product_id)
    )

    if (isDuplicate) {
      setErrors((prev) => ({
        ...prev,
        ingredient: 'Este producto ya está agregado',
      }))
      return
    }

    const newIng = {
      product_id: parseInt(newIngredient.product_id),
      product_name: product.name,
      quantity_required: parseFloat(newIngredient.quantity_required),
      unit: newIngredient.unit,
      unit_cost_clp: product.price_per_unit || 0,
    }

    setIngredients((prev) => [...prev, newIng])
    setNewIngredient({ product_id: '', quantity_required: '', unit: 'kg' })
    setErrors((prev) => ({ ...prev, ingredient: '' }))
  }

  const removeIngredient = (productId) => {
    setIngredients((prev) => prev.filter((ing) => ing.product_id !== productId))
  }

  const calculateTotalCost = () => {
    return ingredients.reduce((sum, ing) => {
      return sum + ing.quantity_required * ing.unit_cost_clp
    }, 0)
  }

  const calculateMargin = () => {
    const totalCost = calculateTotalCost()
    const salePrice = parseFloat(formData.price_sale) || 0
    return salePrice > 0 ? ((salePrice - totalCost) / salePrice) * 100 : 0
  }

  const validateForm = () => {
    const newErrors = {}
    if (!formData.category_id) newErrors.category_id = 'Categoría requerida'
    if (!formData.name.trim()) newErrors.name = 'Nombre requerido'
    if (!formData.price_sale) newErrors.price_sale = 'Precio de venta requerido'
    if (parseFloat(formData.price_sale) <= 0) newErrors.price_sale = 'Precio debe ser mayor a 0'
    if (formData.yield_portions < 1) newErrors.yield_portions = 'Debe rendir al menos 1 porción'
    if (ingredients.length === 0) newErrors.ingredients = 'Agrega al menos 1 ingrediente'

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSave = async () => {
    if (!validateForm()) return

    setSavingLoading(true)
    try {
      const totalCost = calculateTotalCost()
      const payload = {
        category_id: parseInt(formData.category_id),
        name: formData.name.trim(),
        description: formData.description.trim(),
        price_sale: parseFloat(formData.price_sale),
        yield_portions: formData.yield_portions,
        total_cost: totalCost,
        profit_margin_percent: calculateMargin(),
        ingredients,
      }

      if (recipe) {
        payload.id = recipe.id
      }

      await onSave(payload)
    } finally {
      setSavingLoading(false)
    }
  }

  if (!isOpen) return null

  const totalCost = calculateTotalCost()
  const margin = calculateMargin()

  return (
    <div className="recipe-modal__overlay" onClick={onCancel}>
      <div className="recipe-modal__container" onClick={(e) => e.stopPropagation()}>
        <div className="recipe-modal__header">
          <h2 className="recipe-modal__title">
            {recipe ? '✏️ Editar Receta' : '➕ Nueva Receta'}
          </h2>
          <button
            type="button"
            className="recipe-modal__close"
            onClick={onCancel}
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>

        <div className="recipe-modal__content">
          {/* Datos Básicos */}
          <fieldset className="recipe-modal__fieldset">
            <legend className="recipe-modal__legend">📝 Datos de la Receta</legend>

            <div className="recipe-modal__form-grid">
              <div className="recipe-modal__form-group">
                <label className="recipe-modal__label">
                  Categoría <span className="recipe-modal__required">*</span>
                </label>
                <select
                  name="category_id"
                  value={formData.category_id}
                  onChange={handleFormChange}
                  className={`recipe-modal__input ${errors.category_id ? 'recipe-modal__input--error' : ''}`}
                >
                  <option value="">Selecciona una categoría</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
                {errors.category_id && (
                  <span className="recipe-modal__error">{errors.category_id}</span>
                )}
              </div>

              <div className="recipe-modal__form-group">
                <label className="recipe-modal__label">
                  Nombre <span className="recipe-modal__required">*</span>
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleFormChange}
                  placeholder="Ej: Filete a lo Pobre"
                  className={`recipe-modal__input ${errors.name ? 'recipe-modal__input--error' : ''}`}
                />
                {errors.name && <span className="recipe-modal__error">{errors.name}</span>}
              </div>

              <div className="recipe-modal__form-group recipe-modal__form-group--full">
                <label className="recipe-modal__label">Descripción</label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleFormChange}
                  placeholder="Breve descripción"
                  className="recipe-modal__textarea"
                  rows="1"
                />
              </div>

              <div className="recipe-modal__form-group">
                <label className="recipe-modal__label">
                  Precio de Venta (CLP) <span className="recipe-modal__required">*</span>
                </label>
                <input
                  type="number"
                  name="price_sale"
                  value={formData.price_sale}
                  onChange={handleFormChange}
                  placeholder="12000"
                  className={`recipe-modal__input ${errors.price_sale ? 'recipe-modal__input--error' : ''}`}
                />
                {errors.price_sale && (
                  <span className="recipe-modal__error">{errors.price_sale}</span>
                )}
              </div>

              <div className="recipe-modal__form-group">
                <label className="recipe-modal__label">
                  Porciones que Rinde <span className="recipe-modal__required">*</span>
                </label>
                <input
                  type="number"
                  name="yield_portions"
                  value={formData.yield_portions}
                  onChange={handleFormChange}
                  min="1"
                  className={`recipe-modal__input ${errors.yield_portions ? 'recipe-modal__input--error' : ''}`}
                />
                {errors.yield_portions && (
                  <span className="recipe-modal__error">{errors.yield_portions}</span>
                )}
              </div>
            </div>
          </fieldset>

          {/* Ingredientes */}
          <fieldset className="recipe-modal__fieldset">
            <legend className="recipe-modal__legend">🥘 Ingredientes</legend>

            {loading ? (
              <div className="recipe-modal__loading">Cargando productos...</div>
            ) : (
              <>
                <div className="recipe-modal__ingredient-selector">
                  <div className="recipe-modal__form-group">
                    <label className="recipe-modal__label">Producto</label>
                    <select
                      name="product_id"
                      value={newIngredient.product_id}
                      onChange={handleIngredientChange}
                      className="recipe-modal__input"
                    >
                      <option value="">Selecciona un producto</option>
                      {products.map((prod) => (
                        <option key={prod.id} value={prod.id}>
                          {prod.name} (${prod.price_per_unit?.toFixed(0) || '0'}/u)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="recipe-modal__form-group">
                    <label className="recipe-modal__label">Cantidad</label>
                    <input
                      type="number"
                      name="quantity_required"
                      value={newIngredient.quantity_required}
                      onChange={handleIngredientChange}
                      placeholder="0.5"
                      step="0.01"
                      className="recipe-modal__input"
                    />
                  </div>

                  <div className="recipe-modal__form-group">
                    <label className="recipe-modal__label">Unidad</label>
                    <select
                      name="unit"
                      value={newIngredient.unit}
                      onChange={handleIngredientChange}
                      className="recipe-modal__input"
                    >
                      <option value="kg">kg</option>
                      <option value="g">g</option>
                      <option value="L">L</option>
                      <option value="ml">ml</option>
                      <option value="unidad">unidad</option>
                      <option value="taza">taza</option>
                      <option value="cucharada">cucharada</option>
                      <option value="cucharadita">cucharadita</option>
                    </select>
                  </div>

                  <button
                    type="button"
                    onClick={addIngredient}
                    className="recipe-modal__btn recipe-modal__btn--add"
                    title="Agregar ingrediente"
                  >
                    ➕ Agregar
                  </button>
                </div>

                {errors.ingredient && (
                  <div className="recipe-modal__error recipe-modal__error--block">
                    {errors.ingredient}
                  </div>
                )}
                {errors.ingredients && (
                  <div className="recipe-modal__error recipe-modal__error--block">
                    {errors.ingredients}
                  </div>
                )}

                {ingredients.length > 0 ? (
                  <table className="recipe-modal__ingredients-table">
                    <thead>
                      <tr>
                        <th>Producto</th>
                        <th>Cantidad</th>
                        <th>Costo Unit.</th>
                        <th>Subtotal</th>
                        <th>Acción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ingredients.map((ing) => (
                        <tr key={ing.product_id}>
                          <td>{ing.product_name}</td>
                          <td>
                            {ing.quantity_required} {ing.unit}
                          </td>
                          <td>${ing.unit_cost_clp?.toFixed(0) || '0'}</td>
                          <td>${(ing.quantity_required * ing.unit_cost_clp).toFixed(0)}</td>
                          <td>
                            <button
                              type="button"
                              onClick={() => removeIngredient(ing.product_id)}
                              className="recipe-modal__btn recipe-modal__btn--remove"
                              title="Eliminar ingrediente"
                            >
                              🗑️
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="recipe-modal__empty-message">
                    <p className="recipe-modal__empty-text">Sin ingredientes agregados. Usa el selector arriba.</p>
                  </div>
                )}
              </>
            )}
          </fieldset>

          {/* Resumen Financiero */}
          {ingredients.length > 0 && (
            <fieldset className="recipe-modal__fieldset">
              <legend className="recipe-modal__legend">💰 Resumen Financiero</legend>
              <div className="recipe-modal__summary">
                <div className="recipe-modal__summary-item">
                  <span>Costo Total:</span>
                  <span className="recipe-modal__summary-value">${totalCost.toFixed(0)}</span>
                </div>
                <div className="recipe-modal__summary-item">
                  <span>Costo por Porción:</span>
                  <span className="recipe-modal__summary-value">
                    ${(totalCost / formData.yield_portions).toFixed(0)}
                  </span>
                </div>
                <div className="recipe-modal__summary-item">
                  <span>Precio de Venta:</span>
                  <span className="recipe-modal__summary-value">
                    ${formData.price_sale || '0'}
                  </span>
                </div>
                <div className={`recipe-modal__summary-item ${margin >= 30 ? 'recipe-modal__summary-item--good' : ''}`}>
                  <span>Margen de Ganancia:</span>
                  <span className="recipe-modal__summary-value">{margin.toFixed(1)}%</span>
                </div>
              </div>
            </fieldset>
          )}
        </div>

        <div className="recipe-modal__footer">
          <button
            type="button"
            onClick={onCancel}
            className="recipe-modal__btn recipe-modal__btn--secondary"
            disabled={savingLoading}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="recipe-modal__btn recipe-modal__btn--primary"
            disabled={savingLoading}
          >
            {savingLoading ? '⏳ Guardando...' : recipe ? '✓ Actualizar' : '✓ Crear Receta'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default CreateRecipeModal
