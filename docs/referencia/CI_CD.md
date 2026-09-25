# CI/CD — Frontend

Pipeline en [`.github/workflows/deploy.yml`](../../.github/workflows/deploy.yml). Corre en GitHub Actions.

## Resumen del flujo

```
PR/push → job "test" (lint diff + tests + cobertura + build)
                │
                ▼ (solo si pasa, y solo en push/dispatch sobre main)
          job "deploy" (build + rsync vía Tailscale al servidor)
```

## Disparadores (`on:`)

- `pull_request` hacia `main` → corre el job `test` (gate del PR).
- `push` a `main` → corre `test` y, si pasa, `deploy`.
- `workflow_dispatch` → permite relanzar el pipeline a mano desde la pestaña Actions (útil para reintentar un deploy sin hacer un commit nuevo), y también dispara el deploy manual a `exemfoam.cl` (ver más abajo). Tiene 3 inputs:
  - `target`: `gestflow` (default), `exemfoam` o `both` — a qué destino(s) deployar.
  - `exemfoam_remote_path`: carpeta remota del FTP de exemfoam.cl (default `./`).
  - `exemfoam_dry_run`: `true` (default) — simula el FTP deploy sin subir nada. Poner en `false` recién cuando se confirme que `exemfoam_remote_path` es la carpeta correcta.

## Job `test`

1. `npm ci`
2. **Lint de archivos modificados (bloqueante)**: calcula el diff contra la base del PR (o el commit anterior en push) y corre `eslint` solo sobre los `.js`/`.jsx` tocados. Si el PR toca un archivo con errores de lint, el pipeline falla.
3. **Lint completo (informativo)**: corre `npm run lint` sobre todo el repo con `continue-on-error: true`. No bloquea nada — es un radar de la deuda de lint que todavía existe en archivos no tocados.
4. **Tests con cobertura**: `npx vitest run --coverage`. Falla si la cobertura cae bajo los umbrales definidos en `vitest.config.js` (`lines: 40`, `branches: 35`).
5. **Build**: `npm run build`, para detectar errores de build antes de llegar a producción.

## Job `deploy`

Depende de que `test` haya pasado (`needs: test`) y solo corre si el evento es `push` a `main` o `workflow_dispatch`.

1. Build de nuevo (entorno limpio del runner de deploy).
2. Se conecta a la tailnet de Tailscale de GestFlow — el servidor de producción no tiene IP pública, solo es alcanzable ahí.
3. Carga la SSH key de deploy y espera a que la ruta de tailnet y el host SSH estén listos (con reintentos, porque justo después de levantar Tailscale puede no estar disponible aún).
4. Hace un backup remoto (`tar`) del directorio actual antes de tocar nada.
5. Sincroniza `dist/` al servidor con `rsync --delete` (necesario porque Vite hashea los assets por contenido; sin `--delete` los chunks viejos se acumulan para siempre).
6. Health check contra `https://gestflow.mardev.cl`.

Tiene `concurrency` con `cancel-in-progress: false`: si se dispara dos veces, los deploys se encolan en vez de pisarse.

## Job `deploy-exemfoam` (manual)

Deploy aparte, **solo manual** (`workflow_dispatch` con `target: exemfoam` o `both`) — no se dispara con push ni PR. Es un hosting cPanel distinto (`exemfoam.cl`) sin Tailscale/SSH, así que el deploy es por FTP:

