# Propuesta: cabeceras de seguridad en nginx (CSP / X-Frame-Options / HSTS / nosniff)

**Fecha:** 2026-09-24
**Referencia:** hallazgo #4 de `AUDITORIA_OWASP_2026-09-13.md` (A05:2021, Media) y ticket `[Seguridad] Sin cabeceras de seguridad` en `TAREAS_SECURITY_2026-09-16.md`.
**Estado:** propuesta lista, **pendiente de aplicar en servidor** (fuera de este repo) — requiere acceso SSH a `root@100.89.15.17`.

## Por qué esto no vive en el repo

No hay `vercel.json`/`netlify.toml`/`_headers`/config nginx en `Gestflow-Frontend`. El deploy real es `rsync dist/` vía SSH+Tailscale a un servidor propio (ver `docs/referencia/CI_CD.md`), sin CDN gestionado que agregue headers por detrás. Las cabeceras HTTP reales (`X-Frame-Options`, `Strict-Transport-Security`) no se pueden setear desde un meta tag en `index.html` — tienen que salir del servidor que sirve las respuestas.

## Coordinación con backend

Sesión de `Gestflow-Backend-V2` reportó el mismo hallazgo (#5 de su reporte de seguridad) y preguntó si el mismo nginx sirve ambos repos. Confirmado desde este lado: `VITE_API_URL=https://gestflow.mardev.cl` en producción, y `apiClient.js`/`authClient.js` arman las URLs como `${VITE_API_URL}/api/<path>` — **mismo dominio, mismo servidor (`100.89.15.17`)**.

**Actualización 2026-09-24:** backend resolvió su parte por código, no por nginx — `SecurityHeadersMiddleware` (mergeado, tests en `tests/test_security_headers.py`) manda los 4 headers en toda respuesta del backend, con `/mp-oauth/callback` usando CSP propia con nonce por request (`script-src 'nonce-...'`, necesario por el JS inline del popup). Hallazgo #5 backend ya está ✅ resuelto.

**Consecuencia para este bloque nginx:** el proxy `/api` y `/mp-oauth/callback` **NO deben llevar `add_header` de estos headers en nginx** — el backend ya los manda por respuesta, y si nginx también los setea vía `add_header` el browser puede terminar con dos `Content-Security-Policy` en la misma respuesta (se intersectan, comportamiento impredecible). El bloque completo de headers queda **solo para `location /`** (la SPA), que es la única pieza sin cubrir.

## Qué necesita este CSP concretamente

Investigado contra el código real de `src/`, no genérico:

| Recurso | Origen | Directiva CSP |
|---|---|---|
| API propia (`apiClient.js`, `authClient.js`, `recetasApiClient.js`) | mismo origen (`/api/*`) | `connect-src 'self'` |
| SSE de alertas (`useAlerts.js:97`, `EventSource`, no WebSocket) | mismo origen (`/api/alerts/stream`) | cubierto por `connect-src 'self'` |
| OAuth MercadoPago (`MPConfigDrawer.jsx`) | `window.open()` a popup externo, no iframe | no afecta `connect-src`/`frame-src` |
| Tiles de mapa (`FranchisesMap.jsx`) | `https://{a,b,c}.tile.openstreetmap.org` | `img-src` |
| Geocoding (`CreateLocalDrawer.jsx`) | `https://nominatim.openstreetmap.org` | `connect-src` |
| CSS de fuentes (`index.html`) | `https://fonts.googleapis.com` | `style-src` |
| Archivos de fuente | `https://fonts.gstatic.com` | `font-src` |

No hay `Route`/react-router en `App.jsx` (render condicional de una sola página) — el fallback SPA de nginx (`try_files ... /index.html`) debe cubrir todo lo que no sea `/api`.

## Bloque nginx

nginx no hereda `add_header` de `server` a `location` si el `location` define los suyos propios. Eso ya no es un problema acá: el bloque de headers va **únicamente en `location /`** — `/api` y `/mp-oauth/callback` los recibe el backend ya puestos por su middleware, nginx solo debe proxear sin tocarlos.

```nginx
# /etc/nginx/snippets/security-headers.conf
add_header X-Frame-Options "DENY" always;
add_header X-Content-Type-Options "nosniff" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
```

HSTS sin `preload` al inicio — `preload` es difícil de revertir (requiere remover el dominio de la preload list de los browsers), agregar después si todo queda estable en HTTPS.

```nginx
server {
  server_name gestflow.mardev.cl;

  # --- SPA estática (Gestflow-Frontend) ---
  location / {
    include snippets/security-headers.conf;
    add_header Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data: https://a.tile.openstreetmap.org https://b.tile.openstreetmap.org https://c.tile.openstreetmap.org; connect-src 'self' https://nominatim.openstreetmap.org; object-src 'none'; base-uri 'self'; frame-ancestors 'none'" always;

    root /var/www/delivery-frontend;
    try_files $uri $uri/ /index.html;
  }

  # --- API y /mp-oauth/callback (Gestflow-Backend-V2, proxy) ---
  # NO agregar add_header de CSP/X-Frame-Options/HSTS/nosniff/Referrer-Policy acá:
  # SecurityHeadersMiddleware del backend ya los manda por respuesta (incluye
  # CSP con nonce propia en /mp-oauth/callback). Duplicarlos en nginx puede
  # generar dos headers CSP en la misma respuesta (el browser los intersecta).
  location /api {
    proxy_pass http://127.0.0.1:8000;  # ajustar al puerto real del backend
    # ...proxy_set_header existentes...
  }
}
```

### Nota sobre `style-src` y estilos inline

Si Tailwind o algún componente inyecta `style=""` inline en runtime, este CSP puede romper estilos (`style-src 'self'` sin `'unsafe-inline'` los bloquea). No verificable desde este repo sin levantar el build en un browser real. **Recomendación:** desplegar primero con `Content-Security-Policy-Report-Only` (mismo valor, header distinto) una semana, revisar violaciones en devtools, recién después pasar el header a `Content-Security-Policy` (enforcing).

## Cómo verificar una vez aplicado

```bash
curl -sI https://gestflow.mardev.cl/ | grep -iE "content-security|x-frame|strict-transport|x-content-type"
curl -sI https://gestflow.mardev.cl/api/auth/me | grep -iE "content-security|x-frame|strict-transport|x-content-type"
```

El segundo `curl` debe traer los headers puestos por `SecurityHeadersMiddleware` del backend (no por nginx) — si aparecen duplicados, hay un `add_header` de más en `/api` que hay que sacar.

En browser: abrir el SPA con devtools → consola, buscar errores `Refused to load/connect` (violaciones CSP) antes de pasar de Report-Only a enforcing.
