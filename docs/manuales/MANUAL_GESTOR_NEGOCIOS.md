# Manual — Gestor de Negocios (Superadmin)

> **Última actualización:** 2026-09-03 — MrCasuela
> (actualizar esta línea cada vez que se edite el documento)

> **A quién sirve:** este módulo es exclusivo del rol **Superadmin** — la persona que administra la plataforma GestFlow completa (todas las franquicias/negocios). Un dueño de franquicia (Owner) o un administrador de un local no ven ninguna de estas pantallas.
>
> **Ruta base:** `/gestor/*`. Cuando entrás a la app como Superadmin, siempre aterrizás acá — no hay "locales operativos" para este rol.
>
> Backend: **Gestflow-Backend-V2**. Endpoints principales en `app/api/routes/businesses.py`, `app/api/routes/audit.py`, `app/api/routes/tenant_manager.py`, `app/api/routes/users.py`.

---

## 1. Listado de negocios (`/gestor`)

**Qué es:** la pantalla principal del Superadmin — la lista de todas las franquicias (negocios/tenants) registradas en la plataforma.

**Cómo se usa:**
1. Al entrar, ves la lista completa de franquicias con su nombre, RUT, plan (Standard/Professional/Enterprise) y si está activa o suspendida.
2. **Crear una franquicia nueva:** hacé click en el botón de "Nueva franquicia" — se abre un panel lateral donde completás nombre, RUT y plan, y confirmás con "Crear franquicia".
3. **Editar una franquicia:** abrí el mismo panel sobre una franquicia existente para cambiar su nombre, RUT, plan o estado activo/inactivo.
4. **Suspender / reactivar:** desde la lista, podés suspender una franquicia (sus usuarios no podrán iniciar sesión hasta que la reactives) o reactivarla — se pide confirmación antes de aplicar el cambio.
5. **Eliminar:** borra la franquicia y todos sus datos asociados — acción irreversible, se pide confirmación explícita.

**Ficha técnica:** componente `src/components/TenantManagerPage.jsx`. Endpoints: `GET/POST /businesses`, `PATCH /businesses/{id}` (editar, suspender/reactivar), `DELETE /businesses/{id}`. Datos: `name`, `rut`, `plan` (`starter`=Standard, `professional`, `enterprise`), `is_active`.

---

## 2. Resumen consolidado (`/gestor/resumen`)

**Qué es:** un dashboard con los números globales de toda la plataforma — cuántas franquicias, usuarios, locales y órdenes hay, y cuánto se ha facturado.

**Cómo se usa:** es una pantalla de solo lectura. Mirá las tarjetas KPI arriba (franquicias activas, usuarios totales, locales, órdenes, ingresos históricos e ingresos del mes) y más abajo dos gráficos de barras: órdenes por estado, y usuarios por rol. Desde acá podés volver al listado de franquicias con el enlace "Ver franquicias".

**Ficha técnica:** componente `src/components/TenantManagerDashboardPage.jsx`. Endpoint: `GET /businesses` con datos agregados vía `getGlobalStats` (`v2SuperAdminAdapter.js`).

---

## 3. Detalle de un negocio (`/gestor/negocios/:businessId`)

**Qué es:** la ficha completa de una franquicia puntual — sus locales, sus estadísticas de ventas, y controles de administración.

**Cómo se usa:**
1. Entrás a esta pantalla haciendo click en una franquicia desde el listado (`/gestor`).
2. Arriba ves el nombre, plan, RUT, fecha de creación y estado (activa/suspendida), con un botón para suspender/reactivar.
3. Más abajo, la lista de **locales** de esa franquicia — para cada uno podés cambiar su **modo de venta** (`RESTAURANT` con mesas, o `AL_PASO` de mostrador) desde un selector. Este es el mismo `sales_model` que determina qué camino de venta usa el POS de ese local (ver [`../proceso/PROCESO_VENTA.md`](../proceso/PROCESO_VENTA.md)).
4. Un enlace directo a "Ver auditoría global" filtrada por esta franquicia.

**Ficha técnica:** componente `src/components/TenantDetailPage.jsx`. Endpoints: `GET /businesses/{id}` (stats), `GET /locals?business_id=`, `PATCH /businesses/{id}` (suspender/reactivar), `PATCH /locals/{id}` con `sales_model` (cambiar modo de venta).

---

## 4. Auditoría global (`/gestor/auditoria`)

**Qué es:** el registro histórico de acciones administrativas sobre toda la plataforma — quién creó, editó o eliminó una franquicia, y quién cambió el rol o el estado de un usuario.

