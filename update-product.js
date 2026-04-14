import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://qtrenssaghoeelbascfo.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF0cmVuc3NhZ2hvZWVsYmFzY2ZvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0MDg5NTksImV4cCI6MjA4OTk4NDk1OX0.Of7yce-wGFExMUHVyQzuFASI1VY4KVjxNVhTzBFCZqg'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function updateProduct() {
  try {
    // Intentar directamente en la tabla products
    console.log('Buscando "Pan Frito" en tabla products...')
    
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('*')
      .ilike('name', '%Pan%')
    
    if (productsError) {
      console.error('Error:', productsError)
    } else {
      console.log('Productos encontrados:', products)
      
      if (products && products.length > 0) {
        const panFrito = products.find(p => p.name && p.name.toLowerCase().includes('frito'))
        if (panFrito) {
          console.log('Encontrado:', panFrito)
          
          const { error: updateError } = await supabase
            .from('products')
            .update({ name: 'Pan Frita' })
            .eq('id', panFrito.id)
          
          if (updateError) {
            console.error('Error al actualizar:', updateError)
          } else {
            console.log('✅ Producto actualizado a "Pan Frita"')
          }
          return
        }
      }
    }
    
    // Si no encontró Pan Frito, intentar buscar de forma más general
    console.log('\nIntentando búsqueda general por "Frito"...')
    const { data: allProducts, error: allError } = await supabase
      .from('products')
      .select('id, name')
    
    if (!allError) {
      console.log('Total de productos:', allProducts?.length)
      allProducts?.slice(0, 20).forEach(p => console.log(`- ${p.id}: ${p.name}`))
    }
    
  } catch (err) {
    console.error('Error:', err)
  }
}

updateProduct()
