# CMS Headless And HTML Migration

## Objetivo

Incorporar un CMS interno simple, controlado y persistido en PostgreSQL para renderizar contenido dinámico en el storefront sin reemplazar la lógica comercial existente.

La decisión final de routing queda así:

- `/` y los paths heredados (`/contacto.html`, `/productos/...html`, etc.) quedan para el sitio migrado desde HTML.
- `/tienda` preserva el home comercial actual del storefront.
- `/shop` preserva la tienda existente.
- `/tienda/shop` redirige a `/shop`.

Esto permite usar la landing/site institucional como raíz pública sin romper el ecommerce actual.

## Criterios consolidados de migración

- El contenido visible no debe inventarse.
- No se agregan títulos, descripciones o paneles generados que no existan en el sitio original.
- Los patrones repetidos del HTML legado deben bajar a componentes CMS reutilizables.
- La compatibilidad de paths y piezas SEO no se resuelve con hacks por página, sino con alias, tipos de sección y variantes reutilizables.
- El layout actual del storefront se preserva: header, footer, navbar mobile y experiencia comercial siguen siendo la base visual.

## Navegación CMS en storefront

La navegación del sitio migrado sigue siendo data-driven desde `SITE_HEADER.settings`.

Settings relevantes:

- `items`: opciones CMS visibles en el nav
- `navigationMode`: `grouped | flat`
- `navigationGroupLabel`: etiqueta del grupo descriptivo cuando el modo es `grouped`

Decisión actual:

- por defecto, las páginas informacionales migradas se agrupan bajo un nodo descriptivo como `Información`
- el merge con la navegación del storefront actual deduplica links ya presentes
- esto evita inflar el menú principal y mantiene configurable desde CMS cómo se presentan esas páginas

## Componentes reutilizables ya fijados

Estructuras que se consolidan como baseline CMS reusable:

- `SITE_HEADER`
- `SITE_FOOTER`
- `MEDIA_CAROUSEL`
  - variantes como `cards`, `logos`
- `CONTENT_SPLIT`
  - variantes como `image-content`, `media-gallery-content`
- `CTA_BANNER`
- detalle informacional de producto basado en:
  - galería/contenido
  - panel repetido
  - CTA
  - carrusel relacionado

Regla de producto:

- no se crean componentes “legacy-only”
- si una pieza aparece repetida en varias páginas, se modela como tipo o variante reutilizable
- ejemplos ya detectados:
  - detalle de `cortinas-roller`
  - detalle de `bandas-verticales`
  - detalle de `venecianas`
  - panel repetido de Mercado Pago

## Organización CMS en admin

La organización administrativa queda orientada a dos dominios:

- `General Site`
  - páginas informacionales y landing institucional
- `Storefront`
  - recursos y páginas vinculadas a la experiencia comercial

En la implementación actual:

- el menú ya se organiza con esa separación
- el listado de páginas puede filtrarse por `scope=general | store`

Pendiente de evolución, ya documentado:

- mover también el home/store preexistente a estructuras CMS reales
- exponer recursos reutilizables configurables desde CMS para:
  - variantes de navbar
  - header/footer
  - líneas de color/temas
  - search bars
  - filtros
  - cards de producto

## Siguiente paso estructural recomendado

La separación `General Site / Storefront` ya no debería depender solo de convención por path.

Evolución recomendada:

- agregar scope persistido en `CmsPage`
  - `GENERAL`
  - `STORE`

Ese scope debe resolver:

- organización del admin
- filtros de edición
- ownership del contenido
- importadores futuros
- preview/publicación diferenciada

Regla:

- el scope no reemplaza el routing público
- ordena la gestión y habilita reutilización limpia de componentes/recursos

## Manejo de errores en admin

El criterio general para admin no es “tolerar cualquier estado roto”, sino:

- alinear navegación y mapeos para que cada módulo cargue únicamente su propio contexto
- y, además, tener fallbacks visibles cuando el servidor falle

Decisiones aplicadas:

- `Mail` debe cargar solo cuentas email válidas desde origen
- si la URL trae un `account` ajeno al módulo, se reencauza al inbox válido
- el admin usa un `AppErrorBoundary` para evitar pantallas completamente en blanco ante fallos de render

Pendiente natural:

- extender el mismo criterio de estados de error visibles a más vistas críticas con fallbacks uniformes de conexión/servidor

## Modelo de datos

Entidades nuevas en Prisma:

- `CmsPage`
- `CmsPageSection`
- `CmsPageBlock`
- `CmsMedia`

Relaciones:

- `CmsPage -> CmsPageSection` (`1:N`)
- `CmsPageSection -> CmsPageBlock` (`1:N`)

Enums actuales:

- `CmsPageSectionType`
  - `HERO`
  - `RICH_TEXT`
  - `MEDIA_GRID`
  - `CTA_BANNER`
  - `FAQ`
  - `FEATURE_GRID`
- `CmsPageBlockType`
  - `TEXT`
  - `RICH_TEXT`
  - `IMAGE`
  - `BUTTON`
  - `LIST_ITEM`
  - `FAQ_ITEM`
  - `CARD`
- `CmsMediaType`
  - `IMAGE`
  - `VIDEO`
  - `DOCUMENT`
  - `EMBED`
  - `AUDIO`

Migración:

- [20260329143000_cms_pages_domain/migration.sql](/Users/rodrigo/git/personal/react_admin_dashboard/backend/prisma/migrations/20260329143000_cms_pages_domain/migration.sql)

## Backend

