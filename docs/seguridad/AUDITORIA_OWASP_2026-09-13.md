# Auditoría de seguridad — OWASP Top 10 (Gestflow-Frontend)

**Fecha:** 2026-09-13
**Alcance:** repo `Gestflow-Frontend` (React SPA), rama `Develop`
**Metodología:** skill `security` (Aunaro) — reglas del sistema por flujo de confianza (identidad/sesión, dinero/webhooks, aislamiento de tenant, secretos, config), cruzadas con lecciones/ADRs de la bóveda Obsidian
**Fuentes revisadas:** `src/lib/authClient.js`, `src/lib/apiClient.js`, `src/routes/AuthenticatedRoutes.jsx`, `src/components/pos/MPConfigDrawer.jsx`, `npm audit`, `.github/workflows/deploy.yml`, `index.html`

---

## Resumen

| # | Hallazgo | OWASP | Severidad | Estado |
|---|---|---|---|---|
| 1 | JWT en query string hacia endpoint OAuth deprecado | A02:2021 (CWE-598) | Alta | 🟡 **En curso** — fix en rama separada, PR a `Develop` pendiente de aprobación |
| 2 | `access_token`/`refresh_token` en `localStorage` | A02:2021 | Media-Alta | 🔴 Abierto — requiere decisión de arquitectura (backend + frontend) |
| 3 | Dependencias vulnerables (`react-router-dom`, `postcss`, `vite`) | A06:2021 | Media-Alta | 🔴 Abierto — fix disponible sin breaking change |
| 4 | Sin cabeceras de seguridad (CSP, X-Frame-Options, HSTS) | A05:2021 | Media | 🔴 Abierto — corresponde a capa de hosting/CDN, no al SPA |

Sin hallazgos en: XSS vía `dangerouslySetInnerHTML`/`eval`, secretos commiteados (`.env` reales no están trackeados), `href` dinámico sin sanitizar.

---

## 1. [A02:2021-Cryptographic Failures] (CWE-598) — JWT en URL hacia endpoint deprecado

**Archivo:** `src/components/pos/MPConfigDrawer.jsx:100`

```js
const url = `${API_BASE}/api/mp-oauth/start?local_id=${encodeURIComponent(localId)}&auth_token=${encodeURIComponent(token)}`
```

**Impacto:** regresión de una vulnerabilidad ya corregida en el backend (ver lección `_Leccion-CWE598-nunca-jwt-en-url.md` en la bóveda). `GET /mp-oauth/start` fue eliminado (tombstone `410`) precisamente porque mandaba el JWT de sesión como query param — queda expuesto en logs de proxy, historial del navegador, y como `Referer` hacia `auth.mercadopago.com`. El reemplazo correcto ya existe en backend: `POST /mp-oauth/exchange` (`Authorization: Bearer`) devuelve `authorization_url` lista para abrir, sin que el JWT toque nunca la URL. Mientras este componente no migre, además de la exposición, la llamada probablemente falla en runtime (`410 Gone`).

**Estado:** ya identificado y en corrección — hay una rama separada con PR abierto contra `Develop`, todavía sin aprobar. No se aplica fix acá para evitar pisar ese trabajo; queda pendiente el merge de esa rama.

**Verificación una vez mergeado:** confirmar que la URL abierta en el popup de MercadoPago nunca contiene `auth_token=` ni ningún JWT, y que el flujo de conexión responde `200` en `/mp-oauth/exchange`.

---

## 2. [A02:2021-Cryptographic Failures] — Tokens de sesión en `localStorage`

**Archivo:** `src/lib/authClient.js:23-29`

```js
if (access_token) window.localStorage.setItem(TOKEN_KEY, access_token)
if (refresh_token) window.localStorage.setItem(REFRESH_TOKEN_KEY, refresh_token)
```

**Impacto:** cualquier XSS (propio o de una dependencia) lee `localStorage` y roba **access + refresh token** — toma de cuenta persistente, no limitada a la sesión activa. La regla del sistema exige cookies `HttpOnly`, `Secure`, `SameSite=Strict/Lax` en su lugar.

**Por qué no se aplica ahora:** migrar a cookies `HttpOnly` es un cambio cruzado backend+frontend — el backend debe emitir `Set-Cookie`, el frontend deja de mandar `Authorization: Bearer` y pasa a `credentials: 'include'`, y hace falta protección CSRF porque las cookies viajan solas con cada request. No es un fix de una línea; requiere una decisión explícita (ADR) antes de tocar código.

**Mitigación intermedia posible** (si no se migra ahora): evaluar sacar al menos el `refresh_token` de `localStorage` — es el de mayor duración y mayor blast radius.

---

## 3. [A06:2021-Vulnerable and Outdated Components]

