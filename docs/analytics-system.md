# Sistema de Analítica Propio

## Estado actual del proyecto

- El repo está dividido en tres superficies principales:
  - `ecommerce/`: storefront Next.js App Router, responsable de tracking interno y checkout.
  - `frontend/`: admin React + router, responsable del consumo de métricas y de la operación analítica.
  - `backend/`: API NestJS + Prisma + PostgreSQL.
- Ya existía tracking parcial:
  - `ecommerce/src/lib/analytics.ts` enviaba eventos a `dataLayer` para GA4.
  - `ecommerce/src/components/GrowthScripts.tsx` cargaba GTM, GA4 y Meta Pixel según configuración.
  - `ecommerce/src/components/seo/ProductViewAnalytics.tsx`, `ecommerce/src/state/cart-context.tsx` y `ecommerce/src/app/(storefront)/(checkout)/payment/success/page.tsx` ya disparaban `view_item`, `add_to_cart` y `purchase`.
- El backend ya tenía capa de servicios, middleware global y PostgreSQL vía Prisma:
  - `backend/src/app.module.ts`
  - `backend/src/common/middleware/correlation-id.middleware.ts`
  - `backend/src/prisma/prisma.service.ts`
- El admin local en `localhost:8080` usa autenticación del producto, no Google OAuth.
  - La cuenta validada en esta corrida es `desarrollo@software-strategy.com`.
- La capa operativa de analytics en admin ya existe como superficie separada:
  - `frontend/src/views/analytics/AnalyticsDashboard/*`
  - `frontend/src/configs/routes.config/appsRoute.tsx`
  - `frontend/src/configs/navigation.config/apps.navigation.config.ts`
- `Growth & Insights` sigue siendo una pantalla de configuración, no una vista de consumo de negocio:
  - `frontend/src/views/settings/GrowthSettings/index.tsx`
  - `frontend/src/views/analytics/AnalyticsDashboard/pages/AnalyticsGrowthInsightsPage.tsx`
- El export local de Google en `/Users/rodrigo/Personal/Proyectos/urucortinas/analitycs` sólo se usó como referencia manual de negocio; no existe todavía un pipeline en el repo que lo lea como input operacional.
- GA4 sigue siendo la prioridad de comportamiento onsite y ya está implementado el slice operativo base:
  - inicio de OAuth
  - callback seguro
  - storage cifrado de credenciales
  - selección de property
  - initial sync trazable
  - incremental sync
  - backfill
  - repair
  - health / retry
  - visibilidad en el panel operativo
- Google Ads ya quedó montado como conector read-only de reporting, usando OAuth + developer token + customerId:
  - inicio de OAuth
  - callback seguro
  - storage cifrado de credenciales
  - validación de access token contra `customerId`
  - initial sync trazable
  - incremental sync
  - backfill
  - repair
  - health / retry
  - visibilidad en el panel operativo
- Search Console sigue pendiente para una iteración posterior.

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
- Tracking de consumo en admin:
  - `frontend/src/views/analytics/AnalyticsDashboard/pages/AnalyticsOverviewPage.tsx`
  - `frontend/src/views/analytics/AnalyticsDashboard/pages/AnalyticsFunnelPage.tsx`
  - `frontend/src/views/analytics/AnalyticsDashboard/pages/AnalyticsConnectionsPage.tsx`

### Cómo se estructura el módulo analytics

- Frontend:
  - `ecommerce/src/lib/analytics/index.ts`
  - `ecommerce/src/lib/analytics/session.ts`
  - `ecommerce/src/lib/analytics/tracking.ts`
  - `ecommerce/src/lib/analytics/autoTrack.ts`
  - `ecommerce/src/components/AnalyticsBootstrap.tsx`
  - `ecommerce/src/components/analytics/CheckoutAnalytics.tsx`
  - `frontend/src/views/analytics/AnalyticsDashboard/*`
  - `frontend/src/services/AnalyticsService.ts`
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
- El material exportado de Google se considera insumo de referencia para análisis y validación manual, no fuente viva de ingestión.

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
- El panel operativo de analytics consume:
  - `GET /api/analytics/connections`
  - `GET /api/analytics/sync-runs`
  - `GET /api/analytics/insights`
- La UI administrativa separa consumo y configuración:
  - consumo: `frontend/src/views/analytics/AnalyticsDashboard/*`
  - configuración: `frontend/src/views/settings/GrowthSettings/index.tsx`
- El backend separa ingestión, procesamiento y consulta en capas distintas:
  - ingestión: `POST /api/analytics/events`
  - procesamiento batch: `POST /api/analytics/pipelines/normalize-events/run`
  - backfill: `POST /api/analytics/pipelines/backfill-events/run`

## Estado actual real de la corrida

### Implementado

