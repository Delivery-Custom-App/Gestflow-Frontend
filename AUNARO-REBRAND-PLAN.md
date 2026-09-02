# Homologar UI web a Aunaro

## Contexto

El producto (hoy mostrado a los usuarios como "Gestflow", con restos de nombres previos "rutek"/"SibaGestion"/"delivery-custom-app-ingsw2" dispersos en el código) va a re-identificarse visualmente como **AUNARO**. La web es el core de la app — el admin controla todo desde ahí y además cumple un rol analítico (dashboards, reportes, alertas) — por lo que homologar su UI a la propuesta de marca Aunaro (paleta, tipografía, componentes, layout) es la tarea prioritaria de diseño/desarrollo.

Se adjuntaron dos referencias de marca:
1. `aunaro-identidad-marca.md` — spec textual completa (colores exactos, tipografía, reglas de uso).
2. `Presentación_MARCA_Aunaro.pdf` (encontrado en Descargas) — el mismo sistema pero con el **isologo real ya diseñado**, y crucialmente una **página de mockup del panel/dashboard** (pág. 8, "La identidad en el panel") que muestra cómo se ve la marca aplicada a una pantalla casi idéntica a la que ya existe en este proyecto (sidebar con Descubrir/Administración/POS Restaurante, tarjetas KPI, gráfico de tendencia, panel de Alertas inteligentes).

Ya se hizo una exploración exhaustiva del código (frontend y backend) y se resolvieron con el usuario las decisiones de alcance que cambiaban el resultado. Este plan es directamente ejecutable.

**Fuera de alcance confirmado:** cambios de backend (esta es una tarea puramente visual/frontend); el logo demo del tenant "Sibarítco" (`public/sibaritco-logo.svg`, usado en `RegisterPage.jsx`/`WorkerLocalSelector.jsx` — es la marca de un restaurante-cliente de ejemplo, no del producto); el azul de marca de MercadoPago en los modales de pago (`#009ee3`/`#0082c0` — es marca de un tercero); artefactos internos no visibles (`package.json` name, título de `README.md`, User-Agent string) — el usuario confirmó que el renombrado se limita a lo visible en la web.

---

## Decisiones ya confirmadas con el usuario

| Decisión | Resuelto |
|---|---|
| Símbolo/logo | El PDF trae el diseño real → se **reconstruye el isologo real** como SVG (no un placeholder) |
| Selector de paleta (hoy: Default/'rutek' azul + 'Legacy' verde) | **Aunaro como marca única** — se retira 'Legacy', Ajustes queda solo con toggle claro/oscuro |
| Tarjetas KPI (duplicadas en 3 archivos) | **Retinte mínimo in-place** — no se extrae componente compartido en esta tarea |
| Alcance del renombrado | **Solo texto visible en la web** — no se tocan package.json/README/User-Agent |

---

## El isologo real (reconstruido del PDF)

Construcción confirmada visualmente en las páginas 1, 2, 3, 6, 7 y 11 del PDF:
- Dos barras diagonales con extremos redondeados que forman un pico tipo "A" sin travesaño: la izquierda en **rojo coral**, la derecha en **verde esmeralda**, ambas naciendo cerca del vértice superior y abriéndose hacia abajo.
- Una forma central tipo triángulo redondeado / cono (más ancha en la base, con la punta asomando entre las dos barras arriba) en **ámbar dorado**, cuya base curva se alinea con la base de las dos barras laterales.
- En variantes monocromáticas (pág. 6) las tres piezas se funden visualmente en una sola silueta de un color — así debe comportarse también la versión de un solo tono.
- Regla explícita del manual: la versión a tres colores es siempre la opción por defecto; nunca separar las tres piezas.

Se construirá como componente SVG inline (React), no como imagen rasterizada, para que use los hex exactos de marca de forma confiable sobre cualquier fondo (hueso o azul noche) sin lógica de theming — el manual es explícito en que el símbolo a color no cambia entre fondos claros/oscuros, solo el logo monocromático lo hace (y ese caso no aplica aquí, ya que la versión a color es siempre la default).