`npm audit --omit=dev`:

| Paquete | Severidad | Issue | Fix |
|---|---|---|---|
| `react-router` / `react-router-dom` (6.0.0–7.17.0) | Moderate | Open redirect vía backslash en `<Link>`/`useNavigate`; constructor injection en `deserializeErrors()` (SSR hydration) | `npm audit fix` |
| `postcss` ≤8.5.22 | High | Path traversal / disclosure de `.map` vía `sourceMappingURL` con `from` sin definir | `npm audit fix` |
| `vite` 8.0.0–8.0.15 | High | `server.fs.deny` bypass en Windows; NTLMv2 hash disclosure vía `launch-editor` (rutas UNC) | `npm audit fix` |

Los tres tienen fix disponible sin salto de versión mayor (`npm audit fix`, sin `--force`).

---

## 4. [A05:2021-Security Misconfiguration] — Sin cabeceras de seguridad

No se encontró configuración de `Content-Security-Policy`, `X-Frame-Options`, `X-Content-Type-Options` ni `Strict-Transport-Security` en `index.html`, `.github/workflows/deploy.yml`, ni archivo de hosting (`vercel.json`/`netlify.toml`/config de nginx — ninguno existe en el repo). Corresponde configurarlo en la capa donde se sirve el build (hosting/CDN/reverse proxy), no en el SPA en sí.

---

## Sin hallazgos (verificado)

- No hay `dangerouslySetInnerHTML`, `eval()` ni `new Function()` en `src/`.
- Único `href` dinámico (`AdministrativeModule.jsx:194`) ya usa `rel="noopener noreferrer"` y apunta a una URL emitida por backend (`receipt_url`), no a input crudo de usuario.
- No hay archivos `.env` reales trackeados en git (solo `.env*.example`).
- El ruteo condicional por rol (`AuthenticatedRoutes.jsx`) es correctamente solo-UX — pero la autorización real la debe forzar el backend en cada endpoint (IDOR, `resource.user_id == current_user.id`). **No verificable desde este repo**; pendiente de confirmar contra el backend.

---

## Pendientes de decisión (para bóveda)

- **#2 (tokens en localStorage → cookies HttpOnly):** requiere ADR antes de implementar — impacta backend, CORS y necesita CSRF.
- Registrar en la bóveda cuando el PR del punto #1 se mergee, para cerrar el ciclo lección → decisión → journal.

---

## Actualización 2026-09-16 — Escaneo profundo (verificación + hallazgos nuevos)

**Metodología:** re-verificación de los 4 hallazgos de arriba contra el estado actual de `Develop`, más escaneo dirigido (postMessage/origin, XSS, open redirect, otros CWE-598, secretos hardcodeados, `.env` trackeados, logging sensible, `Math.random` en contexto de seguridad, autorización client-side vía JWT decodeado).

| # | Hallazgo | OWASP | Severidad | Estado |
|---|---|---|---|---|
| 1 | JWT en query string (`MPConfigDrawer.jsx:100`) | A02:2021 (CWE-598) | Alta | 🔴 **Confirmado, sigue abierto** — no existe la rama/PR que el reporte del 09-13 daba por "en curso" (sin coincidencias en `git branch -a` ni `git log --all --grep`). Doble falla ahora: filtra el JWT Y el flujo está roto en runtime (backend tombstoneó `/mp-oauth/start` → 410). |
| 2 | Tokens de sesión en `localStorage` (`src/lib/authClient.js:26-27,42,47`) | A02:2021 | Media-Alta | 🔴 Confirmado, sin cambios desde 09-13. |
| 3 | Dependencias vulnerables (`npm audit --omit=dev`) | A06:2021 | Media-Alta | 🔴 Confirmado y **ampliado**: `nanoid <=3.3.17` (High, nuevo — no estaba en el reporte 09-13), `postcss <=8.5.22` (High), `react-router`/`react-router-dom` 6.0.0–7.17.0 (Moderate, ahora 2 CVEs: open redirect bypass CVE-2025-68470 + constructor injection en SSR hydration), `vite` 8.0.0–8.0.15 (High: NTLMv2 hash disclosure vía `launch-editor` + `server.fs.deny` bypass en Windows). 5 vulnerabilidades (2 moderate, 3 high), todas con fix vía `npm audit fix` sin `--force`. |
| 4 | Sin cabeceras de seguridad | A05:2021 | Media | 🔴 Confirmado — sin `vercel.json`/`netlify.toml`/`_headers`/config nginx en el repo. Precisión sobre el reporte anterior: el deploy real (`.github/workflows/deploy.yml`) es SSH+Tailscale a un servidor propio, no un CDN/hosting gestionado — la responsabilidad de setear los headers recae en la config de ese servidor (fuera de este repo), no en una capa externa que "ya lo resuelva". |
| 5 | `postMessage` sin validar origen (`MPConfigDrawer.jsx:111-118,143`) | A05:2021 (CWE-346) | Baja-Media | 🆕 Nuevo. El listener `onMessage` (recibe `mp_oauth_success`/`mp_oauth_error` del popup de MercadoPago) no valida `event.origin` ni `event.source` — cualquier origen puede postear `{type:'mp_oauth_success'}` a esa ventana y disparar `finish(true)` (toast de éxito falso + `fetchAll()`). Impacto acotado: `fetchAll()` es una lectura contra el backend real, no ejecuta ninguna acción privilegiada con datos del mensaje — el riesgo es UX/social-engineering (spoof de "cuenta conectada"), no toma de cuenta. |
| 6 | Password inicial con `Math.random()` (`UserManagementPage.jsx:32-34,77`) | A02:2021 (CWE-338) | Media | 🆕 Nuevo. `generatePassword()` arma la contraseña inicial (12 chars) de usuarios nuevos (empleados/admins creados desde el panel) usando `Math.random()` — PRNG no criptográfico, predecible con suficientes muestras. Debe usar `crypto.getRandomValues()`. |

