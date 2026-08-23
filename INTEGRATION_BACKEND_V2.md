# Integración Frontend ↔ GestFlow Backend V2

Rama: `integration/backend-v2`  
Backend: repo `Gestflow-Backend-V2` (FastAPI + RLS, puerto **8000**).

## Objetivo

Conectar el frontend (antes apuntado a INGSW2 legacy) al Backend V2 canónico,
empezando por **auth** y luego módulos (catálogo, ventas, POS, HR).

## Arranque local

### 1. Backend V2

```bash
cd Gestflow-Backend-V2
docker compose up -d
python -m scripts.apply_schema --drop   # solo primera vez / reset
python -m scripts.seed_superadmin
uvicorn app.main:app --reload --port 8000
```

Credencial seed: `admin@gestflow.dev` / `admin123`

### 2. Frontend

```bash
cd Delivery-Custom-App-Fronend
git checkout integration/backend-v2
cp .env.local.example .env.local
npm run dev
```

Abre http://localhost:5173 y logueate con el seed del V2.

## Compatibilidad auth (ya aplicada en esta rama)

| Legacy INGSW2 | Backend V2 |
|---|---|
| Login con `session.user` embebido | `{ access_token }` + `GET /api/auth/me` |
| `/auth/refresh` | No existe aún — se reutiliza el access JWT |
| `/auth/logout` | No existe aún — logout solo limpia localStorage |
| User con `app_metadata.role` | User plano `{ id, email, role, business_id, local_id }` |
| Health `/api/health` | `/health` |

Cambios clave: `src/lib/authClient.js`, `src/utils/jwt.js`, `NetworkErrorModal`.

## Qué falta (próximos PRs en esta rama)

1. Mapear clientes API (`inventoryApi`, `administrativeApi`, POS, etc.) a rutas V2
2. Flujos que aún dependen de endpoints legacy (printers, split-payments, alerts SSE, register)
3. Roles UI: `EMPLEADO` / `ADMIN` / `ADMIN_NEGOCIO` / `SUPERADMIN` ya formatean bien vía `formatRoleLabel`
4. Conectar POS/ventas al modelo V2 (`cajas`, `orders`, `pos-machines`)

## Notas

- Postgres V2: `localhost:5436` (no confundir con INGSW2 en 5433).
- CORS V2: `http://localhost:5173` en `Gestflow-Backend-V2` `.env` / defaults.
- No mezclar `VITE_API_URL` apuntando a INGSW2 mientras se trabaja en esta rama.