1. `npm ci` + `npm run build` (mismo build que el resto del pipeline).
2. Sube `dist/` por FTP con [SamKirkland/FTP-Deploy-Action](https://github.com/SamKirkland/FTP-Deploy-Action) a la carpeta indicada en el input `exemfoam_remote_path`.
3. Corre en modo `dry-run` por defecto (no sube nada, solo muestra qué haría) hasta que se confirme cuál es la carpeta remota correcta del hosting.

Credenciales en el **Environment `exemfoam`** de GitHub (Settings → Environments), separadas de las de producción: `EXEMFOAM_FTP_SERVER`, `EXEMFOAM_FTP_USERNAME`, `EXEMFOAM_FTP_PASSWORD`.

### Cómo lanzarlo

1. Pestaña **Actions** → workflow **CI/CD** → **Run workflow**.
2. `target`: `exemfoam`.
3. `exemfoam_remote_path`: la carpeta remota (confirmar en el panel de control del hosting — típicamente `public_html` o `./` si el usuario FTP ya está *jailed* ahí).
4. Primera vez: dejar `exemfoam_dry_run` en `true` y revisar el log del step "Deploy por FTP a exemfoam.cl" para confirmar que la carpeta es la correcta antes de poner `false`.

## Branch protection en `main`

Configurada a nivel de repo (GitHub → Settings → Branches), no en el workflow:

- El check `test` debe estar en verde y la rama debe estar actualizada con `main` (`strict: true`) para poder mergear un PR.
- Se requiere al menos **1 aprobación** de otro colaborador (`required_approving_review_count: 1`), y una review vieja se descarta si se sube un commit nuevo (`dismiss_stale_reviews: true`).
- La regla aplica también a administradores (`enforce_admins: true`) — nadie puede mergear sin pasar el gate.
- No se permite `force-push` ni borrar la rama `main`.

## Decisiones y por qué

| Decisión | Motivo |
|---|---|
| Lint bloqueante solo en archivos tocados por el PR, no en todo el repo | Al momento de activar esta regla (2026-09-22) había **102 errores** de lint preexistentes en el repo. Bloquear todo el repo de una habría roto el pipeline para cualquier PR sin relación con esa deuda. Se migra gradualmente: cada archivo que alguien toca queda limpio, sin frenar el resto del trabajo. |
| Umbral de cobertura en 40% líneas / 35% branches | La cobertura real al momento de configurar esto era ~45%/38%. El piso se puso levemente por debajo de la base real para no romper el pipeline el mismo día, pero sí evitar que la cobertura empeore con código nuevo sin tests. Se puede subir el umbral progresivamente a medida que se agregan tests. |
| Lint completo se corre igual, pero no bloqueante | Sirve como visibilidad de la deuda total (queda en el log de cada run) sin frenar PRs que no la tocan. |
| Branch protection con 1 aprobación + check `test` obligatorio | Antes no había ninguna regla — un PR podía mergearse a `main` aunque el check de tests estuviera en rojo. Ahora el merge queda bloqueado hasta que el pipeline pase y alguien más lo revise. |
| `enforce_admins: true` | Para que la regla no tenga una puerta trasera — si un admin necesita saltarla en una emergencia, debe desactivar la protección explícitamente (visible en el audit log de GitHub), no simplemente ignorarla. |

## Pendiente (fuera de alcance de este cambio)

- **Tests E2E** (Playwright/Cypress): no hay ningún framework instalado todavía. Se decidió dejarlo para una iteración siguiente porque es una integración nueva de mayor tamaño (instalar el framework, definir qué flujos cubrir — login, POS, inventario — y correrlos contra un build levantado en el runner), no un ajuste de configuración como el resto de estos cambios.
- **Ambiente de staging para `Develop`**: hoy el pipeline solo reacciona a `main`. No hay deploy automático para la rama de desarrollo.
- **Deuda de lint preexistente**: quedan ~94 errores en archivos no tocados por este cambio. Se irán limpiando a medida que cada PR toque esos archivos (por el gate de "solo archivos modificados").
  - Nota: durante esta auditoría se encontró un bug real (no solo lint) en `src/hooks/useAlerts.js` — `openSSE` se referencia a sí misma antes de estar declarada dentro de su propio `useCallback`, lo que puede afectar el reintento de la conexión SSE de alertas. Quedó como tarea separada, no se corrigió en este cambio de CI/CD.

## Guía de uso para desarrollo

### Si vas a tocar `package.json`/`package-lock.json` (agregar o actualizar una dependencia)

Usá **npm 10.9.2** localmente antes de commitear el lockfile — es la versión fijada en el workflow (steps "Fijar versión de npm"), que corresponde a la que trae Node 20 en el runner de GitHub Actions. `npm ci` es estricto entre versiones de npm para paquetes opcionales por plataforma (ej. `@emnapi/*`, usados por lightningcss/Tailwind): un lockfile escrito con una versión de npm distinta puede fallar en CI con `Missing: X from lock file` aunque el lockfile sea perfectamente válido y funcione en tu máquina. Esto ya pasó una vez (2026-09-22, ver PR #50) al generar el lockfile con npm 11.

Para verificar antes de subir:
```bash
npm install -g npm@10.9.2   # una vez, o usá nvm/corepack para alternar
rm -rf node_modules
npm ci                      # debe terminar sin errores, igual que en CI
```

### Si tu PR falla en el check `test`

1. **Falla el step "Lint de archivos modificados"**: corré `npx eslint <archivo>` localmente sobre los archivos que tocaste y corregí los errores. No podés mergear con este check en rojo.
2. **Falla "Run tests (con cobertura)"**:
   - Si es un test roto: `npx vitest run` localmente para reproducir y arreglarlo.
   - Si es el umbral de cobertura: agregá tests para el código nuevo que agregaste. Corré `npm run test:coverage` localmente para ver el detalle por archivo.
3. **Falla "Build"**: `npm run build` localmente reproduce el error (típicamente un import roto o un error de sintaxis que vitest no detecta).

### Cómo mergear a `main`

1. Abrí un PR contra `main`. El check `test` corre automático.
2. Esperá a que el check esté en verde **y** consigas 1 aprobación de otro colaborador — GitHub no deja mergear sin ambas cosas.
3. Al mergear (o hacer push directo a `main`, si tuvieras permiso para saltarte el PR), se dispara el job `deploy` automáticamente. No hay que hacer nada manual.

### Relanzar un deploy sin hacer un commit nuevo

Si el deploy falló por una causa transitoria (ej. la tailnet no estaba lista) y el código en `main` ya es el correcto:

1. Ir a la pestaña **Actions** del repo en GitHub.
2. Seleccionar el workflow **CI/CD** → **Run workflow** (`workflow_dispatch`).
3. Elegir la rama `main` y ejecutar. Va a correr `test` y, si pasa, `deploy` de nuevo.

### Si el CI está caído y hay que deployar sí o sí

Usar [`deploy.sh`](../../deploy.sh) desde tu máquina — hace el mismo build + backup + rsync que el job `deploy`, pero corriendo local. Requiere acceso SSH al servidor (`root@100.89.15.17`) vía la tailnet de GestFlow.

### Secrets requeridos (GitHub → Settings → Secrets and variables → Actions, environment `production`)

- `TS_AUTHKEY` — auth key de Tailscale para que el runner se conecte a la tailnet.
- `DEPLOY_SSH_KEY` — clave privada SSH con acceso a `root@100.89.15.17`.

Ninguno de estos secrets es visible en logs ni en el código; están inyectados por GitHub Actions al momento de correr el job `deploy`.
