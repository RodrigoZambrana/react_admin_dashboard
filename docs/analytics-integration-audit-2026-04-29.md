# Analytics Integration Audit

Fecha: 2026-04-29

Este documento resume el estado real del repositorio respecto a GA4, Google Ads, Search Console y Meta Ads/CAPI, y traduce el hallazgo en un plan de cierre estructural.

## Resumen Ejecutivo

El repositorio ya tiene una base operativa sólida para analytics:

- OAuth backend para GA4, Google Ads y Search Console.
- Persistencia de credenciales cifradas.
- Tablas normalizadas por fuente.
- `event_facts` como capa central de eventos.
- `analytics_sync_runs`, `analytics_report_runs`, `analytics_report_reconciliations` y `analytics_data_quality_checks` para trazabilidad.
- Sync incremental, backfill y repair.
- Tracking frontend que envía únicamente al backend.

Después de la revisión y el ajuste realizado en este turno, el sistema queda **parcialmente production-ready**:

- fuerte en estructura y normalización,
- razonable en persistencia y trazabilidad,
- todavía débil en robustez operativa distribuida,
- y con Meta todavía dependiente de configuración backend, no de un flujo propio de conexión tipo OAuth.

## Estado Por Fuente

### GA4

Estado: **parcial / casi listo**

- Conexión: OAuth backend implementado en [`backend/src/analytics/ga4-connector.service.ts`](../backend/src/analytics/ga4-connector.service.ts).
- Autenticación: refresh token cifrado en `analytics_connection_credentials`.
- Property: selección explícita soportada.
- Sync: initial, incremental, backfill, repair.
- Persistencia: `analytics_ga4_daily_metrics` y `analytics_reporting_daily`.
- Trazabilidad: `analytics_sync_runs` y estado operativo en `analytics_connections`.
- Cobertura: sesiones, users, eventCount, keyEvents, purchases proxy y revenue.
- Errores: status `error`, `lastSyncErrorMessage`, `lastSyncErrorAt`, `needsReauth`, `nextSyncAt`.

Riesgos actuales:

- el pipeline sigue siendo local/in-process;
- no hay cola durable ni lock distribuido;
- la métrica `purchases` sigue siendo proxy de GA4, no verdad de negocio.

### Google Ads

Estado: **parcial / casi listo**

- Conexión: OAuth backend implementado en [`backend/src/analytics/ads-connector.service.ts`](../backend/src/analytics/ads-connector.service.ts).
- Autenticación: refresh token cifrado persistido.
- Config obligatoria: developer token + customerId por env/config efectiva.
- Sync: initial, incremental, backfill, repair.
- Persistencia: `analytics_ads_daily_metrics`.
- Trazabilidad: `analytics_sync_runs` y health en `analytics_connections`.
- Cobertura: clicks, impressions, cost, conversions, conversionValue, hasConversionData.

Riesgos actuales:

- customerId/developerToken siguen viniendo de config, no de un modelo de conexión con versionado propio;
- no hay validación fuerte de MCC/cadena jerárquica;
- no existe una capa de reconciliación multi-cuenta.

### Search Console

Estado: **parcial / casi listo**

- Conexión: OAuth backend implementado en [`backend/src/analytics/search-console-connector.service.ts`](../backend/src/analytics/search-console-connector.service.ts).
- Autenticación: refresh token cifrado persistido.
- Propiedad: selección de site/property explícita soportada.
- Sync: initial, incremental, backfill, repair.
- Persistencia: `analytics_search_console_daily_metrics`.
- Trazabilidad: `analytics_sync_runs` y health en `analytics_connections`.
- Cobertura: query, page, clicks, impressions, ctr, position.

Riesgos actuales:

- si la property no queda seleccionada, el flujo queda a mitad;
- la tabla no está enriquecida con claves de landing/source comunes para atribución cruzada;
- el modelo sigue siendo solo lectura, sin reconciliación de gaps entre API y baseline fuera de GA4.

### Meta Ads / Pixel / CAPI

Estado: **partial**

- Conexión: no hay OAuth Meta.
- Modelo real: configuración backend en `growth_config` + `meta-capi.service`.
- Pixel: el backend espera `metaPixelId`.
- CAPI: implementado en [`backend/src/analytics/meta-capi.service.ts`](../backend/src/analytics/meta-capi.service.ts).
- Persistencia: los eventos de negocio viven en `events` y luego en `event_facts`.
- Trazabilidad: `metaSentAt`, `metaEventId`, `metaStatus` en eventos.

Lo que sí existe:

- envío server-side a Meta CAPI;
- hashing de email/phone/external_id;
- gating por consentimiento;
- status de entrega persistido.

Lo que no aparece como implementado completo:

- no hay un injector claro de Pixel en frontend/storefront;
- no existe un flujo de autenticación Meta;
- no hay sync jobs Meta independientes;
- no hay tablas Meta Ads propias;
- la capa Meta depende de configuración, no de un conector con lifecycle equivalente a GA4/Ads/Search Console.

## Modelo De Integración

Estado: **consistente en backend, aún con una asimetría en Meta**

La arquitectura sí separa:

- configuración de conexión,
- ingestión,
- persistencia,
- consumo.

Evidencias:

- configuración en `growth_config` y secure config;
- ingestion en `POST /analytics/events`;
- persistencia en `events` y `event_facts`;
- sync externo por conector y `analytics_sync_runs`;
- consumo en `analytics_reporting_daily`, `analytics_report_reconciliations`, `analytics_data_quality_checks`.

Problemas detectados:

- Meta no sigue el mismo lifecycle que GA4/Ads/Search Console;
- no hay un bus/queue persistente para syncs;
- el scheduler vive en memoria;
- parte de la robustez depende de que una sola instancia esté viva.

## Validación Del Pipeline

### Tracking

Estado: **ready**

- Eventos definidos: `whatsapp_click`, `phone_click`, `form_submit`, `purchase_completed`, `lead_created`.
- Envío: frontend -> backend only, vía [`frontend/src/services/AnalyticsEventService.ts`](../frontend/src/services/AnalyticsEventService.ts).
- Consistencia: taxonomía centralizada en `backend/src/analytics/event-taxonomy.ts`.

### Ingestion

Estado: **ready**

- Endpoint unificado: `POST /analytics/events`.
- Validación/normalización: backend.
- Enriquecimiento: UTM, session, device, country, meta delivery fields.

### Persistencia

Estado: **casi listo**

- Estructura tabular normalizada.
- Idempotencia mediante `source_event_id` y `upsert`.
- Se evita depender del JSON crudo para consumo.

### Sync Externo

Estado: **parcial**

- Jobs definidos: initial sync, incremental sync, backfill, repair.
- Incremental + overlap: sí.
- Backfill: sí.
- Repair: sí.
- Control de errores: sí, con `analytics_sync_runs` y estado de conexión.
- Debilidad principal: scheduler en memoria, no durable.

## Modelo De Datos

Estado: **bueno, con un gap ya cerrado en esta revisión**

`event_facts` incluye:

- `event_name`
- `event_timestamp`
- `session_id`
- `user_id`
- `source / medium / campaign` vía UTM
- `page / product`
- `device / country`
- `conversion_flag`

Tablas por fuente:

- `analytics_ga4_daily_metrics`
- `analytics_ads_daily_metrics`
- `analytics_search_console_daily_metrics`
- `event_facts` para eventos canónicos

Capa canónica:

- `analytics_reporting_daily`

Observación:

- la base ya permite cruzar fuentes;
- lo que sigue faltando es una segunda capa canónica explícita para reporting multi-tenant/versionado de reglas si la plataforma crece.

## Consistencia Entre Fuentes

Estado: **parcial**

Se puede relacionar:

- tráfico GA4,
- costo Ads,
- intención Search Console,
- comportamiento propio de eventos.

Pero siguen existiendo diferencias:

- naming no siempre homogéneo;
- Meta no sigue el mismo contrato de conexión que las demás fuentes;
- no hay un identificador canónico compartido de campaign/source/landing_page para todo el ecosistema;
- la atribución cruzada sigue siendo parcial.

## Conversión

Estado: **partial**

Taxonomía presente:

- `whatsapp_click`
- `phone_click`
- `form_submit`
- `purchase_completed`
- `lead_created`

Cobertura:

- GA4: sí, a nivel de ingestión y reporting.
- Meta: sí, vía CAPI server-side.
- Persistencia interna: sí.

El sistema ya está preparado para conversiones, pero todavía depende de que la instrumentación de frontend y la calidad del matching estén completas para considerar la medición confiable.

## Robustez Operativa

Estado: **parcial**

Existe:

- `analytics_sync_runs`
- estados `running/success/failed`
- `nextSyncAt`
- `needsReauth`
- `lastSyncErrorMessage`
- backfill y repair

Falta:

- scheduler durable,
- queue/worker persistente,
- reintentos con backoff controlado por infraestructura,
- observabilidad centralizada de sync runs,
- aislamiento multi-instancia.

## Gaps Críticos

- Meta no tiene lifecycle simétrico al resto de fuentes.
- Scheduler in-memory.
- Falta de queue durable.
- Falta de capa explícita de versionado de datos/reporting.
- Falta de validación más fuerte de contratos de atribución compartidos.
- La base es estructurada, pero todavía no está blindada para ejecución distribuida.

## Plan De Acción

### Nivel 1 - Bloqueantes

- Durable worker/queue para syncs y normalization.
- Lock distribuido por conexión/job.
- Validación estricta de tokens y reauth.

### Nivel 2 - Estructurales

- Unificar Meta bajo el mismo modelo operativo de conexión.
- Añadir contratos canónicos para campaign/source/landing_page.
- Introducir versionado de reporting rules.

### Nivel 3 - Operativos

- Centralizar logs de sync.
- Alertas por fallas repetidas.
- Backoff y reintentos configurables.

### Nivel 4 - Evolutivos

- Capa analítica multi-tenant.
- Data contracts para consumidores futuros.
- Preparar métricas derivadas para IA sin tocar la capa raw.

## Estado Global

Clasificación actual: **casi listo**

Motivo:

- la base de datos y la separación de responsabilidades ya están bastante bien;
- el pipeline no depende del frontend para hablar con APIs externas;
- la normalización existe;
- pero la robustez operativa todavía no es plenamente production-ready en escenario distribuido.

## Ajuste Aplicado En Esta Revisión

Se agregó `conversion_flag` a:

- `events`
- `event_facts`

y se propaga desde la taxonomía de eventos de conversión durante la ingestión y la normalización.