Dónde debe aparecer el lockup símbolo+wordmark:
- `AppShell.jsx` — header del sidebar (hoy ícono `Utensils` + texto "Gestflow"); mostrar solo el símbolo (sin wordmark) cuando el sidebar está colapsado a 64px — hoy no se muestra ningún logo en ese estado.
- `LoginPage.jsx` — lockup grande en el panel oscuro (hero) y lockup pequeño en el panel del formulario (ambos hoy dicen "Gestflow" con ícono `Building2`).
- `LoadingPage.jsx` — pantalla de carga a pantalla completa (hoy usa animación `GradientTracing` con `--chart-brand`; cambiar esa referencia a `--primary` ámbar ya que es un momento de marca/CTA, no un dato).
- `LocalsGrid.jsx` — badge "Gestflow" en el header de "Tus Franquicias".
- Favicon del navegador + `<title>`.

Favicon: reemplazar `public/favicon.svg` (hoy un blob morado sin relación con la marca) por una versión simplificada del símbolo — a 16-24px las tres piezas fusionadas leen mejor como chip ámbar con silueta oscura, que además es exactamente una de las variantes monocromáticas sancionadas por el manual (ámbar de marca + símbolo en negro). `public/icons.svg` (sprite de íconos sociales sin uso, confirmado con grep que no lo referencia nada) se elimina.

---

## Fase 1 — Fundación: tokens de color (`src/index.css`)

Mapeo hex → HSL (formato de triplete que ya usa el archivo) y asignación semántica, preservando el patrón actual de cómo cada token cambia entre claro/oscuro (solo se re-ancla el matiz, no se rediseña el mecanismo):

**Claro (`:root`):**
| Token | Nuevo valor | Nota |
|---|---|---|
| `--background` | `43 30% 95%` (Hueso `#F7F5F0`) | Fondo de producto exigido por el manual |
| `--foreground` | `240 41% 9%` (Azul noche `#0D0D1F`) | Texto casi negro exigido por el manual |
| `--card` | `0 0% 100%` | Sin cambio — blanco puro ya funciona bien sobre hueso |
| `--primary` / `--ring` | `38 89% 54%` (Ámbar dorado `#F2A623`) | Es el color primario/CTA explícito del manual |
| `--primary-foreground` | `240 41% 9%` (azul noche, **no blanco**) | Blanco sobre ámbar da ~2:1 de contraste (falla WCAG); azul noche sobre ámbar da ~9.4:1. Cambio obligatorio, no cosmético |
| `--secondary` / `--muted` | `43 20% 93%` | Tinte hueso, no ámbar — evita que superficies secundarias lean como CTA |
| `--muted-foreground` | `240 12% 38%` | Gris-navy desaturado |
| `--accent` | `43 22% 91%` | Hover state |
| `--destructive` | `354 79% 57%` (Rojo coral `#E8394A`) | `--destructive-foreground: 0 0% 100%` (blanco ~4.1:1, aceptable para botones/badges) |
| `--success` (**nuevo token**) | `149 53% 49%` (Verde esmeralda `#3BBF7A`) | `--success-foreground: 240 41% 9%` (mismo problema de contraste que primary si fuera blanco) |
| `--warning` | `38 89% 54%` (mismo que primary) | El manual no define un 4º color; su propio cheat sheet dice "neutro = ámbar". No choca visualmente porque warning se usa como tinte suave, no como fill sólido |
| `--info` | Gris-navy neutro, ej. `240 15% 88%` / foreground `240 30% 25%` | El manual dice "color = dato/estado, no decoración"; info es procedural, no una métrica — mantenerlo neutro es más fiel a esa regla que forzarlo a ámbar |
| `--border` / `--input` | `40 14% 84%` | Retintado hacia el calor de hueso |
| `--primary-tint` | `38 85% 75%` | Ámbar suave sobre fondos oscuros (login hero) — coincide con el propio par ámbar-sobre-azul-noche del splash screen del manual |
| `--loading-from/-via/-to` | Gradiente azul noche, ej. `#14142e` / `#0D0D1F` / `#06060f` | Ver Fase 4 sobre unificar con el gradiente hardcodeado de `AppShell.jsx` |
| `--mesa-libre` | `149 53% 49%` (esmeralda) | Disponible = positivo |
| `--mesa-ocupada` | `354 79% 57%` (coral) | |
| `--mesa-cobro` | `38 89% 54%` (ámbar) | Cambio casi nulo — ya estaba en `38 92% 50%` |
| `--mesa-inactiva` | `240 8% 75%` | Neutro — ausencia de estado |
| `--chart-brand` | `#3BBF7A` (esmeralda) | El manual asigna verde a "tecnología/crecimiento/dato positivo"; el mockup del panel (pág. 8) confirma barras de tendencia predominantemente verdes con el valor pico destacado en ámbar |

