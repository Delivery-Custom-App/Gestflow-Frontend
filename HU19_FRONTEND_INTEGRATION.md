# 🚀 HU-19 Frontend - Guía de Integración

## ✅ Componentes Implementados

### 1. **OrderSummary.jsx** (SCRUM-136, SCRUM-137, SCRUM-138)
📍 Ubicación: `src/components/OrderSummary.jsx`

**Propósito:**
Mostrar el resumen completo del pedido antes de confirmar y proceder al pago.

**Características:**
- ✅ Visualiza lista de items con detalles (nombre, descripción, categoría, cantidad, precio)
- ✅ Muestra información del cliente (nombre, email, teléfono)
- ✅ Muestra información del local de retiro (nombre, dirección, teléfono)
- ✅ Desglose completo de costos:
  - Subtotal
  - IVA (19% - Chile)
  - Costo de envío (si aplica)
  - Descuentos (si aplica)
  - TOTAL A PAGAR
- ✅ Botón para cambiar local
- ✅ Botón para volver al carrito
- ✅ Botón para ir a pago

**Ruta:**
```
/order/:orderId/summary
```

**Uso:**
```jsx
import OrderSummary from './components/OrderSummary'

// En el Router:
<Route path="/order/:orderId/summary" element={<OrderSummary />} />

// Navegar a:
navigate(`/order/550e8400-e29b-41d4-a716-446655440000/summary`)
```

---

### 2. **ChangeLocal.jsx** (SCRUM-137, SCRUM-139)
📍 Ubicación: `src/components/ChangeLocal.jsx`

**Propósito:**
Permitir que el cliente vea locales disponibles y cambie el local de retiro del pedido.

**Características:**
- ✅ Muestra el local actual como referencia
- ✅ Lista todos los locales disponibles del negocio
- ✅ Permite seleccionar un nuevo local
- ✅ Envía el cambio al backend mediante `PATCH /api/orders/{order_id}/local`
- ✅ Valida que el usuario esté autenticado (requiere JWT token)
- ✅ Manejo de errores
- ✅ Vuelve automáticamente al resumen si el cambio es exitoso

**Ruta:**
```
/order/:orderId/change-local
```

**Uso:**
```jsx
import ChangeLocal from './components/ChangeLocal'

// En el Router:
<Route path="/order/:orderId/change-local" element={<ChangeLocal />} />

// Navegar a:
navigate(`/order/550e8400-e29b-41d4-a716-446655440000/change-local`)
```

---

## 📚 Hooks Creados

### 1. **useOrderSummary(orderId)**
📍 Ubicación: `src/hooks/useOrderSummary.js`

**Propósito:**
Obtener el resumen completo del pedido desde el backend.

**Retorna:**
```javascript
{
  summary: {
    id: string,
    items: [],
    client_name: string,
    client_email: string,
    client_phone: string,
    local_info: { id, name, address, phone },
    pricing_breakdown: {
      subtotal: number,
      tax_amount: number,
      tax_percentage: number,
      delivery_cost: number,
      discount_amount: number,
      total: number
    }
  },
  loading: boolean,
  error: string | null
}
```

**Uso:**
```jsx
import { useOrderSummary } from './hooks/useOrderSummary'

const { summary, loading, error } = useOrderSummary('550e8400-e29b-41d4-a716-446655440000')

if (loading) return <p>Cargando...</p>
if (error) return <p>Error: {error}</p>
```

---

### 2. **useAvailableLocals(businessId)**
📍 Ubicación: `src/hooks/useAvailableLocals.js`

**Propósito:**
Obtener la lista de locales disponibles de un negocio.

**Retorna:**
```javascript
{
  locals: [
    { id, name, address, phone },
    ...
  ],
  loading: boolean,
  error: string | null
}
```

**Uso:**
```jsx
import { useAvailableLocals } from './hooks/useAvailableLocals'

const { locals, loading, error } = useAvailableLocals('business-uuid')

if (loading) return <p>Cargando locales...</p>
```

---

## 🎨 Estilos CSS

### 1. **OrderSummary.css**
📍 Ubicación: `src/styles/OrderSummary.css`

**Características:**
- Diseño responsive (mobile, tablet, desktop)
- Secciones bien organizadas
- Colores y tipografía profesional
- Estados de carga y error

---

### 2. **ChangeLocal.css**
📍 Ubicación: `src/styles/ChangeLocal.css`

**Características:**
- Grid responsivo para mostrar locales
- Indicador de local actual
- Indicador de local seleccionado
- Animaciones suaves

---

## 🌐 Variables de Entorno

Crear un archivo `.env.local` en la raíz del proyecto:

```env
# API Backend Configuration
VITE_API_URL=http://localhost:8000

# Supabase Configuration
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# Authentication (Optional)
VITE_JWT_TOKEN=your_jwt_token_here
```

**Variables requeridas:**
- `VITE_API_URL`: URL del backend (diferente si está en producción)
- `VITE_SUPABASE_URL`: URL de tu proyecto Supabase
- `VITE_SUPABASE_ANON_KEY`: Clave anónima de Supabase

---

## 🔌 Integración con React Router

El `App.jsx` ha sido actualizado para usar React Router:

```jsx
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import OrderSummary from './components/OrderSummary'
import ChangeLocal from './components/ChangeLocal'

<Router>
  <Routes>
    <Route path="/order/:orderId/summary" element={<OrderSummary />} />
    <Route path="/order/:orderId/change-local" element={<ChangeLocal />} />
    {/* Otras rutas... */}
  </Routes>
</Router>
```

---

