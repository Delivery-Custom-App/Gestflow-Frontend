# Funcionalidades del Sistema — SibaGestión

Sistema de gestión para restaurantes y locales gastronómicos. Multi-local, multi-rol, con integración de pagos y control operativo completo.

---

## Módulos principales

### 1. Punto de Venta (POS)

Terminal digital de atención pensado para mozos y cajeros.

- **Mapa de mesas** visual con estado en tiempo real (Libre / Ocupada / En cobro), codificado por color
- **Gestión de órdenes** por mesa: agregar, editar y eliminar productos en cualquier momento
- **Historial de estado** de cada orden (apertura, modificaciones, cierre)
- **Métodos de pago**: Efectivo, Débito, Crédito, Transferencia y MercadoPago
- **Pago dividido**: divide la cuenta entre varios comensales con métodos distintos
- **Cobro con MercadoPago**: integración con Checkout Pro y terminales POS físicas (Point)
- **Filtros de mesas**: por estado, sector o búsqueda rápida
- **KPIs en tiempo real**: mesas libres, ocupadas y en proceso de cobro

---

### 2. Cocina (Kitchen Display System)

Vista dedicada para el equipo de cocina, sin necesidad de impresión.

- **Pantalla de comandas** en tiempo real, actualizada automáticamente
- **Cronómetro por orden**: indica el tiempo transcurrido desde la apertura
- **Vista limpia y legible** optimizada para ambientes de cocina
- **Sin necesidad de papel**: alternativa digital a la comanda impresa

---

### 3. Impresión de Comandas

- Impresoras configurables por local (nombre, modelo, IP y puerto)
- Impresión y reimpresión de comanda desde el POS
- Historial de impresiones por orden
- Test de conexión de impresora desde el panel

---

### 4. Inventario

Control completo del stock y los insumos del local.

- **Stock por producto** con niveles de alerta: Óptimo, Bajo y Crítico
- **Ajustes manuales** de stock con trazabilidad (movimientos registrados)
- **Costo unitario** editable por producto
- **Filtros avanzados**: por categoría, estado de stock y búsqueda de texto
- **KPIs de inventario**: valor total del stock, productos en estado crítico, bajo y óptimo
- **Exportación** de datos de inventario

---

### 5. Recetas

Gestión de recetas vinculadas directamente al inventario.

- Creación de recetas con ingredientes y cantidades
- **Consumo automático de stock** al confirmar una venta
- **Factor de porcionamiento** configurable por receta
- **Versiones de receta**: historial de cambios con trazabilidad completa
- Estado activo / inactivo por receta
- KPIs: costo promedio por receta, margen estimado

---

### 6. Proveedores

Módulo de gestión de proveedores y compras.

- Registro y edición de proveedores con información de contacto
- **Historial de compras** por proveedor
- **KPIs de proveedores**: insumos suministrados, costos acumulados, frecuencia de entregas
- Filtros por nombre y categoría

---

### 7. Órdenes de Compra Semanales

Planificación de compras periódicas a proveedores.

- Creación de órdenes en estado **borrador** antes de confirmar
- Líneas de orden editables (producto, cantidad, costo estimado)
- Flujo de estados: Borrador → Enviada → Recibida
- **Vista de impresión** en formato HTML para envío al proveedor
- Total estimado en CLP calculado automáticamente
- Historial completo de órdenes anteriores

---

### 8. Gastos

Registro y control de todos los gastos operativos.

- Categorías: Insumos, Servicios, Mantenimiento, Personal, Otros
- Flujo de **aprobación**: Pendiente → Aprobado / Rechazado
- Filtros por categoría, estado y rango de fechas
- Integración con el flujo de caja del local

---

### 9. Transferencias

Registro de movimientos de dinero entre cajas o cuentas.

- Registro con monto, origen, destino y descripción
- Historial filtrable por fecha
- Integración directa con el módulo de Dashboard

---

### 10. Dashboard y Reportes

Visión financiera y operativa del local en un solo lugar.