- GA4 OAuth operativo en backend:
  - `POST /api/analytics/connections/ga4/start`
  - `GET /api/analytics/connections/ga4/callback`
  - `GET /api/analytics/connections/:connectionId/ga4/properties`
  - `PUT /api/analytics/connections/:connectionId/ga4/property`
  - `POST /api/analytics/connections/:connectionId/ga4/initial-sync`
  - `POST /api/analytics/connections/:connectionId/ga4/incremental-sync`
  - `POST /api/analytics/connections/:connectionId/ga4/backfill`
  - `POST /api/analytics/connections/:connectionId/ga4/repair`
- Credenciales GA4 guardadas cifradas en backend.
- `analytics_sync_runs` recibe trazabilidad de cada sync.
- El panel operativo muestra:
  - conexiones
  - sync runs
  - insights
- `Growth & Insights` se mantiene separado como configuración de tracking.
- La semántica de reporting quedó explícita:
  - `ga4_purchase_proxy` guarda el proxy de conversiones de GA4
  - `purchase` queda reservado para compra consolidada de negocio
- Google Ads quedó implementado como conector read-only:
  - `POST /api/analytics/connections/ads/start`
  - `GET /api/analytics/connections/ads/callback`
  - `POST /api/analytics/connections/:connectionId/ads/initial-sync`
  - `POST /api/analytics/connections/:connectionId/ads/incremental-sync`
  - `POST /api/analytics/connections/:connectionId/ads/backfill`
  - `POST /api/analytics/connections/:connectionId/ads/repair`
- Ads persiste:
  - `analytics_connections`
  - `analytics_connection_credentials`
  - `analytics_sync_runs`
  - `analytics_ads_daily_metrics`
- Ads usa:
  - OAuth scope `https://www.googleapis.com/auth/adwords`
  - `GOOGLE_ADS_DEVELOPER_TOKEN`
  - `GOOGLE_ADS_CUSTOMER_ID`
  - `googleAds:searchStream`
- El panel operativo ya muestra estado y syncs de Ads junto a GA4.

### Pendiente

- Search Console.
- Insights persistidos por regla y score.
- IA sobre métricas normalizadas y evidencia.
- Validación manual end-to-end adicional con una cuenta GA4 viva y una cuenta Google Ads viva en este entorno.
- Automatizar la programación de baseline / data quality si se quiere correr sin disparo manual.
- Canonical reporting final para Ads sobre métricas consolidadas de negocio si más adelante se necesita unificar valor, costo y revenue.

### Nota semántica del primer sync GA4

- El primer sync GA4 persiste:
  - sesiones
  - usuarios
  - event count
  - key events
  - revenue
- La columna `purchases` en `analytics_ga4_daily_metrics` todavía se rellena como proxy de `keyEvents`.
- No debe leerse todavía como compra unificada multi-fuente.
- La capa de reporting canónico usa `ga4_purchase_proxy` para evitar ambigüedad entre conversión de GA4 y compra de ecommerce.

### Nota semántica de Ads

- `analytics_ads_daily_metrics.conversion_value` guarda el valor de conversión reportado por Google Ads.
- No debe confundirse con revenue consolidado de negocio.
- El conector de Ads es read-only y no muta campañas.
- `customerId` se toma del entorno local/configuración del backend y se valida al completar OAuth.

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

## Flujo de conectores

### GA4

1. `POST /api/analytics/connections/ga4/start`
2. OAuth en Google con PKCE
3. `GET /api/analytics/connections/ga4/callback`
4. Guardado cifrado de `refresh_token` y `access_token`
5. Selección de property GA4
6. Initial sync
7. Incremental / backfill / repair

### Google Ads

1. `POST /api/analytics/connections/ads/start`
2. OAuth en Google con PKCE
3. `GET /api/analytics/connections/ads/callback`
4. Guardado cifrado de `refresh_token` y `access_token`
5. Validación de acceso contra `GOOGLE_ADS_CUSTOMER_ID`
6. Initial sync
7. Incremental / backfill / repair

### Search Console

- Pendiente de implementación.

## Nota de implementación

- El árbol exacto pedido en el enunciado incluía `pages/api`.
- En este repo el storefront usa App Router, así que la equivalencia real quedó en:
  - `ecommerce/src/app/api/analytics/events/route.ts`

## Conectores + IA

### Principio operativo

- `tracking` interno y conectores externos no se mezclan.
- `Growth & Insights` sigue siendo la pantalla de configuración de medición.
- Los conectores OAuth, sincronización y salud viven dentro de `AnalyticsModule`.
- La IA no calcula métricas y no consume JSON crudo.
- La IA solo consume métricas normalizadas, contexto y evidencia.

### Contratos backend agregados

- `GET /api/analytics/connections`
  - devuelve estado de conectores externos
  - estructura:
    - `id`
    - `source`
    - `status`
    - `target`
    - `lastSyncAt`
    - `nextSyncAt`
    - `needsReauth`
    - `health`
      - `lagMinutes`
      - `lastAttemptedSyncAt`
      - `lastSuccessfulSyncAt`
      - `lastErrorMessage`
      - `lastErrorAt`
- `GET /api/analytics/sync-runs`
  - devuelve historial de ejecuciones de sincronización
  - útil para auditar fallas, reintentos y cobertura