### Sin hallazgos (verificado en este escaneo)

- XSS: sin `dangerouslySetInnerHTML`, `eval()`, `new Function()` ni `.innerHTML =` en `src/`.
- Open redirect: único uso de `window.location` (`AuthContext.jsx:142`) usa `VITE_LOGIN_REDIRECT` (env de build), no input de usuario/URL — no explotable.
- Otras ocurrencias de CWE-598: sin más tokens en query string fuera de `MPConfigDrawer.jsx` (hallazgo #1).
- Secretos hardcodeados: sin coincidencias de `sk_live`/`sk_test`/`AIza...`/`-----BEGIN`/`api_key=`/JWT literal (`eyJ...`) en `src/`.
- `.env` trackeados en git: solo `*.example` con placeholders (`.env.example`, `.env.local.example`, `.env.db.example`) — sin secretos reales.
- Logging sensible: sin `console.log`/`error`/`warn` que impriman token/password/access_token/refresh_token, ni en `authClient.js`/`apiClient.js` ni en el resto de `src/`.
- CORS/fetch: sin `fetch(..., {credentials:'include'})` ni proxy inseguro en config de Vite.
- Script externo sin SRI: `index.html` solo carga una hoja de estilos de Google Fonts (no scripts de terceros) — no aplica.
- Autorización client-side vía JWT decodeado: `decodeJWT`/`getUserRole` (`src/utils/jwt.js`) se usan en `AuthContext.jsx` solo para estado de UI (label de rol, menú). No se encontró un caso donde una acción sensible se ejecute basada únicamente en el rol decodificado sin pasar por un endpoint. **No verificable al 100% desde este repo** si cada endpoint del backend reaplica la autorización — pendiente de contrastar contra Backend-V2 (ver nota ya existente arriba sobre IDOR/`resource.business_id`).

### Para crear como tareas Security (a partir de esta actualización)

1. Migrar `MPConfigDrawer.jsx` de `GET /mp-oauth/start?...auth_token=` a `POST /mp-oauth/exchange` (Bearer) + abrir `authorization_url` de la respuesta. (#1, Alta — bloqueante, además rompe el flujo en runtime) — **✅ Resuelto 2026-09-16**, ver detalle en `TAREAS_SECURITY_2026-09-16.md`.
2. `npm audit fix` para `nanoid`, `postcss`, `vite`. (#3, Media-Alta, sin breaking change) — **✅ Resuelto 2026-09-16**. `react-router`/`react-router-dom` quedó **pendiente aparte**: el fix real requiere salto de versión mayor 6→7 (`--force`), el reporte original decía "sin breaking change" y era incorrecto — corregido en `TAREAS_SECURITY_2026-09-16.md`. Nuevo hallazgo dev-only sumado: `@vitest/mocker`/`vitest`/`@vitest/ui` (Moderate, sin fix disponible aún).
3. Validar `event.origin` (contra `API_BASE`/origen del popup) en el listener de `MPConfigDrawer.jsx`. (#5, Baja-Media)
4. Reemplazar `Math.random()` por `crypto.getRandomValues()` en `generatePassword()` de `UserManagementPage.jsx`. (#6, Media)
5. ADR: migrar tokens de `localStorage` a cookies `HttpOnly`+`Secure`+`SameSite` (impacta backend + CSRF). (#2, Media-Alta, requiere decisión previa)
6. Definir dónde y cómo se setean cabeceras de seguridad (CSP/X-Frame-Options/HSTS) dado que el deploy es a servidor propio vía SSH, no CDN. (#4, Media)
