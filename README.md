# SibaGestion — Frontend

Sistema de gestión para restaurantes. Frontend React.

**Backend canónico (integración en curso):** [Gestflow-Backend-V2](../Gestflow-Backend-V2)  
Guía: [`docs/referencia/INTEGRATION_BACKEND_V2.md`](docs/referencia/INTEGRATION_BACKEND_V2.md) · rama `integration/backend-v2`

**Legacy (demo):** [API FastAPI INGSW2](../Delivery-Custom-App-INGSW2)

## Stack

| | |
|---|---|
| Framework | React 19 + Vite 8 |
| Router | React Router 6 |
| Auth | JWT emitido por Backend V2 (o legacy) |
| Charts | Recharts |
| Tests | Vitest + Testing Library |

## Módulos

| Módulo | Ruta | Roles |
|--------|------|-------|
| POS | `/local/:id/pos` | Cajero, Empleado, Admin, Admin Negocio, Superadmin |
| Inventario | `/local/:id/inventario` | Admin, Admin Negocio, Superadmin |
| Administrativo | `/local/:id/administrativo` | Admin, Admin Negocio, Superadmin (subset para workers) |
| RRHH | `/local/:id/rrhh` | Todos — pero solo Admin Negocio/Superadmin gestionan fichas/turnos; Admin y workers solo piden permisos (ver `docs/manuales/MANUAL_RRHH.md`) |
| Tus Locales | `/admin` | Admin Negocio (dueño de franquicia) |
| Gestor de Negocios | `/gestor/*` | Superadmin (ver `docs/manuales/MANUAL_GESTOR_NEGOCIOS.md`) |

## Roles

- **Superadmin** — plataforma completa, gestiona todos los negocios (`/gestor/*`)
- **Admin Negocio** (Owner) — dueño de una franquicia, gestiona sus locales y usuarios (`/admin`, `/usuarios`)
- **Admin** — gestiona un solo local asignado
- **Cajero** / **Empleado** — operan el POS y RRHH de su local asignado

## Desarrollo local (Backend V2)

```bash
# Terminal 1 — Backend V2
cd ../Gestflow-Backend-V2
docker compose up -d
uvicorn app.main:app --reload --port 8000

# Terminal 2 — Frontend
cp .env.local.example .env.local   # VITE_API_URL=http://localhost:8000
npm run dev
```

Login seed V2: `admin@gestflow.dev` / `admin123`

### Con Docker (legacy / Postgres del frontend)

```bash
cp .env.db.example .env.db
docker compose --env-file .env.db up -d postgres
# DATABASE_URL para el backend: postgresql://gestflow:gestflow_dev_password@localhost:5432/gestflow
```

El volumen `gestflow_postgres_data` conserva los datos aunque el contenedor se reinicie o se recree.

Comandos utiles:

```bash
docker compose --env-file .env.db ps
docker compose --env-file .env.db logs -f postgres
docker compose --env-file .env.db down
docker compose --env-file .env.db down -v # borra tambien el volumen de datos
```

Luego levanta el backend apuntando a `DATABASE_URL` y el frontend con:

```bash
npm install
npm run dev
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

Ver `docs/SEED_DATA.md` para instrucciones de carga de datos de prueba — **archivo pendiente, no existe todavía en el repo**.

## Documentación

Toda la documentación funcional y técnica vive en [`docs/`](docs/) — ver [docs/README.md](docs/README.md) para el índice completo (proceso de venta BPMN, manuales por módulo, guía de integración con Backend V2).
