# Tareas Security — de AUDITORIA_OWASP_2026-09-13.md (actualización 2026-09-16)

Formato Taiga. Origen: `docs/seguridad/AUDITORIA_OWASP_2026-09-13.md`, sección "Actualización 2026-09-16".

---

## [Seguridad] JWT de sesión viaja en la URL al conectar MercadoPago (frontend web) — ✅ RESUELTO 2026-09-16

**Problema:** el JWT de sesión completo viaja como query param en la URL que conecta MercadoPago, en vez de ir en un header.

**Evidencia:** `MPConfigDrawer.jsx:100` arma `${API_BASE}/api/mp-oauth/start?local_id=...&auth_token=${token}` y la abre con `window.open()`.

```js
const url = `${API_BASE}/api/mp-oauth/start?local_id=${encodeURIComponent(localId)}&auth_token=${encodeURIComponent(token)}`
```

**Por qué importa:** patrón clásico CWE-598 — URLs con datos sensibles en el query string quedan en logs de acceso del servidor, historial del navegador y como `Referer` hacia `auth.mercadopago.com`. Además ya no es solo teórico: el backend eliminó `GET /mp-oauth/start` (tombstone `410`) hace días exactamente por este motivo, así que hoy el flujo está roto en producción (410 Gone) además de seguir filtrando el JWT en cada intento.

**Qué hacer:** el reemplazo correcto ya existe en backend — `POST /mp-oauth/exchange` (Bearer) devuelve `authorization_url` lista para abrir. Migrar `MPConfigDrawer.jsx` a llamar ese endpoint vía `apiRequest()` (Bearer automático) y abrir la URL de la respuesta en vez de armarla a mano.

**Resuelto:** `handleOAuthConnect` en `MPConfigDrawer.jsx` ahora llama `apiRequest('/mp-oauth/exchange', {method:'POST', body:{local_id}})` y abre `authorization_url` de la respuesta — el JWT nunca sale al navegador. Removidos `getAuthContext`/`API_BASE`, sin uso. Rama `security/JWT-de-sesión-viaja-en-la-URL-al-conectar-MercadoPago`. Build + 132/132 tests OK, sin commitear (pendiente de tu revisión).

---

## [Seguridad] Tokens de sesión en localStorage (access_token + refresh_token) — 🟡 MITIGADO 2026-09-23

**Problema:** `access_token`/`refresh_token` se guardan en `localStorage` en vez de una cookie `HttpOnly`.

**Evidencia:** `src/lib/authClient.js:26-27,42,47`.

```js
if (access_token) window.localStorage.setItem(TOKEN_KEY, access_token)
if (refresh_token) window.localStorage.setItem(REFRESH_TOKEN_KEY, refresh_token)
```

**Por qué NO es urgente (pero sí importa):** hoy no hay un XSS conocido explotable en el repo (verificado: sin `dangerouslySetInnerHTML`/`eval`/`innerHTML=`), así que no es una fuga activa — es defensa en profundidad. Pero si algún día entra un XSS (propio o de una dependencia), el radio de daño es máximo: roba access **y** refresh token, sesión completa, no solo la ventana activa.

**Qué hacer:** Pablo define el fix correcto — migrar a cookies `HttpOnly`+`Secure`+`SameSite` es la solución de fondo, pero cruza backend (`Set-Cookie`, CORS) + frontend (`credentials:'include'`) + CSRF, así que amerita un ADR antes de tocar código. Mitigación intermedia sin ADR: sacar al menos el `refresh_token` de `localStorage`.

**Mitigado (sin ADR, fix de fondo con cookies sigue pendiente):** `refresh_token` ya no se persiste en `localStorage` — vive en una variable de módulo en memoria (`inMemoryRefreshToken`, `authClient.js`). `access_token`/`user` siguen en `localStorage` sin cambios (ese es el trade-off aceptado: XSS ya no roba refresh_token, pero sigue robando access_token de la ventana activa). Trade-off documentado: el refresh_token ya no sobrevive a un full reload ni se comparte entre pestañas (no había `storage`/`BroadcastChannel` sync previo, así que no es una regresión de una feature existente) — impacto acotado porque Backend V2 (activo) todavía no expone `/auth/refresh`. Cobertura nueva: `src/lib/authClient.test.js` (3 tests, afirman que `gestflow-refresh-token` nunca aparece en `localStorage`). Suite completa 135/135 + build OK. Pendiente real: el ADR de cookies `HttpOnly` sigue abierto, decisión de Pablo.

