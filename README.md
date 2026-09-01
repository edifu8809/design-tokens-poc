# design-tokens-poc

PoC de arquitectura de Design Tokens end-to-end (Figma → Style Dictionary → Angular/Ionic), en un monorepo Nx.

## Requisitos

- Node **20+** (recomendado 22.23.1 — hay un `.nvmrc`, corré `nvm use`). Style Dictionary v5 requiere Node ≥ 22.
- npm (workspaces de npm, sin `pnpm`/`yarn`).

```bash
nvm use
npm install
```

## Estructura

```
apps/
  demo-app/                    Angular + Ionic standalone, catálogo de validación
libs/
  shared/
    design-tokens/             Librería PURA de tokens (sin Angular)
      tokens/
        base/                  Primitivos (color.json, spacing.json) — paleta cruda
        brands/
          mr/                  Semánticos marca "mr" (light/dark) — demo, colores inventados
          cuscatlan/            Semánticos marca "cuscatlan" (light/dark) — demo, colores inventados
          gennius/              Semánticos marca "gennius" (solo light) — colores REALES, sincronizados desde Figma
      build.js                 Motor de Style Dictionary (config + build en un archivo)
      sync-figma-gennius.js    Sincroniza apps/demo-app/public/tokens.json -> base/color.json + brands/gennius/*
      dist/css/tokens.css      Output generado (gitignored, se regenera con el build)
    ui/                        Componentes Angular/Ionic (app-button, app-card, app-input)
      src/lib/theme/theme.service.ts   Cambia `data-brand`/`data-theme` en <html>
      src/styles/ionic-theme.scss     Puente hacia --ion-color-* / --ion-*-background
```

> **Nota:** "mr" y "cuscatlan" son nombres de marca de ejemplo (tal como los mencionó el pedido original) con paletas de color **inventadas para la demo** — no son los colores corporativos reales de ningún banco. "gennius" en cambio sí usa colores reales, sincronizados desde `apps/demo-app/public/tokens.json` (ver más abajo).

## Cómo funciona la compilación de tokens

`libs/shared/design-tokens/build.js` corre Style Dictionary una vez por combinación marca × modo declarada en el objeto `BRANDS` (`mr`/`cuscatlan` en `light`+`dark`, `gennius` solo en `light` — no todas las marcas necesitan los mismos modos), cada una resolviendo sus alias (`{color.blue.500}`) contra `tokens/base/color.json`, y emite un bloque CSS con selector `:root[data-brand="mr"][data-theme="light"] { --color-brand-primary: #...; }`. Esos bloques + los tokens globales (spacing/radius, sin marca) se concatenan en `dist/css/tokens.css`.

Cambiar de marca/tema en runtime = cambiar dos atributos en `<html>` (lo hace `ThemeService`) — no hay recarga de CSS ni recompilación de Angular.

