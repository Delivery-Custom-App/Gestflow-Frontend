# Manual — POS Complementario (Cocina, Reportes, Registrar producto)

> **Última actualización:** 2026-09-03 — MrCasuela
> (actualizar esta línea cada vez que se edite el documento)

> **A quién sirve:** 3 pantallas operativas alrededor del POS que **no** están cubiertas en [`../proceso/PROCESO_VENTA.md`](../proceso/PROCESO_VENTA.md) (ese documento cubre solo venta + cobro). Rutas bajo `/local/:localId/pos/*`.
>
> Backend: **Gestflow-Backend-V2**.
>
> **⚠️ Hallazgo importante (verificado contra el código del backend):** de las 3 pantallas de este manual, **2 llaman endpoints que hoy no existen en Backend V2** — ver §2 y §3. Solo Cocina (§1) funciona de punta a punta con el backend actual.

---

## 1. Cocina (KDS — Kitchen Display System)

**Ruta:** `/local/:localId/pos/cocina`. **Rol:** todos (incluye workers).

**Qué es:** una pantalla de cola de comandas en tiempo real para la cocina — muestra cada orden con su estado y un cronómetro, para que el personal de cocina sepa qué preparar y en qué orden.

**Cómo se usa:**
1. Cada orden aparece como una tarjeta agrupada por estado: **Nueva Orden** (pendiente), **En Cocina** (en preparación), **Demorada** (en preparación hace más de 20 minutos), **Lista**.
2. El cronómetro de cada tarjeta arranca cuando la orden pasa a "En Cocina" — a los 13 minutos la barra se pone amarilla, a los 20 minutos roja y la tarjeta pasa a "Demorada".
3. Desde la tarjeta, el personal marca el avance de la orden (ej. pasar de "En Cocina" a "Lista").
4. Las órdenes "Listas" se pueden buscar/filtrar; después de 2 minutos en ese estado, se ocultan solas de la vista principal para no saturar la pantalla.
5. La lista se actualiza sola cada 30 segundos (no hace falta recargar la página).

**Ficha técnica:** componente `src/components/pos/KitchenDisplay.jsx`, montado dentro de `POSModule.jsx` cuando la ruta termina en `/cocina`. Hook `useKitchenOrders` (`src/hooks/useKitchenOrders.js`, polling cada 30s). Endpoints: `GET /orders` + `GET /orders/{id}/items` (listar), `PATCH /orders/{id}` (cambiar estado — mismas transiciones `open→preparing→ready→completed` de [`../proceso/PROCESO_VENTA.md`](../proceso/PROCESO_VENTA.md)). Datos: `orders.status`, `orders.updated_at` (usado como inicio del cronómetro de cocción).

---

## 2. Reportes POS

**Ruta:** `/local/:localId/pos/reportes`. **Rol:** Superadmin, Owner, Admin (no workers).

**Qué es (según el diseño de la pantalla):** estadísticas rápidas de ventas del local — la receta y la bebida más vendidas, y un top 5 de productos con sus unidades e ingresos.

**⚠️ Estado real:** esta pantalla llama a `GET /dashboard/pos-reportes?local_id=`, y **ese endpoint no existe en Backend V2** (no hay ningún `dashboard.py` ni ruta equivalente en `app/api/routes/`). Hoy, al abrir esta pantalla, la petición falla y se muestra el estado de error ("Error al cargar reportes") con un botón "Reintentar" que no va a funcionar mientras el endpoint no exista en el backend.

**Cómo se usaría (si el endpoint existiera):** pantalla de solo lectura — dos tarjetas destacadas (receta más vendida, bebestible más vendido) y una lista ordenada de los 5 productos con más ventas, con una barra comparando cada uno contra el primero.

**Ficha técnica:** componente `src/components/pos/ReportesPage.jsx`, hook `useReportesPOS` (`src/hooks/useReportesPOS.js`). Endpoint esperado: `GET /dashboard/pos-reportes?local_id={id}` — **pendiente de implementar en Backend V2** (existía en el backend legacy `Gestflow-backend`, en `src/api/routes/dashboard.py`, que ya no está en uso).

---

## 3. Registrar producto rápido

**Ruta:** `/local/:localId/pos/registrar-producto`. **Rol:** todos, incluidos workers.

**Qué es (según el diseño de la pantalla):** un formulario rápido para dar de alta un producto de venta directa (sin receta) desde el mismo POS, sin tener que ir al módulo de Inventario.

**⚠️ Estado real:** esta pantalla llama a `POST /products/register` (para crear) y `GET /products/catalog?local_id=` (para listar los ya registrados), y **ninguno de los dos existe en Backend V2** (`app/api/routes/products.py` solo tiene `GET/POST /products`, `GET/PATCH/DELETE /products/{id}` — sin `/register` ni `/catalog`). Hoy, tanto el listado como el intento de registrar un producto van a fallar contra el backend actual.

**Cómo se usaría (si los endpoints existieran):** completar nombre, categoría (comestible/bebestible), cantidad y precio, y confirmar con "Registrar producto"; la lista de abajo, agrupada por categoría, mostraría los productos ya registrados con su stock y precio.

**Ficha técnica:** componente `src/components/pos/RegistrarProductoView.jsx`. Endpoints esperados: `POST /products/register`, `GET /products/catalog?local_id={id}` — **ninguno implementado en Backend V2** (también heredados del backend legacy). El alta de productos hoy funcional pasa por el módulo de Inventario (`MenuBuilderPage.jsx`, `POST /products` + `POST /local-products`), no por esta pantalla.

---

## Errores comunes

| Situación | Qué ves | Qué causa / qué hacer |
|---|---|---|
| Reportes POS no carga | "Error al cargar reportes: [detalle]", botón "Reintentar" | El endpoint no existe en Backend V2 (§2) — reintentar no lo va a arreglar hasta que se implemente en el backend |
| Registrar producto no guarda / la lista no carga | Mensaje de error debajo del formulario, o lista vacía persistente | Los endpoints no existen en Backend V2 (§3) — usar el módulo de Inventario mientras tanto |
| Orden no avanza en Cocina | La tarjeta no cambia de estado al marcar el avance | Puede ser una transición de estado inválida (ver tabla de errores en [`../proceso/PROCESO_VENTA.md`](../proceso/PROCESO_VENTA.md) §4) o un problema de red — reintentar |

---

## Referencias de archivo

- `src/components/pos/KitchenDisplay.jsx`, `POSModule.jsx`, `src/hooks/useKitchenOrders.js`
- `src/components/pos/ReportesPage.jsx`, `src/hooks/useReportesPOS.js`
- `src/components/pos/RegistrarProductoView.jsx`
- Backend (`Gestflow-Backend-V2`): `app/api/routes/orders.py` (Cocina, funcional). Reportes POS y Registrar producto **no tienen endpoint equivalente todavía** en `app/api/routes/`.