**Segunda capa (2026-09-23), CSP compensatoria:** agregada `Content-Security-Policy` vía `<meta>`, inyectada solo en build de producción (`vite.config.js`, plugin `csp-meta-tag`, `apply: 'build'` — el dev server de Vite inyecta sus propios `<script>` inline para HMR/Fast Refresh que esta CSP bloquearía, por eso queda fuera de dev). Política: `script-src 'self' '<hash del script inline de tema>'` (nada de script externo/inyectado sin ese hash exacto — cualquier XSS vía `<script src=...>` ajeno queda cortado), `style-src 'unsafe-inline'` (React/Tailwind/framer-motion escriben `style` inline en runtime, no hay forma barata de evitarlo sin refactor grande — el riesgo real está en `script-src`, no acá), `img-src`/`font-src`/`connect-src` acotados a los orígenes reales usados (Google Fonts, tiles de OpenStreetMap del mapa de sucursales, `data:` para avatares, backend `gestflow.mardev.cl`), `object-src 'none'`. Limitación conocida: `<meta>` no soporta `frame-ancestors`/`report-uri`/`sandbox` — eso sigue pendiente del hallazgo de headers de seguridad a nivel server (fuera de este repo). Verificado build+dev por separado (CSP solo en `dist/index.html`, dev server intacto) y suite 135/135.

---

## [Seguridad] Dependencias vulnerables — nanoid, postcss, vite — ✅ RESUELTO 2026-09-16

**Problema:** `npm audit --omit=dev` reportaba `nanoid` ≤3.3.17 (High), `postcss` ≤8.5.22 (High, path traversal/disclosure de `.map`), `vite` 8.0.0–8.0.15 (High, NTLMv2 hash disclosure + `server.fs.deny` bypass en Windows).

**Por qué NO era urgente:** los exploits requieren condiciones específicas que no se dan en este proyecto (dev server local expuesto, Windows) — no había evidencia de explotación activa. No bloqueaba release, pero no había excusa para no arreglarla: el fix no rompe nada.

**Resuelto:** `npm audit fix` (sin `--force`) → `nanoid` 3.3.19, `postcss` 8.5.28, `vite` 8.3.0. Solo tocó `package-lock.json`, `package.json` sin cambios (eran dependencias transitivas). Build (`npm run build`) y suite completa (`npx vitest run`, 132/132) OK después del bump.

---

## [Seguridad] react-router / react-router-dom — vulnerabilidad moderate, requiere salto de versión mayor — ✅ RESUELTO 2026-09-22

**Problema:** `react-router`/`react-router-dom` 6.0.0–7.17.0 (Moderate) — open redirect vía backslash en `<Link>`/`useNavigate` (bypass de CVE-2025-68470) + constructor injection en `deserializeErrors()` (SSR hydration).

**Corrección sobre el hallazgo original:** el reporte del 09-16 decía "sin salto de versión mayor" — es incorrecto. Se confirmó con `npm ls` que el proyecto ya está en `6.30.6` (la última de la serie 6.x) y sigue vulnerable: el parche real solo existe en `react-router-dom@7.18.4`. `npm audit fix` (sin `--force`) no lo toca; requiere `--force` (salto 6→7, breaking change de rutas/API).

**Resuelto (rama `feature/react-router-v7`):**
- Bump `react-router-dom` 6.30.6 → `react-router@7.18.4` directo en `package.json`. El código ya usaba la API v7 (`element`, `Navigate`, future flags) → sin cambios de rutas.
- Migrados los 30 imports de `react-router-dom` → `react-router` (en v7 es re-export; en v8 desaparece). `react-router-dom` eliminado del `package.json`.
- Eliminadas las future flags `v7_startTransition`/`v7_relativeSplatPath` (ya son default en v7).
- Verificación: suite 132/132 OK, `npm run build` OK, node v25 ≥ 20 y react 19 ≥ 18 (requisitos v7).