## 📊 Endpoints Consumidos

### 1. GET /api/orders/{order_id}/summary
**Usado por:** `useOrderSummary` hook
**Autenticación:** No requerida

La llamada se realiza automáticamente cuando montas un componente que usa `useOrderSummary(orderId)`.

---

### 2. GET /api/locals/by-business/{business_id}/available
**Usado por:** `useAvailableLocals` hook
**Autenticación:** No requerida

La llamada se realiza automáticamente cuando montas un componente que usa `useAvailableLocals(businessId)`.

---

### 3. PATCH /api/orders/{order_id}/local
**Usado por:** Componente `ChangeLocal`
**Autenticación:** Requiere JWT token en header `Authorization`
**Request Body:**
```json
{
  "local_id": "uuid-del-nuevo-local"
}
```

La llamada se ejecuta cuando el usuario confirma el cambio de local.

---

## 🧪 Cómo Probar

### 1. Asegúrate que el backend esté corriendo
```bash
docker-compose -f docker-compose.dev.yml up -d
```

### 2. Configura las variables de entorno
Copia `.env.example` a `.env.local` y actualiza los valores:
```bash
cp .env.example .env.local
```

### 3. Inicia el servidor de desarrollo
```bash
npm run dev
```

### 4. Accede a través del navegador
```
http://localhost:5173/order/550e8400-e29b-41d4-a716-446655440000/summary
```

Reemplaza `550e8400-e29b-41d4-a716-446655440000` con un ID de pedido real del backend.

---

## 🧠 Flujo de Interacción (HU-19)

```
1. USUARIO EN CARRITO
   ↓
2. CLIENTE HACE CLIC EN "CONFIRMAR PEDIDO"
   ↓
3. Se crea un pedido en backend (POST /api/orders)
   ↓
4. Se obtiene el orden_id del nuevo pedido
   ↓
5. Navigate → /order/{order_id}/summary
   ↓
6. PANTALLA MUESTRA RESUMEN COMPLETO (componente OrderSummary)
   ✓ Items con detalles
   ✓ Cliente información
   ✓ Local actual
   ✓ Desglose de costos con IVA
   ↓
7. [CLIENTE ELIGE OPCIÓN]
   ├─ OPCIÓN A: CAMBIAR LOCAL
   │  ├─ Hace clic en "Cambiar Local"
   │  ├─ Navigate → /order/{order_id}/change-local
   │  ├─ Ve lista de locales disponibles (componente ChangeLocal)
   │  ├─ Selecciona nuevo local
   │  ├─ Hace clic en "Confirmar Cambio"
   │  ├─ Se envía: PATCH /api/orders/{order_id}/local
   │  ├─ Backend valida y actualiza
   │  ├─ Vuelve automáticamente a: /order/{order_id}/summary
   │  └─ Se muestra nuevo local en el resumen
   │
   ├─ OPCIÓN B: VOLVER AL CARRITO
   │  └─ Navigate → /cart
   │
   └─ OPCIÓN C: CONFIRMAR Y IR A PAGO
      └─ Navigate → /payment/{order_id}
         (próxima implementación)
```

---

## 🇨🇱 Configuración Fiscal Chile

**Importante:** Este proyecto está configurado para Chile con normativa fiscal DL 825.

- **IVA Estándar:** 19%
- **Aplicable a:** Servicios de gastronomía/restaurantes
- **Moneda:** Pesos Chilenos ($)
- **Formato de números:** Separador de miles con punto (.)
  - Ejemplo: $10.500, $1.995, $24.990

El desglose de costos siempre mostrará:
- Subtotal (base imponible)
- IVA (19%)
- Cualquier otro costo

---

## 📝 Checklist de Implementación

- [x] Crear hook `useOrderSummary`
- [x] Crear hook `useAvailableLocals`
- [x] Crear componente `OrderSummary`
- [x] Crear componente `ChangeLocal`
- [x] Crear estilos `OrderSummary.css`
- [x] Crear estilos `ChangeLocal.css`
- [x] Agregar `react-router-dom` a package.json
- [x] Actualizar `App.jsx` con rutas
- [x] Instalar dependencias
- [x] Configurar variables de entorno
- [ ] Crear componente de pago (próxima HU)
- [ ] Hacer test end-to-end

---

## 🐛 Troubleshooting

### Error: "Cannot find module 'react-router-dom'"
**Solución:** Ejecuta `npm install` nuevamente

### Error: "VITE_API_URL is undefined"
**Solución:** Crea `.env.local` con:
```env
VITE_API_URL=http://localhost:8000
```

### 404 "No se encontró el pedido"
**Causa:** El ID del pedido no existe en el backend
**Solución:** Crea primero un pedido a través de la API

### Error "Usuario no tiene permisos" (al cambiar local)
**Causa:** El token JWT no es válido o no tiene permisos
**Solución:** Asegúrate de estar autenticado y guarda el token en localStorage con clave `authToken`

### Los estilos no se aplican
**Solución:** Limpia la caché del navegador (Ctrl+F5)

---

## 📞 Siguiente Sprint

### HU-20: Pantalla de Pago
- [ ] Crear componente `PaymentPage`
- [ ] Integrar gateway de pago
- [ ] Confirmar pedido: `POST /api/orders/{order_id}/confirm`

### HU-21: Confirmación de Pedido
- [ ] Mostrar número de pedido
- [ ] Mostrar estado del pedido
- [ ] Opciones para rastrear

---

**Estado:** ✅ HU-19 Frontend completada
**Fecha:** 31 de Marzo de 2026
**Listo para:** Testing e integración con Pago
