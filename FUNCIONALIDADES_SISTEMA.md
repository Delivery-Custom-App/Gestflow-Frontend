# SibaGestion — Funcionalidades Activas del Sistema

> **Versión:** 1.0 · **Fecha:** Junio 2026  
> Este documento describe las funcionalidades disponibles en el sistema actualmente operativo.

---

## Índice

1. [Acceso y Roles](#1-acceso-y-roles)
2. [Selección de Local](#2-selección-de-local)
3. [Dashboard](#3-dashboard)
4. [POS — Mesas y Órdenes](#4-pos--mesas-y-órdenes)
5. [Vista Cocina](#5-vista-cocina)
6. [Inventario](#6-inventario)
7. [Administración y Finanzas](#7-administración-y-finanzas)
8. [Gestión de Usuarios](#8-gestión-de-usuarios)
9. [Onboarding — Tutorial Guiado](#9-onboarding--tutorial-guiado)
10. [Interfaz y Experiencia de Usuario](#10-interfaz-y-experiencia-de-usuario)
11. [Matriz de Acceso por Rol](#11-matriz-de-acceso-por-rol)

---

## 1. Acceso y Roles

El sistema cuenta con autenticación segura vía Supabase y cuatro niveles de acceso:

| Rol | Descripción |
|---|---|
| **SUPERADMIN** | Acceso total al sistema. Gestiona locales, usuarios y todos los módulos. |
| **ADMIN** | Acceso completo al local asignado: dashboard, POS, inventario y administración. |
| **EMPLEADO** | Acceso al POS de su local (mesas, órdenes y vista cocina). |
| **CAJERO** | Igual que EMPLEADO, con acceso adicional a registrar gastos y transferencias. |

**El usuario puede:**
- Iniciar y cerrar sesión con email y contraseña
- Acceder solo a las secciones habilitadas para su rol
- Mantener la sesión activa entre visitas

---

## 2. Selección de Local

> Disponible para: **SUPERADMIN**

Al ingresar, el SUPERADMIN ve una grilla con todos los locales registrados en el sistema. Desde ahí puede:

- Ver todos sus locales de un vistazo
- Seleccionar un local para comenzar a gestionarlo
- Cambiar de local en cualquier momento desde el encabezado

Los roles ADMIN, EMPLEADO y CAJERO acceden directamente al local que tienen asignado.

---

## 3. Dashboard

> Disponible para: **SUPERADMIN, ADMIN**

Panel de control con métricas en tiempo real del local seleccionado.

**Indicadores financieros:**
- Ventas totales del día y del mes
- Ticket promedio por orden
- Tasa de cancelación de órdenes (%)
- Hora pico del día (franja horaria con más actividad)
- Mesa más activa del día

**Comparativos:**
- Ventas de esta semana vs. semana anterior (con variación porcentual)
- Desglose de métodos de pago del mes (efectivo, débito, crédito, transferencia)
- Gráfico de tendencia de ingresos de los últimos 7 días

**Inventario (resumen):**
- Total de productos registrados
- Cantidad de productos en estado óptimo, bajo y crítico
- Valor total del inventario en pesos
- Gráfico de distribución de stock por estado

---

## 4. POS — Mesas y Órdenes

> Disponible para: **SUPERADMIN, ADMIN, EMPLEADO, CAJERO**

Módulo principal de operación del restaurante.

### 4.1 Gestión de Mesas

- Ver todas las mesas del local con estado visual en tiempo real:
  - **Verde** → Libre
  - **Naranja** → Ocupada (con orden activa)
  - **Rojo** → En cobro
- Crear mesas nuevas (nombre, capacidad, zona, tipo: salón o delivery)
- Editar mesas existentes
- Ver KPIs del salón: mesas libres, ocupadas, en cobro y ocupación promedio

### 4.2 Gestión de Órdenes

- Crear una orden al seleccionar una mesa libre
- Agregar productos del menú con cantidad y comentarios especiales
- Incorporar ítems adicionales a una orden ya activa
- Cambiar el estado de la orden manualmente:
  - Pendiente → En Cocina → Lista → Completada
- Cancelar una orden en cualquier momento
- Seleccionar método de pago al cerrar: **Efectivo, Débito, Crédito o Transferencia**
- Procesar el cobro y liberar la mesa automáticamente

---

## 5. Vista Cocina

> Disponible para: **SUPERADMIN, ADMIN, EMPLEADO, CAJERO**

Panel de visualización pensado para el equipo de cocina (KDS — Kitchen Display System).

**La cocina puede:**
- Ver todas las órdenes activas del local ordenadas por hora de llegada
- Identificar el estado de cada orden mediante color:
  - **Gris** → Nueva orden (pendiente)
  - **Naranja** → En preparación
  - **Rojo** → Demorada (más de 15 minutos en preparación)
  - **Verde** → Lista para servir
- Avanzar el estado de cada orden: **Nueva → En Cocina → Lista**
- Ver el tiempo transcurrido de cada orden (cronómetro en vivo)
- Filtrar órdenes por estado o buscar por número de orden / mesa
- Ver el tipo de servicio de cada pedido (Dine In, Take Away, Delivery)
- Consultar métricas en pantalla: total de órdenes nuevas, en cocina, demoradas y listas

---

## 6. Inventario

> Disponible para: **SUPERADMIN, ADMIN**

### 6.1 Control de Stock

- Ver lista completa de productos con stock actual y estado de alerta
- Filtrar por categoría, nombre o estado (Óptimo / Bajo / Crítico)
- Ver detalle de cada producto: stock actual, mínimo, proveedor, valor unitario e historial de movimientos
- Crear productos nuevos
- Ajustar stock manualmente (agregar o restar cantidades)
- Editar precio unitario
- Activar o desactivar productos

### 6.2 Proveedores

- Listar todos los proveedores activos
- Ver KPIs por proveedor: insumos comprados, costo mensual, tiempo promedio de entrega y órdenes pendientes
- Crear proveedor nuevo (nombre, contacto, email, teléfono, categoría, términos de pago)
- Editar información del proveedor
- Consultar historial de compras por proveedor

### 6.3 Pedidos de Compra Semanales

- Ver y gestionar órdenes de compra por semana
- Crear una orden de compra: seleccionar proveedor, agregar ítems con cantidad y precio
- Editar órdenes en borrador (agregar/quitar líneas, cambiar cantidades)
- Enviar la orden al proveedor (cambia estado a "Enviada")
- Registrar la recepción del pedido con posibilidad de ajustar cantidades reales recibidas
- Ver comparativo entre semanas y proveedores (variaciones de precio y volumen)

**Estados de una orden de compra:** Borrador → Enviada → Recibida → Completada / Cancelada

### 6.4 Recetas del Menú

- Ver todas las recetas activas del local
- Crear receta: nombre, categoría, ingredientes con cantidades, precio de venta y margen de ganancia
- Editar receta o cambiar su estado activo/inactivo
- Ver KPIs de recetas: costo promedio, margen de ganancia promedio
- **Descuento automático de stock** de ingredientes al completar una orden con esa receta

---

## 7. Administración y Finanzas

> Disponible para: **SUPERADMIN, ADMIN** (y parcialmente CAJERO en gastos/transferencias)

### 7.1 Ventas

- Ver el listado completo de órdenes completadas con monto, mesa, método de pago y hora de cierre
- Buscar y filtrar órdenes por fecha, método de pago o monto

### 7.2 Rendiciones

- Ver el resumen de dinero en caja (calculado a partir de órdenes completadas)
- Registrar transferencias de dinero al dueño o administrador (monto, fecha, método, comentarios)
- Crear y registrar gastos del local por categoría:
  - Insumos, Servicios, Mantenimiento, Personal, Otros
- Aprobar o rechazar gastos registrados por otros usuarios
- Ver el estado de cada gasto: Pendiente / Aprobado / Rechazado

### 7.3 Flujo de Caja

- Ver el resumen de movimientos del período seleccionado:
  - Dinero entrante (ventas completadas)
  - Dinero saliente (gastos y transferencias)
  - Saldo neto resultante
- Comparar el flujo actual con el período anterior

### 7.4 Reportes de Ventas

- Producto más vendido y bebestible más vendido del período
- Top 5 productos por unidades vendidas y por ingresos generados
- Desglose de ventas por categoría de menú
- Desglose por método de pago
- Filtros por período: diario, semanal, mensual con comparativo vs. período anterior

### 7.5 Alertas

- Ver alertas activas del sistema en tiempo real:
  - Stock crítico
  - Órdenes atrasadas en cocina
  - Transferencias pendientes
  - Gastos sin aprobar
  - Mesas abiertas al cierre del día
- Resolver alertas (marcar como leído o completar la acción requerida)
- Badge de alerta en el encabezado con conteo de pendientes

### 7.6 Metas y Bonos

- Crear metas de ventas mensuales para el local
- Ver el progreso hacia la meta: monto objetivo, monto actual, porcentaje completado y días restantes
- Consultar el cálculo de bonos asociado al cumplimiento de la meta
- Editar metas existentes

---

## 8. Gestión de Usuarios

> Disponible para: **SUPERADMIN**

- **Crear usuario:** definir nombre, email, contraseña, rol y local asignado
- **Listar usuarios** agrupados por local, con nombre, correo, rol y estado
- **Eliminar usuario** del sistema (se elimina tanto del registro como de la autenticación)
- **Editar usuario:** cambiar nombre, teléfono, rol o estado activo/inactivo

---

## 9. Onboarding — Tutorial Guiado

Al ingresar por primera vez, el sistema activa automáticamente un tour interactivo paso a paso adaptado al rol del usuario.

| Rol | Pasos del tour |
|---|---|
| **SUPERADMIN** | Tus Locales → Dashboard → Gestión de Usuarios → Administración → POS → Inventario |
| **ADMIN** | Ventas del Día → Administración → POS → Inventario |
| **EMPLEADO / CAJERO** | Mesas del Local → Vista Cocina |

**El usuario puede:**
- Navegar entre pasos con "Siguiente" o haciendo clic en el área oscurecida
- Saltar el tour completo en cualquier momento
- **Repetir el tour cuando quiera** usando el botón "Ver tutorial" en el menú lateral

---

## 10. Interfaz y Experiencia de Usuario

- **Modo oscuro / claro** con toggle en la barra superior, preferencia guardada entre sesiones
- **Sidebar colapsable** con animación suave; en móvil se convierte en drawer lateral
- **Diseño responsive** adaptado a escritorio, tablet y móvil
- **Navegación contextual:** el menú muestra solo las secciones del local activo
- **Indicadores visuales** consistentes: badges de estado, gráficos, barras de progreso y alertas por color
- **Feedback inmediato** en cada acción: notificaciones de éxito y error, estados de carga
- **Accesos rápidos** en la barra superior: alertas pendientes y cambio de modo visual

---

## 11. Matriz de Acceso por Rol

| Módulo / Funcionalidad | SUPERADMIN | ADMIN | EMPLEADO | CAJERO |
|---|:---:|:---:|:---:|:---:|
| Selección y gestión de locales | ✅ | — | — | — |
| Dashboard con métricas | ✅ | ✅ | — | — |
| POS: mesas y órdenes | ✅ | ✅ | ✅ | ✅ |
| Vista cocina | ✅ | ✅ | ✅ | ✅ |
| Inventario completo | ✅ | ✅ | — | — |
| Reportes de ventas | ✅ | ✅ | — | — |
| Flujo de caja y rendiciones | ✅ | ✅ | — | ✅ (parcial) |
| Alertas administrativas | ✅ | ✅ | — | — |
| Metas y bonos | ✅ | ✅ | — | — |
| Gestión de usuarios | ✅ | — | — | — |
| Tutorial interactivo | ✅ | ✅ | ✅ | ✅ |

---

*SibaGestion — Sistema de Gestión para Restaurantes*