**Oscuro (`.dark`):** `--background: 240 41% 9%` (azul noche exacto — es literalmente la especificación del manual para fondos oscuros), `--foreground: 43 25% 94%`, `--card: 240 30% 14%`, `--primary: 38 92% 60%` (aclarado, seguí el mismo patrón que ya existe de aclarar en dark), `--primary-foreground` se mantiene azul noche, `--destructive: 354 70% 50%`, success/mesa-tokens con el mismo +8-10% de luminosidad que ya aplica el archivo actual en dark, `--warning`/`--info` se mantienen igual entre modos (como ya ocurre hoy).

**Retirar el mecanismo `data-palette` por completo** (por la decisión de "Aunaro como marca única"):
- Eliminar los bloques `:root[data-palette='legacy']` y `.dark[data-palette='legacy']` completos, y sus líneas `--chart-brand`/`--chart-brand-soft` asociadas.
- `src/context/ThemeContext.jsx`: quitar el estado `palette`/`setPalette`, la key `localStorage['palette']`, y el efecto que setea `data-palette` — dejar solo `darkMode`/`toggleDarkMode`.
- `src/components/AppShell.jsx`: quitar el array `PALETTES` (línea ~130), la función `applyPalette`, el bloque de swatches del switcher en el panel de Ajustes, y simplificar `resetAppearance()` (línea ~154) para que solo resetee el modo oscuro.
- `index.html`: el script anti-FOUC pierde la línea que lee/aplica `data-palette`, conservando solo la lógica de `.dark`.
- `src/context/ThemeContext.test.jsx`: actualizar/quitar aserciones sobre `'rutek'`/`'legacy'` (líneas ~12, 36, 38, 44-51).

Añadir además `--font-marca`/reapuntar `--font-sans` en el mismo `@theme` block (ver Fase 2), y bajar `components.json`'s `"baseColor"` de `"green"` a `"neutral"` (cosmético, solo afecta scaffolding futuro de shadcn).

---

## Fase 2 — Tipografía

- `index.html`: reemplazar el `<link>` de Inter por la URL combinada exacta del manual (Playfair Display + DM Sans, con ejes itálicos) y cambiar `<title>Gestflow</title>` → `<title>AUNARO</title>`.
- `src/index.css` `@theme`: agregar `--font-marca: 'Playfair Display', ui-serif, Georgia, serif;` y reapuntar `--font-sans: 'DM Sans', ui-sans-serif, system-ui, sans-serif;` (mantener el nombre `--font-sans` — Tailwind v4 genera la utilidad `.font-sans` desde ese nombre; renombrarlo rompería cualquier uso futuro). Confirmado por grep: `font-sans` no se usa como className en ningún JSX hoy, así que este cambio por sí solo ya vuelve DM Sans la tipografía global de interfaz sin tocar más archivos.
- Aplicar `font-marca` + `tracking-[0.14em]` explícitamente en las instancias del wordmark: `AppShell.jsx` (sidebar header), `LoginPage.jsx` (ambos lockups), `LoadingPage.jsx`, y extender a headlines grandes (`LoginPage.jsx` "Tu local en orden, todos los días.", títulos `<h1>` de página como "Tus Franquicias" en `LocalsGrid.jsx`) — no aplicar a títulos de card, labels de KPI, headers de tabla ni botones, esos quedan en DM Sans.
- Tagline real ("Inteligencia de negocios en tus manos", itálica, 27% del tamaño del nombre) solo tiene sentido donde el wordmark se muestra grande: `LoginPage.jsx` hero y `LoadingPage.jsx` — no en la instancia pequeña del sidebar.
- No tocar las fuentes monoespaciadas de tickets térmicos (`orderPrint.js`, `MercadoPagoReturn.jsx`).