Servicios principales:

- [cms-pages.service.ts](/Users/rodrigo/git/personal/react_admin_dashboard/backend/src/cms/cms-pages.service.ts)
- [cms.controller.ts](/Users/rodrigo/git/personal/react_admin_dashboard/backend/src/cms/cms.controller.ts)

Endpoints base:

- `GET /api/cms/pages`
- `POST /api/cms/pages`
- `PUT /api/cms/pages/:id`
- `DELETE /api/cms/pages/:id`
- `GET /api/cms/media`
- `POST /api/cms/media/upload`
- `POST /api/cms/media/external`
- `DELETE /api/cms/media/:id`

Resolución pública para storefront:

- `GET /api/storefront/content/pages/resolve?path=/...`

La resolución pública devuelve:

- metadata de página
- SEO
- secciones ordenadas
- bloques ordenados
- media normalizada

## Admin UI

Pantallas nuevas:

- [PageManager](/Users/rodrigo/git/personal/react_admin_dashboard/frontend/src/views/cms/PageManager/index.tsx)
- [MediaManager](/Users/rodrigo/git/personal/react_admin_dashboard/frontend/src/views/cms/MediaManager/index.tsx)
- [SiteManager](/Users/rodrigo/git/personal/react_admin_dashboard/frontend/src/views/cms/SiteManager/SiteManager.tsx)

Rutas:

- `/app/cms/pages`
- `/app/cms/media`

Capacidades:

- alta/edición/baja de páginas
- edición de SEO
- alta/edición/baja de secciones
- alta/edición/baja de bloques
- reorder por drag & drop
- toggle visible
- media upload y media externa

## Storefront

Renderer CMS:

- [CmsPageShell.tsx](/Users/rodrigo/git/personal/react_admin_dashboard/ecommerce/src/components/cms/CmsPageShell.tsx)
- [CmsPageShell.module.css](/Users/rodrigo/git/personal/react_admin_dashboard/ecommerce/src/components/cms/CmsPageShell.module.css)

Fallback comercial existente:

- [LegacyStorefrontHomePage.tsx](/Users/rodrigo/git/personal/react_admin_dashboard/ecommerce/src/components/cms/LegacyStorefrontHomePage.tsx)

Rutas relevantes:

- raíz CMS o fallback legacy: [page.tsx](/Users/rodrigo/git/personal/react_admin_dashboard/ecommerce/src/app/(storefront)/page.tsx)
- catch-all CMS: [[...cmsSlug]/page.tsx](/Users/rodrigo/git/personal/react_admin_dashboard/ecommerce/src/app/(storefront)/[...cmsSlug]/page.tsx)
- home comercial preservado: [tienda/page.tsx](/Users/rodrigo/git/personal/react_admin_dashboard/ecommerce/src/app/(storefront)/tienda/page.tsx)
- alias a tienda: [tienda/shop/page.tsx](/Users/rodrigo/git/personal/react_admin_dashboard/ecommerce/src/app/(storefront)/tienda/shop/page.tsx)

## Migración HTML

Script:

- [import-legacy-html-site.ts](/Users/rodrigo/git/personal/react_admin_dashboard/backend/scripts/import-legacy-html-site.ts)

Entrada usada para la migración inicial:

- `/Users/rodrigo/git/personal/urucortinas_projects/urucortinas_html_version`

Qué hace:

- recorre `.html/.htm`
- convierte páginas a `CmsPage`
- convierte secciones a `CmsPageSection`
- convierte bloques a `CmsPageBlock`
- copia assets referenciados a `backend/uploads/cms/legacy-assets`
- reescribe vínculos internos HTML a rutas CMS

Resultado inicial importado:

- `20` páginas
- `71` secciones
- `106` bloques
- `39` medias

## Compatibilidad de assets heredados

Los assets migrados viven en `backend/uploads/cms/legacy-assets`, pero el storefront expone compatibilidad para:

- `/uploads/:path*`
- `/img/:path*`
- `/css/:path*`
- `/js/:path*`
- `/lib/:path*`
- `/assets/css/:path*`
- `/assets/img/:path*`
- `/assets/js/:path*`
- `/assets/webfonts/:path*`
- `/catalogo/assets/:path*`
- `/construccion.urucortinas.com.uy/:path*`

Esto evita romper contenido heredado o campañas que dependan de paths antiguos.

Configuración:

- [next.config.ts](/Users/rodrigo/git/personal/react_admin_dashboard/ecommerce/next.config.ts)

## Validación realizada

Verificado en runtime:

- `GET /api/storefront/content/pages/resolve?path=/`
- `GET /api/storefront/content/pages/resolve?path=/contacto.html`
- `GET /api/storefront/content/pages/resolve?path=/productos/cortinas-roller.html`
- `GET /`
- `GET /contacto.html`
- `GET /productos/cortinas-roller.html`
- `GET /tienda`
- `GET /shop`
- `GET /tienda/shop` -> `307 /shop`
- `GET /uploads/cms/legacy-assets/...`
- `GET /img/...`

## Criterio de producto fijado

El CMS no es un page builder libre.

La fuente de verdad queda separada así:

- CMS define contenido y orden
- React define componentes válidos
- el storefront decide cómo renderizarlos
- la tienda actual sigue existiendo como experiencia comercial separada

## Próximos pasos naturales

- preview draft/publicado
- versionado de páginas
- publicación programada
- importador incremental desde HTML adicional
- más tipos de sección controlados
- validaciones por esquema para cada tipo de bloque/sección