- `GET /api/analytics/insights`
  - devuelve insights persistidos y listos para mostrar
  - contrato base para la futura capa IA
- `POST /api/analytics/connections/:connectionId/ga4/incremental-sync`
  - ejecuta sync incremental con overlap
- `POST /api/analytics/connections/:connectionId/ga4/backfill`
  - reprocesa un rango histórico explícito
- `POST /api/analytics/connections/:connectionId/ga4/repair`
  - reintenta la última ventana fallida o una ventana explícita

### Modelo persistente agregado

- `analytics_connections`
- `analytics_connection_credentials`
- `analytics_sync_runs`
- `analytics_ga4_daily_metrics`
- `analytics_ads_daily_metrics`
- `analytics_search_console_daily_metrics`
- `analytics_reporting_daily`
- `analytics_insights`
- `analytics_ga4_daily_metrics` ya incluye:
  - `event_count`
  - `key_events`
- `analytics_reporting_daily` ya incluye:
  - `source`
  - `medium`
  - `landing_page`
  - `device`
  - `country`
  - `users`
  - `event_count`
  - `key_events`
  - `ga4_purchase_proxy`
- `analytics_connections` ya incluye health operacional:
  - `last_attempted_sync_at`
  - `last_successful_sync_at`
  - `last_sync_error_message`
  - `last_sync_error_at`

### Acuerdos

- La capa de conexión OAuth queda separada de la capa de configuración de tracking.
- `Growth & Insights` sigue siendo editable desde el admin y no se reemplaza por el dashboard.
- El dashboard consume métricas, insights y estado de conexión, pero nunca guarda credenciales.
- Las credenciales sólo existen cifradas en backend.
- El frontend sólo recibe `status`, `sync state`, `target` y fechas.
- El panel operativo actual muestra conexiones, sync runs e insights; no expone tokens ni secretos.

### Prioridad de fuentes

- La prioridad de fuentes no es fija; depende del objetivo de negocio.
- Para comportamiento onsite y validación del funnel, la primera fuente debe ser `GA4`.
- Para CAC y ROAS, la primera fuente debe ser `Google Ads`.
- Para SEO y demanda orgánica, la primera fuente debe ser `Search Console`.
- En este repo, la secuencia inicial recomendada es:
  1. `GA4`
  2. `Google Ads`
  3. `Search Console`
- Motivo: el dashboard ya prioriza `overview` y `funnel`, y el valor inicial más alto proviene de validar sesión, embudo y revenue con datos de comportamiento antes de expandir a coste y SEO.

### Avances

- Ya existe tracking propio, ingesta y normalización.
- Ya existe la primera capa de métricas de negocio.
- Ya existe la landing de analítica y páginas separadas por módulo.
- Ya quedó creada la base de datos y el contrato backend para conectores e insights.
- Ya existe una vista operativa para conexiones, sync runs e insights en el admin.

### Pendientes

- Implementar OAuth real para Google Ads y Search Console.
- Validar manualmente el OAuth GA4 contra una cuenta viva si faltara confirmar algún escenario extremo.
- Poblar `analytics_reporting_daily` desde fuentes normalizadas.
- Generar insights persistidos por regla y score.
- Conectar IA generativa sobre insights, no sobre eventos crudos.
- Conectar la UI operativa con estados reales de sincronización y reauth.

## Paridad GA4

- El baseline canónico para validación debe ser una query reproducible contra la GA4 API.
- El export local `Informe_panorámico.csv` quedó como referencia secundaria de sanity check y auditoría histórica.
- La operación real no depende del CSV manual:
  - el sync GA4 directo sigue corriendo por API
  - la reconciliación debe comparar API contra API o API contra baseline reproducible
- La reconciliación canónica ya se apoya en snapshots de baseline y data quality:
  - `analytics_baseline_snapshots`
  - `analytics_data_quality_checks`
- Persistencia nueva:
  - `analytics_baseline_snapshots`
  - `analytics_data_quality_checks`
- Jobs nuevos:
  - `baseline-sync.job`
  - `data-quality.job`
  - `backfill.job`
- La capa CSV sigue existiendo sólo como referencia secundaria.
- La paridad ahora se interpreta a partir de `analytics_data_quality_checks`:
  - `ok` -> baseline y sync alineados
  - `warning` -> divergencia moderada
  - `error` -> delta material o gap
  - `missing_baseline` -> no existe baseline reproducible para ese reporte
- El dashboard operativo de esta capa vive en:
  - `/app/analytics/data-quality`
- El catálogo canónico se mantiene como base de reportes reproducibles, pero la verdad operativa de calidad ya no depende del CSV.
- La reconciliación no usa raw events y no usa el CSV como fuente operativa.
- La capa de baseline / quality existe para decir:
  - qué reportes del baseline se reproducen por API
  - qué reportes tienen delta
  - qué reportes aún requieren cobertura o ajuste
- Próximo ajuste recomendado:
  - automatizar la programación del baseline diario
  - automatizar la programación de data quality post-sync
  - usar `GET /api/analytics/insights/input` como input para la futura capa IA