---

## Fase 3 — Símbolo, favicon y naming

- Crear `src/assets/brand/AunaroSymbol.jsx` (no existe carpeta `assets/` hoy) con el SVG del isologo reconstruido según la sección "El isologo real" arriba, usando los 3 hex exactos.
- Insertar el lockup símbolo+wordmark en los 5 puntos listados arriba (`AppShell.jsx`, `LoginPage.jsx` ×2, `LoadingPage.jsx`, `LocalsGrid.jsx`).
- Favicon: nuevo `public/favicon.svg` con la variante simplificada ámbar/negro.
- Eliminar `public/icons.svg` (confirmado sin referencias).
- Renombrar texto visible "Gestflow" → "AUNARO" en los mismos archivos + `MPConfigDrawer.jsx` (copys en líneas ~609-610) + `<title>` de `index.html`.
- **No tocar**: `public/sibaritco-logo.svg` y sus usos, el string de soporte `gestflowtriferax@gmail.com` en `AppShell.jsx` (es un contacto real; solo cambiar si el usuario confirma una casilla nueva con marca Aunaro), las keys de `localStorage` (`gestflow-auth-token`, etc. en `authClient.js`) — renombrarlas cerraría la sesión de cualquier usuario logueado sin ningún beneficio visual, y el email demo `rustik.demo@gestflow.dev` en `constants/demoMode.js` (es una cuenta real, no un string de marca).

---

## Fase 4 — Shell/chrome (`AppShell.jsx`)

La mayoría de los estados interactivos del shell (item activo, hover, acordeón, focus) ya consumen `hsl(var(--primary))`/`hsl(var(--accent))`/`hsl(var(--border))`, así que heredan el ámbar automáticamente en cuanto la Fase 1 esté lista, sin tocar este archivo. Ediciones puntuales necesarias:
- Línea ~703: `bg-gradient-to-br from-[#1a1a1a] via-[#121110] to-[#0c0b0a]` (hardcodeado) → referenciar `var(--loading-from/-via/-to)`, unificando con `LoadingPage.jsx` en vez de mantener el valor duplicado a mano en dos lugares.
- Líneas ~309/661: swap ícono `Utensils` + texto "Gestflow" → símbolo Aunaro + "AUNARO" en `font-marca`.
- Etiqueta del acordeón "POS" → "POS Restaurante", alineado con el mockup del panel (pág. 8 del PDF).
- Cambios de paleta descritos en Fase 1 (array `PALETTES`, `resetAppearance`).

---

## Fase 5 — Barrido de colores hardcodeados