---

## [Seguridad] @vitest/mocker / vitest / @vitest/ui — path traversal (dev-only)

**Problema:** `@vitest/mocker` 2.1.0–4.1.10 (Moderate) — path traversal / arbitrary file read vía redirect de mocks. Arrastra a `vitest` y `@vitest/ui`.

**Por qué apareció ahora:** no estaba en el audit original porque ese corrió `npm audit --omit=dev` — es una devDependency (test runner), no viaja al bundle de producción.

**Por qué NO es urgente:** solo se ejecuta localmente/en CI corriendo tests, nunca en producción ni expuesto a un usuario final. Impacto acotado a la máquina de quien corre `npm test`/CI.

**Qué hacer:** correr `npm audit fix` cuando haya un patch disponible sin `--force` (todavía no lo hay al 2026-09-16); si demora, no bloquea nada — reevaluar en el próximo bump de rutina de devDependencies.

---

## [Seguridad] postMessage sin validar origen en MPConfigDrawer

**Problema:** el listener que recibe la confirmación del OAuth de MercadoPago no valida de dónde viene el mensaje.

**Evidencia:** `MPConfigDrawer.jsx:111-118,143` — `onMessage(e)` solo chequea `e.data.type`, nunca `e.origin` ni `e.source`.

```js
function onMessage(e) {
  if (!e.data || typeof e.data !== 'object') return
  if (e.data.type === 'mp_oauth_success') { finish(true) }
  ...
}
```

**Por qué NO es urgente:** cualquier origen puede postear `{type:'mp_oauth_success'}` y disparar `finish(true)`, pero eso solo dispara un toast de "cuenta conectada" (falso) y un `fetchAll()` de lectura contra el backend real — no ejecuta ninguna acción privilegiada ni usa datos del mensaje. Es spoof de UX, no toma de cuenta ni fuga de datos.

**Qué hacer:** en `onMessage`, chequear `e.origin` contra el origen esperado (`API_BASE`, que sirve el popup de `/mp-oauth/callback`) antes de procesar el mensaje.

---

## [Seguridad] Password inicial generada con Math.random()

**Problema:** la contraseña temporal que se le asigna a un usuario nuevo (empleado/admin) creado desde el panel se genera con un PRNG no criptográfico.

**Evidencia:** `UserManagementPage.jsx:32-34,77`, función `generatePassword()` (12 caracteres, `Math.random()`).

**Por qué NO es urgente:** es una password temporal pensada para cambiarse en el primer login, y para explotarla un atacante ya necesita acceso al panel de administración de usuarios — no está expuesta a usuarios externos ni anónimos.

**Qué hacer:** reemplazar `Math.random()` por `crypto.getRandomValues()` en `generatePassword()`.

---

## [Seguridad] Sin cabeceras de seguridad (CSP / X-Frame-Options / HSTS)

**Problema:** no hay `Content-Security-Policy`, `X-Frame-Options`, `X-Content-Type-Options` ni `Strict-Transport-Security` configurados en ningún lado del repo ni del deploy.

**Evidencia:** sin `vercel.json`/`netlify.toml`/`_headers`/config nginx en el repo; `index.html` y `.github/workflows/deploy.yml` no las setean. El deploy real es SSH+Tailscale a un servidor propio — no hay un CDN/hosting gestionado que las agregue "gratis" por detrás.

**Por qué NO es urgente:** no es una vulnerabilidad activa explotada hoy, es ausencia de hardening — pero tampoco hay ninguna capa invisible cubriéndolo como se podría suponer con un hosting gestionado.

**Qué hacer:** definir en qué capa van estas cabeceras (config del servidor propio que sirve el build) y aplicarlas ahí — no corresponde resolverlo dentro del SPA.

**Ver propuesta:** `docs/seguridad/PROPUESTA_HEADERS_NGINX.md` (2026-09-24) — bloque nginx listo, coordinado con backend, pendiente de aplicar en `root@100.89.15.17`.
