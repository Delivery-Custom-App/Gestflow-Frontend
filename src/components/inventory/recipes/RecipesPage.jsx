import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import InventoryShell from '../InventoryShell'
import RecipesList from './RecipesList'
import RecipeDetail from './RecipeDetail'
import CreateRecipeModal from './CreateRecipeModal'
import { useRecipes } from '../../../hooks/useRecipes'
import { apiRequest } from '../../../lib/apiClient'
import './recipes.css'

function RecipesPage({ user, userRole, onLogout }) {
  const navigate = useNavigate()
  const { localId } = useParams()
  
  const { recipes, kpis, loading, error, fetchRecipes, getRecipe, createRecipe, updateRecipe, toggleRecipeStatus, deleteRecipe, fetchKpis } = useRecipes(localId)

  const [showCreateModal, setShowCreateModal] = useState(false)
  const [selectedRecipe, setSelectedRecipe] = useState(null)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [editingRecipe, setEditingRecipe] = useState(null)
  const [categoryFilter, setCategoryFilter] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState(null)
  const [categories, setCategories] = useState([])

  // Load categories on mount
  useEffect(() => {
    const loadCategories = async () => {
      try {
        const data = await apiRequest(`/categories?local_id=${localId}`)
        setCategories(Array.isArray(data) ? data : [])
      } catch (err) {
        console.error('Error loading categories:', err)
        setCategories([])
      }
    }
    
    if (localId) {
      loadCategories()
    }
  }, [localId])

  // Load recipe details when needed
  const handleViewDetail = async (recipeId) => {
    try {
      const recipe = await getRecipe(recipeId)
      setSelectedRecipe(recipe)
      setShowDetailModal(true)
    } catch (err) {
      console.error('Error loading recipe:', err)
    }
  }

  // Handle create/update
  const handleSaveRecipe = async (formData) => {
    try {
      // Transform snake_case from modal to camelCase for hook
      const transformedData = {
        categoryId: formData.category_id,
        name: formData.name,
        description: formData.description,
        priceSale: formData.price_sale,
        yieldPortions: formData.yield_portions,
        ingredients: formData.ingredients?.map(ing => ({
          productId: ing.product_id,
          quantityRequired: ing.quantity_required,
          unit: ing.unit,
        })) || [],
      }

      if (editingRecipe?.id) {
        await updateRecipe(editingRecipe.id, {
          ...transformedData,
          isActive: editingRecipe.is_active,
        })
      } else {
        await createRecipe(transformedData)
      }

      setShowCreateModal(false)
      setEditingRecipe(null)
      await fetchRecipes()
      await fetchKpis()
    } catch (err) {
      console.error('Error saving recipe:', err)
    }
  }

  // Format currency
  function formatCLP(value) {
    if (value == null || Number.isNaN(Number(value))) return '—'
    return new Intl.NumberFormat('es-CL', {
      maximumFractionDigits: 0,
      minimumFractionDigits: 0,
    }).format(Math.round(Number(value)))
  }

  return (
    <InventoryShell user={user} userRole={userRole} onLogout={onLogout} active="recipes">
      <button
        type="button"
        className="recipes-page__back"
        onClick={() => navigate(`/local/${localId}/inventario`)}
      >
        ← Volver al Inventario
      </button>

      <header className="recipes-page__header">
        <div>
          <h1 className="recipes-page__title">Gestión de Recetas</h1>
          <p className="recipes-page__subtitle">Crea y administra recetas con cálculo automático de costos</p>
        </div>
        <button
          type="button"
          className="recipes-page__create-btn"
          onClick={() => {
            setEditingRecipe(null)
            setShowCreateModal(true)
          }}
        >
          + Nueva Receta
        </button>
      </header>

      {/* KPIs Section */}
      {kpis && (
        <section className="recipes-page__kpis">
          <article className="recipes-page__kpi-card">
            <span className="recipes-page__kpi-label">Total de Recetas</span>
            <span className="recipes-page__kpi-value">{kpis.total_recipes || 0}</span>
          </article>
          <article className="recipes-page__kpi-card">
            <span className="recipes-page__kpi-label">Activas</span>
            <span className="recipes-page__kpi-value recipes-page__kpi-value--success">{kpis.active_recipes || 0}</span>
          </article>
          <article className="recipes-page__kpi-card">
            <span className="recipes-page__kpi-label">Costo Promedio</span>
            <span className="recipes-page__kpi-value">${formatCLP(kpis.total_cost_average)}</span>
          </article>
          <article className="recipes-page__kpi-card">
            <span className="recipes-page__kpi-label">Margen Promedio</span>
            <span className="recipes-page__kpi-value recipes-page__kpi-value--margin">{kpis.profit_margin_average?.toFixed(1)}%</span>
          </article>
        </section>
      )}

      {/* Filters and View */}
      <section className="recipes-page__controls">
        <div className="recipes-page__search">
          <input
            type="text"
            placeholder="Buscar recetas..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="recipes-page__search-input"
          />
        </div>
      </section>

      {/* Recipes List */}
      <RecipesList
        recipes={recipes}
        loading={loading}
        error={error}
        onViewDetail={handleViewDetail}
        onToggleStatus={toggleRecipeStatus}
        onDelete={deleteRecipe}
        onEdit={(recipe) => {
          setEditingRecipe(recipe)
          setShowCreateModal(true)
        }}
        searchTerm={searchTerm}
      />

      {/* Create/Edit Modal */}
      <CreateRecipeModal
        isOpen={showCreateModal}
        recipe={editingRecipe}
        categories={categories}
        onSave={handleSaveRecipe}
        onCancel={() => {
          setShowCreateModal(false)
          setEditingRecipe(null)
        }}
        localId={localId}
      />

      {/* Detail Modal */}
      {showDetailModal && selectedRecipe && (
        <RecipeDetail
          recipe={selectedRecipe}
          onClose={() => {
            setShowDetailModal(false)
            setSelectedRecipe(null)
          }}
          onEdit={() => {
            setEditingRecipe(selectedRecipe)
            setShowDetailModal(false)
            setShowCreateModal(true)
          }}
          onDelete={async () => {
            await deleteRecipe(selectedRecipe.id)
            setShowDetailModal(false)
            setSelectedRecipe(null)
          }}
        />
      )}
    </InventoryShell>
  )
}

export default RecipesPage