| Archivo | Qué tiene hoy | Acción |
|---|---|---|
| `src/components/ui/badge.jsx` | Variantes `destructive/success/warning/info` 100% Tailwind crudo (`bg-red-100 text-red-700...`), sin relación con los tokens que ya existen | **Prioridad alta**: reconectar a `hsl(var(--destructive/success/warning/info))`. Es un primitivo compartido — un solo fix cascada a todos los `<Badge>` de la app |
| `src/components/charts/IncomeChart.jsx` | Hex sueltos `#16a34a`/`#8b5cf6`/`#3b82f6` en gradientes SVG | Completar el hook `chart-brand-*` ya parcial con `var(--chart-brand)` (esmeralda) para la serie principal; agregar `--chart-secondary` neutro gris-navy para la serie de comparación |
| `src/components/LocalDashboard.jsx` | `PIE_COLORS`, `PAY_CHART_COLORS`, mapa de estados, `KpiCard` con accents azules | `PIE_COLORS` → `['#3BBF7A','#F2A623','#E8394A']` preservando el orden bueno/neutro/malo; retinte del resto de mapas (ver Fase 6 para `KpiCard`) |
| `src/components/charts/ExpenseBreakdown.jsx` | 7 colores "flat-UI" hardcodeados + tooltip blanco fijo (ignora dark mode) | Retinte de la rampa de 7 colores (usar la skill `dataviz` disponible en este entorno para una rampa categórica accesible en vez de elegir a mano); tooltip → copiar el patrón ya correcto de `IncomeChart.jsx` (`hsl(var(--card))`/`hsl(var(--border))`) |
| `src/components/onboarding/CoachMark.jsx` | 3× `#4f46e5` inline, sin tokenizar | Swap directo a `'hsl(var(--primary))'` |
| `src/components/FranchisesMap.jsx` | Marcador Leaflet `#065f46` | Retinte a `#F2A623` |
| `src/index.css` líneas 388-463 (parches `!important` de dark mode) | ~15 reglas que parchean clases Tailwind crudas | **Se difiere** — nada se rompe dejándolas como están, y migrar el origen (todos los componentes que aún usan `bg-emerald-50` etc.) es un alcance no acotado. Follow-up, no esta tarea |
| `pos/{CajaMpPairingModal, MultiPaymentModal, MPConfigDrawer}.jsx` | `#009ee3`/`#0082c0` | **No tocar** — es la marca de MercadoPago, no del producto |

Estrategia de verificación exhaustiva: correr un grep de `#[0-9a-fA-F]{6}` y de utilidades Tailwind con matiz+intensidad (`\b(red|blue|green|emerald|amber|yellow|violet|purple|indigo|pink|sky|teal|orange|slate|gray|cyan)-\d{2,3}\b`) sobre todo `src/` al momento de ejecutar, para capturar cualquier caso fuera de esta lista antes de dar la tarea por cerrada.

---

## Fase 6 — Tarjetas KPI (retinte mínimo, según lo acordado)

Solo se actualizan valores de color, sin cambios de estructura/markup:
- `src/components/LocalDashboard.jsx` — `KpiCard` (línea ~62): accents azules → mapeo semántico (ventas/positivo = esmeralda, meta/neutro = ámbar, cancelaciones/alerta = coral), replicando el patrón de borde-superior-de-color + texto de valor coloreado que muestra el mockup del panel (pág. 8 del PDF: Ventas Hoy en verde, Ventas del Mes en ámbar, Cancelaciones en coral, Ticket Promedio neutro).
- `src/components/AdministrativeModule.jsx` — mapas `KPI_ACCENT`/`KPI_DEFAULT` (líneas ~114-151): mismo retinte semántico.
- `src/components/pos/MesasKPICards.jsx` — sin cambios de código; ya consume los tokens `--mesa-*`, hereda el nuevo color automáticamente.
- Panel de "Alertas inteligentes" (donde exista hoy, vía `useAlerts`): aplicar el mismo patrón de tarjeta con tinte de fondo izquierdo/lateral según severidad (rojo=stock bajo, ámbar=merma, verde=insight positivo) que muestra el mockup.

---

## Fase 7 — Barrido página por página

Como el shell y los primitivos de `components/ui/*` ya son "token-driven", la Fase 1 se propaga sola a la gran mayoría de pantallas. Estrategia: usar el grep de la Fase 5 como checklist, y hacer un recorrido visual único en el servidor de desarrollo (claro y oscuro) por: Login, LocalsGrid, LocalDashboard, las 6 pestañas de `AdministrativeModule` (Ventas/Rendiciones/Reportes/Caja Virtual/Alertas/Bonos), POS (Mesas/Cocina/Reportes/Venta Directa), Inventario (6 subpáginas), RRHH (si está activado), y el área de superadmin "Gestor" (5 páginas).