- **Ingresos de los últimos 7 días** con gráfico de tendencia
- **Desglose de gastos** por categoría (gráfico de torta)
- **Rendiciones de caja**: flujo de ingresos y egresos por período
- **Reportes del POS**:
  - Top productos más vendidos
  - Ventas por método de pago
  - Ventas por categoría
  - Comparativo semana actual vs. semana anterior
- **Metas de ventas**: definición de objetivo y seguimiento de avance
- **Dashboard consolidado** para ver múltiples locales (SUPERADMIN)
- **Exportación a PDF** del dashboard consolidado
- **Stream en tiempo real** via WebSocket

---

### 11. Alertas

Sistema de notificaciones internas para el equipo de gestión.

- Alertas automáticas por **stock crítico**
- Alertas por **órdenes atrasadas**
- Alertas por **transferencias pendientes**
- Alertas por **gastos sin aprobar**
- Resolución y seguimiento de alertas desde el panel
- Contador de alertas pendientes visible en la interfaz

---

### 12. Cajas

Control de cajas registradoras por local.

- Creación y edición de cajas por local
- **Asignación de usuarios a cajas** específicas
- Soporte para múltiples cajas en simultáneo
- Integración con POS y rendiciones

---

### 13. Integración MercadoPago

Cobro digital integrado al flujo de POS.

- **Checkout Pro**: genera preferencia de pago y redirige al cliente (QR o link)
- **Terminales POS físicas (Point)**: vinculación de lectores de tarjeta al sistema
  - Descubrimiento automático de dispositivos desde la cuenta MP
  - Asignación de un dispositivo por caja
  - Vinculación y desvinculación desde panel de configuración
- **OAuth "Conectar con MercadoPago"**: vinculación de cuenta MP sin copiar tokens manualmente
- Credenciales **por local**: cada franquicia conecta su propia cuenta
- Webhook de confirmación de pago (HMAC-SHA256 validado)
- Idempotencia: no se generan órdenes duplicadas ante reintentos

---

### 14. Gestión de Usuarios y Roles

Control de acceso basado en roles (RBAC).

| Rol | Descripción |
|---|---|
| **SUPERADMIN** | Acceso total al sistema, gestión de negocios, locales y usuarios |
| **ADMIN** | Gestión completa de su local (POS, inventario, administrativo, reportes) |
| **CAJERO** | Acceso a POS, órdenes, gastos, transferencias y vista de cocina |
| **EMPLEADO** | Acceso a POS, órdenes y vista de cocina |

- Creación de usuarios con asignación de rol y local
- Cambio de contraseña y edición de perfil
- Selector de local al iniciar sesión (multi-local)

---

### 15. Gestión Multi-local (Franquicias)

Soporte nativo para negocios con múltiples sucursales.

- Un negocio puede tener N locales, cada uno con su propia configuración
- Dashboard consolidado con métricas de todos los locales
- Cada local tiene su propio inventario, proveedores, cajas, usuarios y cuenta MP
- El SUPERADMIN puede operar cualquier local sin restricciones
- Mapa de franquicias disponible para vista geográfica

---

### 16. Onboarding Interactivo

- Tour guiado al primer ingreso, adaptado por rol
- Pasos contextuales que señalan los elementos de la interfaz
- Posibilidad de repetir el tutorial en cualquier momento

---

## Características técnicas y de experiencia

| Característica | Detalle |
|---|---|
| **Modo oscuro / claro** | Toggle persistente en toda la aplicación |
| **Responsive** | Optimizado para desktop, tablet y móvil |
| **Carga rápida** | Code-splitting y lazy-loading por módulo |
| **Autenticación segura** | Supabase Auth con JWT y renovación automática de sesión |
| **Seguridad a nivel de datos** | Row Level Security (RLS) en base de datos |
| **Operación offline parcial** | Idempotencia para evitar duplicados al reconectar |
| **Actualizaciones en tiempo real** | WebSocket para dashboard y alertas |
| **API documentada** | Swagger UI disponible en `/api/docs` |

---

## Resumen de alcance

| Categoría | Cantidad |
|---|---|
| Módulos principales | 16 |
| Endpoints de API | 130+ |
| Tablas de base de datos | 30+ |
| Roles de usuario | 4 |
| Métodos de pago soportados | 6 |
| Migraciones de base de datos | 27 |
