# Sistema de Analítica Propio

## Estado actual del proyecto

- El repo está dividido en dos piezas principales:
  - `ecommerce/`: frontend Next.js App Router del storefront.
  - `backend/`: API NestJS + Prisma + PostgreSQL.
- Ya existía tracking parcial:
  - `ecommerce/src/lib/analytics.ts` enviaba eventos a `dataLayer` para GA4.
  - `ecommerce/src/components/GrowthScripts.tsx` cargaba GTM, GA4 y Meta Pixel según configuración.
  - `ecommerce/src/components/seo/ProductViewAnalytics.tsx`, `ecommerce/src/state/cart-context.tsx` y `ecommerce/src/app/(storefront)/(checkout)/payment/success/page.tsx` ya disparaban `view_item`, `add_to_cart` y `purchase`.
- El backend ya tenía capa de servicios, middleware global y PostgreSQL vía Prisma:
  - `backend/src/app.module.ts`
  - `backend/src/common/middleware/correlation-id.middleware.ts`
  - `backend/src/prisma/prisma.service.ts`

## Decisiones de integración

### Dónde se integra el tracking

- Tracking global:
  - `ecommerce/src/app/layout.tsx`
  - componente cliente `ecommerce/src/components/AnalyticsBootstrap.tsx`
- Tracking automático de clicks:
  - `ecommerce/src/lib/analytics/autoTrack.ts`
  - activado desde el layout con cleanup al desmontar
- Tracking de funnel:
  - `ecommerce/src/components/analytics/CheckoutAnalytics.tsx`
  - montado en `ecommerce/src/app/(storefront)/(checkout)/checkout/page.tsx`
- Tracking de negocio ya existente:
  - `view_item` sigue en `ProductViewAnalytics`
  - `add_to_cart` sigue en `cart-context`
  - `purchase` sigue en `payment/success`

### Cómo se estructura el módulo analytics

- Frontend:
  - `ecommerce/src/lib/analytics/index.ts`
  - `ecommerce/src/lib/analytics/session.ts`
  - `ecommerce/src/lib/analytics/tracking.ts`
  - `ecommerce/src/lib/analytics/autoTrack.ts`
  - `ecommerce/src/components/AnalyticsBootstrap.tsx`
  - `ecommerce/src/components/analytics/CheckoutAnalytics.tsx`
- Ingesta frontend:
  - `ecommerce/src/app/api/analytics/events/route.ts`
  - actúa como proxy y normaliza el payload antes de enviarlo al backend
- Backend:
  - `backend/src/analytics/analytics.module.ts`
  - `backend/src/analytics/analytics.controller.ts`
  - `backend/src/analytics/analytics.service.ts`
  - `backend/src/analytics/analytics.repository.ts`
  - `backend/src/analytics/analytics.types.ts`
- Persistencia:
  - Prisma model `AnalyticsEvent` en `backend/prisma/schema.prisma`
  - raw table `events` con `processed` / `processedAt`
  - normalized facts en `event_facts`
  - sesiones en `sessions`
  - migration SQL en `backend/prisma/migrations/20260428132000_analytics_normalization/migration.sql`

### Dependencias reutilizadas

- `navigator.sendBeacon` para envío no bloqueante desde el browser.
- `next/navigation` para pageview tracking por ruta.
- `GrowthScripts` y la configuración de integraciones existente para no duplicar GA4/GTM.
- `PrismaService` para persistencia y consultas.
- `CorrelationIdMiddleware` para trazabilidad entre frontend, proxy y backend.

## Alcance de la fase 1

- Se guarda el evento completo sin agregación previa.
- Se preserva compatibilidad con GA4.
- Se captura:
  - `page_view`
  - `view_item`
  - `add_to_cart`
  - `begin_checkout`
  - `purchase`

## Primera capa de métricas

- Endpoint backend:
  - `GET /api/analytics/metrics/funnel`
- Métricas que devuelve:
  - sesiones únicas
  - eventos totales
  - compras
  - revenue
  - conversión por paso del funnel
- Funnel por defecto:
  - `view_item`
  - `add_to_cart`
  - `begin_checkout`
  - `purchase`

## Fase 2 - Modelo analítico y pipeline

- El raw event store ahora se materializa como `events` y agrega `processed` / `processedAt` para poder consumirlo por batch sin duplicar trabajo.
- El pipeline batch vive en:
  - `backend/src/analytics/pipelines/normalize-events.job.ts`
  - `backend/src/analytics/pipelines/backfill-events.job.ts`
- El normalizador inserta facts en:
  - `event_facts`
  - `sessions`
- Las órdenes guardan atribución en:
  - `session_id`
  - `user_id`
  - `utm_source`
  - `utm_medium`
  - `utm_campaign`
  - `referrer`
- El front envía y preserva atribución desde:
  - `ecommerce/src/lib/analytics/session.ts`
  - `ecommerce/src/lib/analytics/tracking.ts`
  - `ecommerce/src/app/(storefront)/(checkout)/review/ReviewClient.tsx`
  - `ecommerce/src/app/(storefront)/(checkout)/payment/success/page.tsx`

## Dashboard operativo

- Endpoint:
  - `GET /api/analytics/dashboard`
- Devuelve:
  - `revenue`
  - `orders`
  - `conversionRate`
  - `funnel`
  - `channels`
  - `topProducts`
  - `insights`
- El funnel sigue disponible en:
  - `GET /api/analytics/metrics/funnel`
- El backend separa ingestión, procesamiento y consulta en capas distintas:
  - ingestión: `POST /api/analytics/events`
  - procesamiento batch: `POST /api/analytics/pipelines/normalize-events/run`
  - backfill: `POST /api/analytics/pipelines/backfill-events/run`

## Pipeline operativo

- Normalización batch:
  - corre cada 5 minutos desde `NormalizeEventsJob`
  - toma raw events no procesados
  - inserta facts con `source_event_id` único
  - marca raw events como procesados
- Backfill:
  - `POST /api/analytics/pipelines/backfill-events/run`
  - reprocese un rango sin duplicar facts gracias a la clave única
- Modelo consultable base:
  - `event_facts` para eventos normalizados
  - `sessions` para atribución y primeras/últimas visitas
  - `orders` para revenue y negocio

## Estrategia de evolución

- Mantener el módulo desacoplado dentro del repo mientras madura.
- El proxy del storefront ya deja listo el desacople para mover la ingesta a un microservicio sin tocar los puntos de tracking.
- El contrato de evento ya incluye:
  - `session_id`
  - `timestamp`
  - `url`
  - `user_agent`
  - `page`
  - `path`
  - `utm_source`
  - `utm_medium`
  - `utm_campaign`
  - `referrer`
  - `device`
  - `country`
  - `value`
  - `data`
- Eso permite crecer hacia:
  - fuentes externas
  - pipelines
  - dashboard centralizado
  - motor de insights con IA

## Nota de implementación

- El árbol exacto pedido en el enunciado incluía `pages/api`.
- En este repo el storefront usa App Router, así que la equivalencia real quedó en:
  - `ecommerce/src/app/api/analytics/events/route.ts`