**Caso especial: `LoginPage.jsx`.** Está deliberadamente desacoplado del sistema de tokens/dark-mode vía la clase `.login-light` (con reglas `.dark .login-light ...{!important}` dedicadas en `index.css` líneas ~452-464) para mantenerse siempre claro. Los tokens de la Fase 1 solo llegan a los pocos puntos que ya usan `hsl(var(--primary))`/`hsl(var(--primary-tint))` — el resto necesita retinte manual literal (no heredado):
- `bg-[#fbf7f0]` → `bg-[#F7F5F0]` (hueso exacto).
- Clases `stone-*` (texto/bordes) → literales de la familia azul noche, ya que la escala `stone` de Tailwind es gris cálido, no el navy frío de azul noche.
- `bg-stone-950` del hero (línea 31) → `bg-[#0D0D1F]` — esto además hace que el hero del login coincida casi exactamente con el splash screen que especifica el manual (isologo + wordmark + tagline sobre azul noche).
- Actualizar en paralelo el bloque `.dark .login-light` correspondiente en `index.css` con los mismos literales.

---

## Fase 8 — Verificación

1. `npm run dev` y recorrido visual completo (Fase 7) en claro y oscuro.
2. Actualizar `src/context/ThemeContext.test.jsx` (ya no habrá `palette`/`'rutek'`/`'legacy'` que testear — simplificar a solo `darkMode`) y correr el resto de la suite `vitest` como red de seguridad.
3. Chequeo de contraste en vivo (DevTools o axe) sobre botones/badges reales, en particular `--primary-foreground` y `--success-foreground` (deben verse azul-noche-sobre-color, nunca blanco-sobre-color).
4. Nota de alcance para no confundir con bug: el backend no tiene endpoints dedicados de dashboard/reportes/alertas (solo dos "resumen" de caja) — si algún número del panel se ve aproximado/estático durante el recorrido, es una condición preexistente ajena a este rebrand visual.

---

## Área de trabajo combinada (backend + frontend)

Existe un archivo de workspace obsoleto y mal ubicado: `src/components/Delivery-Custom-App-INGSW2-FRONTEND.code-workspace` (enterrado dentro de una carpeta de componentes React, y apuntando a `../../../Delivery-Custom-App-INGSW2`, una carpeta que ya no existe). Se reemplaza por uno nuevo en la raíz de `Gestflow-Frontend` (para que quede versionado en git), referenciando ambas carpetas:

```json
{
  "folders": [
    { "path": "." },
    { "path": "../Gestflow-Backend-V2" }
  ]
}
```

Se elimina el archivo viejo mal ubicado.

---

## Orden de ejecución sugerido

1. Fundación (tokens + fuentes en `index.css`) + retiro del mecanismo de paletas — checkpoint visual inmediato.
2. `--success` + reconexión de `badge.jsx`.
3. Símbolo SVG + favicon (puede ir en paralelo a 1-2).
4. Shell/chrome (`AppShell.jsx`) + naming ahí mismo.
5. Login (retinte manual, reutilizando el símbolo/wordmark ya listo).
6. Barrido de colores hardcodeados (charts, CoachMark, FranchisesMap) — mecánico, paralelizable.
7. Retinte de tarjetas KPI.
8. Barrido de verificación con grep + recorrido visual final.
9. Archivo de workspace — sin dependencias, en cualquier momento.

---

### Archivos críticos
- `src/index.css`
- `src/context/ThemeContext.jsx`
- `src/components/AppShell.jsx`
- `src/components/LoginPage.jsx`
- `src/components/LoadingPage.jsx`
- `src/components/ui/badge.jsx`
- `src/components/LocalDashboard.jsx`, `src/components/AdministrativeModule.jsx`
- `src/components/charts/IncomeChart.jsx`, `src/components/charts/ExpenseBreakdown.jsx`
- `index.html`
