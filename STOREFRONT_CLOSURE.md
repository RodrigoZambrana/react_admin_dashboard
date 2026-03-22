# Storefront Closure

## Objetivo del cierre

Cerrar formalmente el bloque actual del storefront para evitar seguir extendiendo el alcance con ajustes cosméticos o refinamientos menores.  
Este documento fija:

- inventario final de rutas y módulos;
- política definitiva de procedencia de datos;
- checklist funcional de cierre;
- backlog diferido fuera de este bloque.

## Inventario final

### Activo / oficial

Rutas públicas activas:

- `/`
- `/categories`
- `/contact`
- `/shop`
- `/products`
- `/product/[slug]`
- `/product/search/[slug]`
- `/search`
- `/auth/complete`

Checkout activo:

- `/cart`
- `/checkout`
- `/payment`
- `/payment/error`
- `/payment/success`
- `/review`

Auth pública activa:

- `/account/login`
- `/account/register`
- `/account/forgot-password`

Cuenta cliente activa:

- `/account/orders`
- `/account/profile`
- `/account/address`
- `/account/wish-list`
- `/account/payment-methods`
- `/account/support-tickets`

Aliases activos hacia rutas oficiales:

- `/products` -> flujo oficial de catálogo
- `/orders` -> `/account/orders`
- `/orders/[uuid]` -> `/account/orders/[uuid]`
- `/profile` -> `/account/profile`
- `/profile/edit` -> `/account/profile/edit`
- `/address` -> `/account/address`
- `/address/create` -> `/account/address/create`
- `/payment-methods` -> `/account/payment-methods`
- `/payment-methods/[id]` -> `/account/payment-methods/[id]`
- `/support-tickets` -> `/account/support-tickets`
- `/support-tickets/[slug]` -> `/account/support-tickets/[slug]`
- `/wish-list` -> `/account/wish-list`

### Preservado pero fuera del flujo oficial

Código/template preservado para futura reutilización, pero no parte del storefront público vigente:

- `ecommerce/src/app/(layout-3)/*`
- `ecommerce/src/app/(layout-3)/vendor/*`
- `ecommerce/src/app/(layout-3)/checkout-demo/*`
- `ecommerce/src/app/shops/*`
- `ecommerce/src/app/(storefront)/market-1/*`
- `ecommerce/src/app/(storefront)/mobile-category-nav/*`
- `*.demo.tsx` preservados para referencia o reactivación controlada
- `page-sections` heredados no conectados al flujo oficial
- datasets de template bajo `ecommerce/src/__server__/__db__/*`

### Despublicado

Rutas bloqueadas o derivadas fuera del flujo público cuando `ENABLE_DEMO_ROUTES=false`:

- `/shops`
- `/shops/[slug]`
- `/mobile-category-nav`
- `/checkout-demo/*`
- `/vendor/*`

Rutas legacy derivadas a flujo oficial:

- `/login` -> `/account/login`
- `/signup` -> `/account/register`
- `/checkout-alternative` -> `/checkout`
- `/market-1` -> `/`

## Política definitiva de procedencia de datos

### Fuente primaria

La fuente primaria del storefront activo es siempre el backend real:

- `config`
- `categories`
- `products`
- `product detail`
- `parametric config`
- `parametric quote`
- `auth/session`
- `profile`
- `orders`
- `checkout/payment`

### Reglas de fallback permitidas

Solo se admiten fallbacks explícitos, trazables y gobernados por flags:

- configuración mínima del storefront para branding/base shell;
- snapshot controlado solo si el flag de snapshot está habilitado;
- rutas internas de snapshot solo con token;
- ausencia controlada de datos cuando el backend no responde y no hay snapshot permitido.

### Reglas de fallback no permitidas

No deben reaparecer en flujo público:

- datos demo heredados del template;
- branding Bonik/UI-LIB;
- navegación o links no oficiales;
- mock data sin procedencia clara;
- snapshots servidos implícitamente con flags apagados.

### Estado actual de flags

Valores alineados en local/examples:

