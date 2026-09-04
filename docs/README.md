# Documentación — Gestflow-Frontend

Índice de toda la documentación funcional y técnica del frontend web. Para desarrollo local, stack y estructura del proyecto, ver el [README de la raíz](../README.md).

```
docs/
├── proceso/       ← el proceso de venta, BPMN + técnico
├── manuales/      ← manuales de usuario por módulo
└── referencia/    ← documentación de features previa (no BPMN, no manual paso a paso)
```

## `proceso/` — Procesos de negocio (BPMN)

Cada documento sigue la misma estructura: descripción (objetivo/actores/precondiciones), diagrama BPMN en Mermaid, detalle técnico por actividad, errores, tabla de trazabilidad y brechas funcionales conocidas.

- **[proceso/PROCESO_VENTA.md](proceso/PROCESO_VENTA.md)** — el proceso de venta completo (mesas + mostrador + cobro efectivo/MercadoPago Point + descuento de stock). Vivo hoy en Backend V2. Documento espejo (recortado a lo que cada uno implementa) en `Gestflow-Backend-V2/docs/PROCESO_VENTA.md` (versión completa) y `GestFLow_APPMovil/docs/PROCESO_VENTA.md` (solo mostrador).
- **[proceso/PROCESO_CAJA_MP_PAIRING.md](proceso/PROCESO_CAJA_MP_PAIRING.md)** — cómo se vincula una caja con MercadoPago Point para poder cobrar con tarjeta. Vivo hoy en Backend V2.
- **[proceso/PROCESO_CAJA_APERTURA_CIERRE.md](proceso/PROCESO_CAJA_APERTURA_CIERRE.md)** — apertura de caja (implementada) y cierre/arqueo (⚠ construido en el backend, sin ningún botón en la UI hoy).
- **[proceso/PROCESO_COMPRAS_SEMANALES.md](proceso/PROCESO_COMPRAS_SEMANALES.md)** — órdenes de compra a proveedores. ⚠ Solo existe en el backend legacy — roto hoy contra Backend V2 (endpoint inexistente, sin fallback).
- **[proceso/PROCESO_RENDICIONES.md](proceso/PROCESO_RENDICIONES.md)** — gastos y transferencias con aprobación. ⚠ Apagado a propósito por feature flag (`rendiciones: false`) — solo funciona contra el backend legacy.

## `manuales/` — Manuales de usuario por módulo

Estilo manual de usuario (pasos concretos) con ficha técnica breve al final de cada pantalla. Cubren lo que hoy **no** tiene ninguna otra documentación:

- **[manuales/MANUAL_GESTOR_NEGOCIOS.md](manuales/MANUAL_GESTOR_NEGOCIOS.md)** — las 6 pantallas exclusivas de Superadmin (`/gestor/*`): franquicias, resumen global, detalle de negocio, auditoría, usuarios globales, observabilidad.
- **[manuales/MANUAL_RRHH.md](manuales/MANUAL_RRHH.md)** — módulo de Recursos Humanos (`/local/:localId/rrhh`): empleados, turnos, permisos — incluye quién puede hacer qué según el rol.
- **[manuales/MANUAL_POS_COMPLEMENTARIO.md](manuales/MANUAL_POS_COMPLEMENTARIO.md)** — Cocina (KDS), Reportes POS y Registrar producto rápido. Marca explícitamente qué pantallas están rotas hoy contra Backend V2.

Pendiente (fuera de este pase, ya tienen cobertura razonable en `referencia/`): Administración de local, Inventario, Usuarios de Owner.

## `referencia/` — Features e integración (documentación previa)

- **[referencia/FUNCIONALIDADES.md](referencia/FUNCIONALIDADES.md)** — listado de los módulos principales del sistema, a nivel de feature.
- **[referencia/FUNCIONALIDADES_SISTEMA.md](referencia/FUNCIONALIDADES_SISTEMA.md)** — descripción más detallada por módulo (Administración, Inventario, onboarding, etc.). Nota: atribuye la pantalla `/usuarios` al rol Superadmin — en el código real esa ruta es del Owner (`ADMIN_NEGOCIO`); la pantalla Superadmin equivalente es `/gestor/usuarios`, documentada en `manuales/MANUAL_GESTOR_NEGOCIOS.md`.
- **[referencia/INTEGRATION_BACKEND_V2.md](referencia/INTEGRATION_BACKEND_V2.md)** — notas de la migración del frontend hacia Backend V2 (adaptadores, endpoints, estado de la integración).

> El README raíz también enlaza a `docs/SEED_DATA.md` — ese archivo no existe todavía en el repo (link pendiente, no creado en este pase).
