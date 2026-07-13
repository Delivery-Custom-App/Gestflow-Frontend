# SibaGestion — Frontend

Sistema de gestión para restaurantes. Frontend React que consume la [API FastAPI](../Delivery-Custom-App-INGSW2).

## Stack

| | |
|---|---|
| Framework | React 19 + Vite 8 |
| Router | React Router 6 |
| Auth | JWT emitido por backend local |
| Charts | Recharts |
| Tests | Vitest + Testing Library |

## Módulos

| Módulo | Ruta | Roles |
|--------|------|-------|
| POS | `/local/:id/pos` | Cajero, Empleado, Admin, Superadmin |
| Inventario | `/local/:id/inventario` | Admin, Superadmin |
| Administrativo | `/local/:id/administrativo` | Admin, Superadmin |
| Gestión de Locales | `/admin` | Admin, Superadmin |

## Roles

- **Superadmin** — acceso total, gestión de negocios y locales
- **Admin** — gestión de su negocio (inventario, reportes, staff)
- **Cajero** — POS, órdenes, caja
- **Empleado** — POS, órdenes

## Desarrollo local

### Con Docker (recomendado)

Desde el repo backend:

```bash
.\scripts\docker-dev-up.ps1
# Frontend: http://localhost:5173
# API:      http://localhost:8000
# Docs API: http://localhost:8000/api/docs
```

### Sin Docker

```bash
# Requiere backend corriendo en :8000
npm install
npm run dev
```

> **Importante:** Si cambias de rama (`main` ↔ `develop`), vuelve a ejecutar `npm install`
> porque las dependencias pueden variar entre ramas.

#### Variables de entorno

Crea un archivo `.env.local` en la raíz del frontend (no existe por defecto, no se sube al repo):

```env
VITE_API_URL=http://localhost:8000
VITE_RECETAS_API_URL=http://localhost:8000
```

> No uses `.env.example` — no existe en este repo. Crea `.env.local` directamente.

#### Dependencias extra (rama `develop`)

La rama `develop` incluye paquetes que no estaban en `main`. Si `vite` lanza errores de import al iniciar, ejecuta:

```bash
npm install usehooks-ts framer-motion
```

Estos ya están declarados en `package.json` de `develop`; el error ocurre solo si instalaste
`node_modules` estando en `main` y luego cambiaste de rama sin reinstalar.

## Tests

```bash
npm test              # watch mode
npm run test:ui       # UI visual (Vitest)
npm run test:coverage # cobertura
```

## Estructura

```
src/
├── components/
│   ├── pos/          # POS, mesas, órdenes
│   ├── inventory/    # Stock, recetas, proveedores, compras
│   └── charts/       # Recharts wrappers
├── hooks/            # Data fetching (useEffect + apiClient)
├── lib/
│   ├── apiClient.js  # Fetch wrapper: auth, retry 401, error parsing
│   ├── authClient.js
│   ├── inventoryApi.js
│   ├── administrativeApi.js
│   └── weeklyPurchasesApi.js
└── styles/           # CSS por módulo
```

## Auth flow

1. Login vía backend local → JWT con `role` y `business_id`
2. `apiClient.js` inyecta el token en cada request (`Authorization: Bearer ...`)
3. En 401, refresca sesión automáticamente y reintenta
4. Backend (`deps.py`) extrae rol del JWT y aplica RBAC

## Seed data para pruebas

Ver [docs/SEED_DATA.md](./docs/SEED_DATA.md) para instrucciones de carga de datos de prueba.