- `NEXT_PUBLIC_ENABLE_STOREFRONT_FALLBACKS=false`
- `ENABLE_STOREFRONT_FALLBACKS=false`
- `NEXT_PUBLIC_ENABLE_SNAPSHOT_FALLBACKS=false`
- `ENABLE_DEMO_ROUTES=false` por defecto operativo

Efecto:

- snapshots públicos/internos devuelven `404` cuando no están habilitados;
- `StorefrontApi.listProducts()` y `StorefrontApi.listCategories()` no sirven snapshots en el stack actual;
- la navegación pública serializada ya no mezcla arrays heredados con overrides activos.

## Checklist funcional de cierre

### Navegación desktop/mobile

- `OK` menú general móvil con acordeón y jerarquía visual diferenciada
- `OK` menú categorías móvil con expansión por niveles
- `OK` selector de categorías del buscador reutilizando base visual compartida
- `OK` nav desktop sin apertura forzada por defecto en home activa
- `OK` aliases legacy derivados a rutas oficiales o fuera de flujo

### Categorías

- `OK` categorías reales provienen del backend
- `OK` slugs limpios alineados con backend (`aberturas`, etc.)
- `OK` selección por categoría en `/shop`
- `OK` categorías del home alineadas con la misma fuente del catálogo

### Búsqueda

- `OK` matching compartido entre dropdown y `/shop`
- `OK` búsqueda por producto y categoría
- `OK` “Ver todos los resultados” y click de resultados convergen al listado
- `OK` selector de categoría conserva selección
- `OK` dropdown móvil con scroll interno

### Shop y filtros

- `OK` barra superior de resultados activa
- `OK` conteo oculto en `/shop` limpio sin contexto
- `OK` categoría y query reflejan contexto real
- `OK` se removió heading/template anterior de shop

### Producto simple y paramétrico

- `OK` detalle de producto con slug limpio
- `OK` producto paramétrico alineado a contrato real admin/backend
- `OK` `parametric-config` y `parametric-quote` operativos en variante correcta
- `OK` sin campos legacy inventados del configurador

### Auth pública

- `OK` login/register/forgot-password oficiales en `/account/*`
- `OK` sesión pública no ensucia con `401` anónimo en storefront
- `OK` callback Google estabilizado

### Carrito / checkout

- `OK` flujo oficial en `/cart`, `/checkout`, `/payment`, `/review`
- `OK` checkout demo fuera del flujo público
- `OK` rutas legacy derivadas a flujo oficial

### Páginas públicas principales

- `OK` `/`, `/categories`, `/contact`, `/shop`, `/product/[slug]`
- `OK` `/products` preservado como alias oficial
- `OK` `/shops`, `/vendor`, `/checkout-demo`, `/mobile-category-nav` fuera de flujo

### Idiomas visibles

- `OK` textos estáticos activos revisados en `es` y `en`
- `OK` prioridad de idioma:
  1. preferencia del usuario autenticado
  2. navegador / estado cliente
  3. español por defecto

## Resultado del cierre

No quedan incidencias críticas abiertas dentro del alcance actual del storefront auditado.

Sí pueden quedar:

- ajustes cosméticos menores;
- refinamientos de UX;
- mejoras visuales puntuales;
- mejoras futuras de arquitectura (CMS, configurabilidad avanzada, modo estático, SEO profundo).

Esos puntos ya no deben extender este bloque.

## Backlog diferido

Queda explícitamente fuera de este cierre:

- CMS en backend para contenido estático
- configurabilidad avanzada de páginas/secciones/layouts
- modo estático/exportable
- multi-dominio / SEO por tenant
- CTA secundaria “Ver todo” en categorías con hijos
- ajustes cosméticos menores de menús/buscador
- mejoras visuales no críticas del home o catálogo
- reemplazo futuro de `quill` si se revisita ese riesgo residual aceptado

## Criterio de congelamiento

A partir de este documento:

- cualquier ajuste crítico o regresión real del storefront sí entra;
- cualquier mejora cosmética, refinamiento visual o idea de producto pasa a backlog;
- el bloque storefront se considera cerrado para poder avanzar con el roadmap general.