Formato de tokens: [W3C Design Tokens (DTCG)](https://design-tokens.github.io/community-group/format/) — `$type`/`$value`, el mismo formato que exportan Figma Variables y Tokens Studio.

### Comandos

```bash
npm run tokens:build        # compila libs/shared/design-tokens/tokens/*.json -> dist/css/tokens.css
npm start                   # nx serve demo-app (compila tokens automáticamente antes, ver dependsOn)
npm run build                # nx build demo-app (ídem)
npm run lint
```

La dependencia está declarada en Nx (`apps/demo-app/project.json` → `implicitDependencies` + `dependsOn: ["design-tokens:build"]`), así que `nx serve`/`nx build demo-app` siempre recompilan los tokens primero. Si solo editás JSON de tokens con la app ya corriendo, corré `npm run tokens:build` a mano — el watcher de Angular detecta el cambio en `dist/css/tokens.css` y hace hot-reload.

## Agregar una marca nueva

1. Crear `libs/shared/design-tokens/tokens/brands/<marca>/semantic.<modo>.json` por cada modo que tenga (mismo shape que `mr`/`cuscatlan`; `gennius` es un ejemplo de marca con un solo modo).
2. Agregar `<marca>: ['light', ...]` al objeto `BRANDS` en `build.js`, listando solo los modos para los que realmente creaste un archivo.
3. `npm run tokens:build`.
4. Agregar el brand al tipo `Brand` y a `BRAND_MODES` en `theme.service.ts`, y el botón en el switcher de `apps/demo-app/src/app/app.html` (`brands` en `app.ts`). `BRAND_MODES` es lo que evita que la UI deje seleccionar una combinación marca/modo sin CSS generado — por ejemplo, el botón "dark" se deshabilita solo cuando "gennius" está activa.

## Sincronizar una marca real desde Figma (`gennius`)

`gennius` no es una marca de demo: sus valores vienen de verdad de `apps/demo-app/public/tokens.json` (el mismo export de Figma que usa el pipeline de `apps/demo-app`, ver más abajo), vía `libs/shared/design-tokens/sync-figma-gennius.js`:

```bash
npm run tokens:sync:gennius   # sync-figma-gennius.js + tokens:build
```

Qué hace: lee cada color de la *Variable collection* del export (ignora `_styles`, igual que el pipeline de `apps/demo-app`) y:
- Vuelca **todos** los colores a `tokens/base/color.json`, bajo `color.gennius.<nombre-kebab>` — sin filtrar ni interpretar nada, 1:1 con Figma.
- Puebla `tokens/brands/gennius/semantic.light.json` usando un mapa fijo `ROLE_MAP` (rol semántico → **nombre** de la variable en Figma, no su hex) definido arriba del archivo `sync-figma-gennius.js`. Como matchea por nombre, si en Figma cambian el color de "Gennius Blue" pero no el nombre, un re-sync lo recoge solo — si renombran la variable, el script tira un warning en vez de adivinar.

**Importante:** qué rol juega cada swatch (¿"Gennius Blue" es el `brand.primary`? ¿"Black" es `text.primary`?) es una interpretación mía leyendo los nombres de Figma, no algo verificado contra una especificación real de diseño — revisen `ROLE_MAP` en `sync-figma-gennius.js` antes de usar esto en producción. Quedaron sin mapear (solo como primitivos disponibles): `Dark Blue`, `Principal Color Gennius`, `BG Gennius` (las tres son el mismo `#001335` — evalúen si alguna merece su propio rol), `Principal Color Imagine` y `AZUL IMGINE` (parecen de una marca "Imagine" distinta, no de "gennius"), `Red-message` y `Alert-Border`. `surface.elevated`/`surface.border` no tienen swatch equivalente en el export, así que reusan la escala `neutral` compartida con `mr`/`cuscatlan` en vez de inventar grises nuevos.

Por ahora `gennius` solo tiene modo `light` porque el export no trae modo oscuro — agregar `tokens/brands/gennius/semantic.dark.json` a mano y sumar `'dark'` en `BRANDS.gennius` (`build.js`) y `BRAND_MODES.gennius` (`theme.service.ts`) el día que exista ese dato real.

## Consumo en Ionic

`libs/shared/ui/src/styles/ionic-theme.scss` mapea nuestros tokens semánticos a las variables nativas de Ionic (`--ion-color-primary`, `--ion-background-color`, `--ion-card-background`, etc.), así que `<ion-button color="primary">` y demás componentes de Ionic heredan la marca/tema activos sin tocar sus estilos. Ese archivo debe cargar **después** del CSS de Ionic (`@ionic/angular/css/core.css`) en el array `styles` de `project.json` — mismo selector `:root`, gana el último en orden de carga.

## Segunda vía: ingesta directa de un export crudo de Figma (`apps/demo-app`)

Además del pipeline de Style Dictionary/DTCG de arriba, `apps/demo-app` tiene un pipeline **independiente y más simple**, pensado para tomar un export crudo de Figma (Variables collection, sin modelar en capas semánticas todavía) y convertirlo directo a variables usables:

- Entrada: `apps/demo-app/public/tokens.json` — export tal cual lo entrega el plugin de Figma (`{ "<Colección>": { "modes": { "<Modo>": { "<Nombre token>": { $type, $value } } } } }`). El bloque `_styles` (Estilos de Figma: gradientes, tipografía, sombras) se ignora a propósito — no mapean 1:1 a una sola variable CSS.
- Script: `apps/demo-app/scripts/build-tokens.js` — kebab-casea los nombres (`"BG Gennius"` → `bg-gennius`) y los prefija con el `$type` (`color-bg-gennius`).
- Salida (gitignored, se regeneran siempre): `apps/demo-app/src/styles/_tokens.scss` (`$color-dark-blue: #001335;`) y `apps/demo-app/src/styles/_tokens.css` (`:root { --color-dark-blue: #001335; }`).

Comando: `npm run tokens:figma:build` (nombre distinto de `tokens:build` a propósito, para no pisar el script de Style Dictionary de arriba). También corre solo si hacés `nx build/serve demo-app` — está wireado como target `figma-tokens` con `dependsOn`.

Integración:
- `_tokens.scss` se consume via `@use 'styles/tokens' as *;` en `apps/demo-app/src/styles.scss` → variables Sass en tiempo de compilación. Cualquier otro `.scss` que quiera `$color-dark-blue` necesita su propio `@use` (las variables Sass no son "globales" como las CSS custom properties).
- `_tokens.css` se registra en el array `styles` de `project.json` (junto a `tokens.css` e `ionic-theme.scss`) → custom properties disponibles en runtime en toda la app.

Esto sigue siendo un pipeline aparte del de Style Dictionary — pensado para tener las variables crudas disponibles ya, sin capa semántica. La marca "gennius" (arriba) es justamente el resultado de tomar este mismo `public/tokens.json` y sí modelarlo semánticamente dentro de `libs/shared/design-tokens`.
