import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useSelectedLocal } from '../../../hooks/useSelectedLocal'
import InventoryShell from '../InventoryShell'
import RecipesList from './RecipesList'
import RecipeDetail from './RecipeDetail'
import CreateRecipeModal from './CreateRecipeModal'
import { useRecipes } from '../../../hooks/useRecipes'
import { getCategoriesForLocal } from '../../../lib/inventoryApi'
import { Button } from '@/components/ui/button'
import { motion, AnimatePresence } from 'framer-motion'
import { BookOpen, HelpCircle, X, DollarSign, Search, Tag, ToggleLeft } from 'lucide-react'
import { formatCLPOrDash as formatCLP } from '../../../lib/formatCLP'

function RecipesPage() {
  const { localId } = useParams()
  const selectedLocal = useSelectedLocal(localId)

  const { recipes, kpis, loading, error, fetchRecipes, getRecipe, createRecipe, updateRecipe, toggleRecipeStatus, deleteRecipe, fetchKpis } = useRecipes(localId)

  const [showCreateModal, setShowCreateModal] = useState(false)
  const [selectedRecipe, setSelectedRecipe] = useState(null)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [editingRecipe, setEditingRecipe] = useState(null)
  const [categoryFilter, setCategoryFilter] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState(null)
  const [categories, setCategories] = useState([])
  const [saveError, setSaveError] = useState('')
  const [guideOpen, setGuideOpen] = useState(false)

  useEffect(() => {
    const loadCategories = async () => {
      try {
        // SEC-04: el endpoint /recipes/categories no existe en el backend monolito.
        // Se usa /categories (mismo que CreateRecipeModal para asignar la categoría).
        const data = await getCategoriesForLocal(localId)
        setCategories(Array.isArray(data) ? data : [])
      } catch {
        setCategories([])
      }
    }
    if (localId) loadCategories()
  }, [localId])

  useEffect(() => {
    fetchRecipes({
      search: searchTerm || null,
      categoryId: categoryFilter || null,
      isActive: statusFilter === null ? null : statusFilter === 'active',
    })
  }, [searchTerm, categoryFilter, statusFilter, fetchRecipes])

  const handleViewDetail = async (recipeId) => {
    try {
      const recipe = await getRecipe(recipeId)
      setSelectedRecipe(recipe)
      setShowDetailModal(true)
    } catch (err) {
      console.error('Error loading recipe:', err)
    }
  }

  const handleDelete = async (recipeId) => {
    await deleteRecipe(recipeId)
    await fetchKpis()
    await fetchRecipes({ search: searchTerm || null, categoryId: categoryFilter || null, isActive: statusFilter === null ? null : statusFilter === 'active' })
  }

  const handleToggleStatus = async (recipeId, isActive) => {
    await toggleRecipeStatus(recipeId, isActive)
    await fetchKpis()
    await fetchRecipes({ search: searchTerm || null, categoryId: categoryFilter || null, isActive: statusFilter === null ? null : statusFilter === 'active' })
  }

  const handleSaveRecipe = async (formData) => {
    setSaveError('')
    try {
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
      setSaveError(err?.message || 'Error al guardar la receta')
      throw err
    }
  }

  const selectClass = 'h-9 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary)/0.3)]'

  return (
    <>
      <AnimatePresence>
        {guideOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
            onClick={() => setGuideOpen(false)}>
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }} transition={{ duration: 0.2 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-2xl shadow-2xl w-full max-w-lg max-h-[88vh] overflow-y-auto no-scrollbar">
              <div className="flex items-center justify-between px-5 py-4 border-b border-[hsl(var(--border))]">
                <div className="flex items-center gap-2">
                  <HelpCircle size={16} className="text-[hsl(var(--primary))]" />
                  <h3 className="text-sm font-bold text-[hsl(var(--foreground))]">Guía — Recetas</h3>
                </div>
                <button onClick={() => setGuideOpen(false)}
                  className="flex items-center justify-center w-7 h-7 rounded-lg text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] transition-colors">
                  <X size={14} />
                </button>
              </div>
              <div className="px-5 py-4 space-y-3">
                {[
                  { icon: BookOpen, color: 'text-[hsl(var(--primary))]', title: 'Lista de recetas', desc: 'Muestra todas las recetas del local con su costo de producción y margen de ganancia calculados automáticamente.' },
                  { icon: DollarSign, color: 'text-emerald-600', title: 'Costo y margen', desc: 'El costo se calcula sumando el costo de cada ingrediente según la cantidad usada. El margen muestra cuánto ganas sobre el precio de venta.' },
                  { icon: Tag, color: 'text-amber-600', title: 'Categorías', desc: 'Organiza las recetas por categoría (ej: entradas, platos, postres) para encontrarlas más fácilmente.' },
                  { icon: ToggleLeft, color: 'text-blue-600', title: 'Estado activo/inactivo', desc: 'Puedes desactivar una receta para que no aparezca en el POS sin necesidad de eliminarla.' },
                  { icon: Search, color: 'text-indigo-600', title: 'Búsqueda', desc: 'Filtra por nombre, categoría o estado para localizar recetas específicas rápidamente.' },
                  { icon: BookOpen, color: 'text-[hsl(var(--primary))]', title: 'Nueva receta', highlight: true, desc: 'Crea una receta indicando los ingredientes del inventario con sus cantidades. El costo se calcula solo.' },
                ].map(({ icon: Icon, color, title, desc, highlight }) => (
                  <div key={title} className={`flex gap-3 rounded-xl p-3 ${highlight ? 'bg-[hsl(var(--primary)/0.08)] border border-[hsl(var(--primary)/0.2)]' : 'bg-[hsl(var(--muted)/0.4)]'}`}>
                    <div className={`mt-0.5 shrink-0 ${color}`}><Icon size={15} /></div>
                    <div>
                      <p className="text-xs font-semibold text-[hsl(var(--foreground))] mb-0.5">{title}</p>
                      <p className="text-xs text-[hsl(var(--muted-foreground))] leading-relaxed">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <InventoryShell>
      <div className="flex flex-col gap-6 pb-8 pt-4 px-6">

        <header className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <span className="flex items-center justify-center w-10 h-10 rounded-full bg-[hsl(var(--primary)/0.1)] text-[hsl(var(--primary))]" aria-hidden="true">
              <BookOpen size={22} />
            </span>
            <div>
              <h1 className="text-xl font-bold text-[hsl(var(--foreground))]">Gestión de Recetas</h1>
              <p className="text-sm text-[hsl(var(--muted-foreground))]">Crea y administra recetas con cálculo automático de costos</p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <Button
              type="button"
              onClick={() => {
                setEditingRecipe(null)
                setShowCreateModal(true)
              }}
            >
              Nueva Receta
            </Button>
            <button
              onClick={() => setGuideOpen(true)}
              className="flex items-center gap-1.5 text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--primary))] transition-colors"
            >
              <HelpCircle size={13} />
              <span>¿Cómo funciona esta pantalla?</span>
            </button>
          </div>
        </header>

        {/* KPIs */}
        {kpis && (
          <section className="grid grid-cols-2 sm:grid-cols-4 gap-3" aria-label="KPIs de recetas">
            {[
              { label: 'Total de Recetas', value: kpis.total_recipes || 0, color: 'text-[hsl(var(--foreground))]' },
              { label: 'Activas', value: kpis.active_recipes || 0, color: 'text-emerald-600' },
              { label: 'Costo Promedio', value: `$${formatCLP(kpis.total_cost_average)}`, color: 'text-[hsl(var(--foreground))]' },
              { label: 'Margen Promedio', value: `${kpis.profit_margin_average?.toFixed(1)}%`, color: 'text-[hsl(var(--primary))]' },
            ].map(({ label, value, color }) => (
              <article key={label} className="flex flex-col gap-0.5 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-sm px-4 py-3">
                <span className="text-xs text-[hsl(var(--muted-foreground))]">{label}</span>
                <span className={`text-xl font-bold ${color}`}>{value}</span>
              </article>
            ))}
          </section>
        )}

        {/* Filters */}
        <section className="flex flex-wrap gap-2" aria-label="Filtros de recetas">
          <input
            type="text"
            placeholder="Buscar recetas..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={`${selectClass} min-w-[180px]`}
          />
          <select
            className={selectClass}
            value={categoryFilter || ''}
            onChange={(e) => setCategoryFilter(e.target.value || null)}
          >
            <option value="">Todas las categorías</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>{cat.name}</option>
            ))}
          </select>
          <select
            className={selectClass}
            value={statusFilter || ''}
            onChange={(e) => setStatusFilter(e.target.value || null)}
          >
            <option value="">Todos los estados</option>
            <option value="active">Activas</option>
            <option value="inactive">Inactivas</option>
          </select>
        </section>

        <RecipesList
          recipes={recipes}
          loading={loading}
          error={error}
          onViewDetail={handleViewDetail}
          onToggleStatus={handleToggleStatus}
          onDelete={handleDelete}
          onEdit={(recipe) => {
            setEditingRecipe(recipe)
            setShowCreateModal(true)
          }}
          searchTerm={searchTerm}
        />

        <CreateRecipeModal
          isOpen={showCreateModal}
          recipe={editingRecipe}
          onSave={handleSaveRecipe}
          onCancel={() => {
            setShowCreateModal(false)
            setEditingRecipe(null)
            setSaveError('')
          }}
          onToggleStatus={editingRecipe ? handleToggleStatus : undefined}
          onDelete={editingRecipe ? handleDelete : undefined}
          localId={localId}
          externalError={saveError}
        />

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
              await handleDelete(selectedRecipe.id)
              setShowDetailModal(false)
              setSelectedRecipe(null)
            }}
          />
        )}
      </div>
    </InventoryShell>
    </>
  )
}

export default RecipesPage
