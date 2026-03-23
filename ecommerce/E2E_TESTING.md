# Storefront E2E Testing

Este storefront ahora usa [Playwright](https://playwright.dev/) para pruebas browser reales.

## Objetivo

Cubrir flujos que no pueden validarse bien con unit tests o solo con requests HTTP:

- `sessionStorage` y continuidad post-login
- login modal y navegación real
- verificación por email y reset por email
- regresiones críticas después de cambios en checkout/auth/wishlist

## Scripts

Desde [ecommerce/package.json](/Users/rodrigo/git/personal/react_admin_dashboard/ecommerce/package.json):

- `npm run test:e2e`
- `npm run test:e2e:headed`
- `npm run test:e2e:ui`

## Requisitos

Antes de correr la suite:

1. Tener levantados backend y storefront locales.
2. Tener una base local accesible en `127.0.0.1:5432`.
3. Tener instalados los navegadores de Playwright:

```bash
cd ecommerce
npx playwright install chromium
```

## Variables útiles

- `PLAYWRIGHT_BASE_URL`
  - default: `http://localhost:3000`
- `PLAYWRIGHT_STOREFRONT_API_URL`
  - default: `http://localhost:4000/api/storefront`
- `PLAYWRIGHT_DATABASE_URL`
  - default: `postgresql://postgres:postgres@127.0.0.1:5432/react_admin_dashboard?schema=public`

## Suite inicial

- [ecommerce/e2e/wishlist-post-login.spec.ts](/Users/rodrigo/git/personal/react_admin_dashboard/ecommerce/e2e/wishlist-post-login.spec.ts)
  - valida `sessionStorage` + login modal + agregado automático a favoritos
- [ecommerce/e2e/auth-email.spec.ts](/Users/rodrigo/git/personal/react_admin_dashboard/ecommerce/e2e/auth-email.spec.ts)
  - valida registro con mail + verificación
  - valida forgot/reset por email

## Criterio de regresión

Después de cambios sensibles en storefront conviene correr al menos:

```bash
cd ecommerce
npm run test:e2e
```

Esto deja una base mínima pero útil para CI/CD:

- browser real
- selectores estables con `data-testid`
- helpers que leen links de verificación/reset desde la base local

## Extensión recomendada

Próximos candidatos naturales para esta suite:

- wishlist/remove y recarga persistente
- add to cart desde `/shop` vs `/product`
- paramétricos publicados: coherencia `shop -> detail -> cart`
- checkout preview vs detalle de pedido
- compra cash pendiente de confirmación