**Cómo se usa:** filtrá por franquicia (selector) o buscá por usuario/franquicia/acción (campo de búsqueda). La lista muestra, para cada evento: qué acción fue, quién la hizo y cuándo. Se pagina de a 50 eventos.

**Ficha técnica:** componente `src/components/GlobalAuditPage.jsx`. Endpoint: `GET /audit` (con `business_id`, `limit`, `offset`). Acciones registradas: creación/actualización/eliminación/suspensión/reactivación de franquicia, alta/actualización/cambio de rol/desactivación/reactivación de usuario.

> Nota: la pantalla puede mostrar un aviso amarillo si el flag `superAdminAudit` (`src/lib/v2Features.js`) está apagado — el endpoint existe en el backend, pero el flag controla si el frontend confía en que los datos ya están completos.

---

## 5. Usuarios globales (`/gestor/usuarios`)

**Qué es:** gestión de usuarios de **toda la plataforma**, no de una franquicia en particular. Distinto de la pantalla `/usuarios` que ve el Owner (esa es solo para los usuarios de su propia franquicia — ver la nota de alcance en [`../referencia/FUNCIONALIDADES_SISTEMA.md`](../referencia/FUNCIONALIDADES_SISTEMA.md), que atribuye esa ruta al Superadmin por error; en el código real `/usuarios` es del Owner y `/gestor/usuarios` es la del Superadmin).

**Cómo se usa:**
1. Filtrá por franquicia o por rol, o buscá por email/nombre/franquicia.
2. La lista se separa en dos tablas: **Administradores** (SUPERADMIN, ADMIN_NEGOCIO, ADMIN) y **Empleados** (el resto).
3. Para cada usuario (salvo otros SUPERADMIN, que no se pueden editar desde acá) podés **cambiar su rol** con el selector (ADMIN_NEGOCIO, ADMIN, EMPLEADO) o **activar/desactivar** su cuenta con el botón de acción. No podés desactivarte a vos mismo.

**Ficha técnica:** componente `src/components/AdminUsersPage.jsx`. Endpoints: `GET /users` (filtrado), `PATCH /users/{id}` (cambiar `role` o `is_active`).

---

## 6. Observabilidad (`/gestor/observabilidad`)

**Qué es:** métricas técnicas de uso de la API — qué tan rápido responde cada endpoint y cuántos errores está teniendo, por tenant o para toda la plataforma.

**Cómo se usa:** filtrá por tenant con el selector, o mirá "Plataforma" para el tráfico agregado. Arriba hay 3 números: endpoints, peticiones totales y errores 5xx. Más abajo, una tabla de tráfico por tenant, y una lista de latencia por endpoint (promedio y p95, con una barra de color: verde <100ms, ámbar <300ms, rojo ≥300ms). Botón "Refrescar" para actualizar sin recargar la página.

**Ficha técnica:** componente `src/components/ObservabilityPage.jsx`. Endpoint: `GET /observability` (`app/api/routes/tenant_manager.py`). Estas métricas son **en memoria del proceso backend** — se reinician cada vez que el servicio se reinicia, no son históricas.

> Nota: igual que Auditoría, puede mostrar un aviso si el flag `superAdminObservability` está apagado.

---

## Errores comunes

| Situación | Qué ves | Qué hacer |
|---|---|---|
| Nombre o RUT vacío al crear/editar franquicia | Mensaje en rojo dentro del panel: "El nombre de la franquicia es obligatorio" / "El RUT es obligatorio" | Completá el campo faltante |
| Error al guardar/cargar cualquier pantalla | Recuadro rojo con el detalle del error devuelto por el backend | Reintentar; si persiste, puede ser un problema de conexión o de permisos |
| Suspender/eliminar franquicia | Se pide confirmación explícita antes de aplicar — no hay "deshacer" para eliminar | Confirmá solo si estás seguro; suspender sí se puede revertir reactivando |

---

## Referencias de archivo

- `src/components/TenantManagerPage.jsx`, `TenantManagerDashboardPage.jsx`, `TenantDetailPage.jsx`, `GlobalAuditPage.jsx`, `AdminUsersPage.jsx`, `ObservabilityPage.jsx`
- `src/lib/superAdminApi.js` — capa de adaptación hacia Backend V2.
- `src/lib/v2Features.js` — flags `superAdminAudit`, `superAdminObservability`.
- Backend (`Gestflow-Backend-V2`): `app/api/routes/businesses.py`, `audit.py`, `tenant_manager.py`, `users.py`, `locals.py`.
