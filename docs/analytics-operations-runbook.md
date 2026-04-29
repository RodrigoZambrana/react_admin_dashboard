# Analytics Operations Runbook

Este runbook valida que el pipeline de analytics está sano de punta a punta y que no está acumulando basura silenciosa.

Si necesitás una versión ejecutable paso a paso, usá [docs/analytics-operations-checklist.md](/Users/rodrigo/Git/personal/react_admin_dashboard/docs/analytics-operations-checklist.md).

## Alcance

- backend API
- analytics worker
- Redis
- ingestión de eventos
- sync de GA4, Google Ads y Search Console
- persistencia en `event_facts`, tablas diarias y `analytics_reporting_daily`
- Meta CAPI y deduplicación
- observabilidad operativa básica

## Criterio operativo

El sistema pasa si:

- un job puede caer y reintentarse sin perder datos
- el worker puede reiniciarse sin duplicar syncs
- los eventos llegan a la base antes de cualquier análisis
- los datos diarias no presentan gaps grandes ni duplicados obvios
- los logs permiten entender qué falló sin abrir el código

## Endpoints y tablas

- Health API: `GET /api/healthz`, `GET /api/readyz`, `GET /api/health`
- Sync runs: `GET /api/analytics/sync-runs`
- Connections: `GET /api/analytics/connections`
- Data quality: `GET /api/analytics/data-quality`
- Reports runs: `GET /api/analytics/reports/runs`
- Events raw: `events`
- Facts canónicos: `event_facts`
- Sync audit: `analytics_sync_runs`
- DQ audit: `analytics_data_quality_checks`
- Reporting: `analytics_ga4_daily_metrics`, `analytics_ads_daily_metrics`, `analytics_search_console_daily_metrics`, `analytics_reporting_daily`

## Variables mínimas

- `DATABASE_URL`
- `ANALYTICS_QUEUE_URL` o `QUEUE_REDIS_URL`
- `ANALYTICS_QUEUE_NAME` si el despliegue lo parametriza
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_ADS_DEVELOPER_TOKEN`
- `META_ACCESS_TOKEN`
- `META_PIXEL_ID`
- `NODE_ENV`
- `SYNC_INTERVAL_MINUTES`
- `LOG_LEVEL`

## Día 1

### 1. Despliegue

1. Levantar la pila:

```bash
docker compose -f deploy/docker-compose.dev.yml up -d --build
```

2. Verificar servicios:

```bash
docker compose -f deploy/docker-compose.dev.yml ps backend analytics-worker redis
```

3. Verificar salud de backend:

```bash
curl -s http://localhost:4000/api/health
curl -s http://localhost:4000/api/readyz
```

4. Verificar Redis:

```bash
redis-cli -h 127.0.0.1 -p 6379 ping
```

5. Verificar worker por proceso y logs:

```bash
docker compose -f deploy/docker-compose.dev.yml logs --tail=200 analytics-worker
```

### 2. Sync manual

1. Identificar una conexión activa:

```bash
curl -s http://localhost:4000/api/analytics/connections
```

2. Disparar un sync manual por fuente:

```bash
curl -X POST http://localhost:4000/api/analytics/connections/:id/ga4/incremental-sync
curl -X POST http://localhost:4000/api/analytics/connections/:id/ads/incremental-sync
curl -X POST http://localhost:4000/api/analytics/connections/:id/search-console/incremental-sync
```

3. Confirmar que el run aparece y cambia de estado:

```bash
curl -s http://localhost:4000/api/analytics/sync-runs?limit=20
```

### 3. Ingestión de eventos

1. Generar un evento real o simulado desde el frontend.
2. Verificar persistencia:

```sql
select event_name, event_timestamp, session_id, user_id, source, utm_source, utm_medium, utm_campaign, utm_term, utm_content, landing_page, conversion_flag
from event_facts
order by event_timestamp desc
limit 20;
```

3. Validar que no haya basura obvia:

```sql
select
  count(*) as total,
  count(*) filter (where session_id is null) as missing_session,
  count(*) filter (where event_timestamp is null) as missing_timestamp,
  count(*) filter (where source is null) as missing_source
from event_facts
where event_date = current_date;
```

### 4. Meta

1. Disparar un evento que deba ir a Meta.
2. Validar columnas de entrega:

```sql
select event_name, meta_sent_at, meta_event_id, meta_status
from event_facts
order by created_at desc
limit 20;
```

3. Si `meta_status` no es `sent`, clasificar el motivo:

- `not_configured`
- `blocked_by_consent`
- `failed`

### 5. Criterio de salida de día 1

- backend, worker y Redis levantan
- el worker procesa al menos un job real
- `analytics_sync_runs` registra corrida con timestamps
- `event_facts` recibe datos estructurados
- Meta deja evidencia persistente o una razón explícita de no envío

## Día 7

### 1. Estabilidad

1. Revisar últimos 7 días de sync runs:

```sql
select status, job_type, count(*) as total
from analytics_sync_runs
where created_at >= now() - interval '7 days'
group by status, job_type
order by job_type, status;
```

2. Revisar duración y reintentos:

```sql
select
  job_type,
  avg(duration_ms) as avg_duration_ms,
  max(duration_ms) as max_duration_ms,
  avg(retry_count) as avg_retries
from analytics_sync_runs
where created_at >= now() - interval '7 days'
group by job_type;
```

3. Revisar errores repetidos:

```sql
select error_message, count(*) as total
from analytics_sync_runs
where status = 'failed'
  and created_at >= now() - interval '7 days'
group by error_message
order by total desc;
```

### 2. Calidad de datos

1. Verificar volumen mínimo diario:

```sql
select event_date, count(*) as events
from event_facts
where event_date >= current_date - interval '7 days'
group by event_date
order by event_date;
```

2. Detectar caídas bruscas:

```sql
with daily as (
  select event_date, count(*) as events
  from event_facts
  where event_date >= current_date - interval '14 days'
  group by event_date
)
select d1.event_date, d1.events, d2.events as previous_day_events
from daily d1
left join daily d2 on d2.event_date = d1.event_date - interval '1 day'
order by d1.event_date;
```

3. Verificar duplicados por clave natural:

```sql
select event_id, count(*) as total
from event_facts
where event_id is not null
group by event_id
having count(*) > 1
order by total desc;
```

### 3. Reporting

1. Confirmar poblado de tablas diarias:

```sql
select 'ga4' as table_name, count(*) from analytics_ga4_daily_metrics
union all
select 'ads', count(*) from analytics_ads_daily_metrics
union all
select 'search_console', count(*) from analytics_search_console_daily_metrics
union all
select 'reporting', count(*) from analytics_reporting_daily;
```

2. Confirmar que el layer canónico cruza fuentes:

```sql
select date, channel, source, medium, campaign, count(*) as rows
from analytics_reporting_daily
where date >= current_date - interval '7 days'
group by date, channel, source, medium, campaign
order by date desc, rows desc;
```

### 4. Criterio de salida de día 7

- no hay errores repetidos no explicados
- el volumen diario no cae a cero sin motivo
- los jobs muestran retry controlado
- las tablas diarias y reporting están pobladas y estables

## Día 30

### 1. Resiliencia

1. Simular caída del worker:

```bash
docker compose -f deploy/docker-compose.dev.yml stop analytics-worker
```

2. Encolar un sync mientras el worker está caído.
3. Levantar el worker:

```bash
docker compose -f deploy/docker-compose.dev.yml start analytics-worker
```

4. Confirmar que el job se procesa una sola vez.

5. Simular caída de Redis o cortar conectividad y validar que el sistema falla de forma explícita, no silenciosa.

### 2. Consistencia temporal

1. Revisar `queued_at`, `started_at`, `finished_at`, `duration_ms` y `partial_failure_flag`.
2. Confirmar que no existan corridas “pendientes” viejas.

```sql
select id, job_type, status, queued_at, started_at, finished_at, duration_ms, partial_failure_flag
from analytics_sync_runs
where created_at >= now() - interval '30 days'
order by created_at desc
limit 100;
```

### 3. Meta

1. Confirmar que Pixel y CAPI siguen alineados.
2. Verificar deduplicación por `event_id` y estado de entrega en DB.
3. Revisar ratio de `meta_status = 'failed'` o `blocked_by_consent`.

### 4. Detección de basura silenciosa

1. Buscar nulos en campos canónicos:

```sql
select
  count(*) filter (where source is null) as missing_source,
  count(*) filter (where campaign is null) as missing_campaign,
  count(*) filter (where landing_page is null) as missing_landing_page
from event_facts
where event_date >= current_date - interval '30 days';
```

2. Buscar valores inconsistentes de source:

```sql
select source, count(*) as total
from event_facts
where event_date >= current_date - interval '30 days'
group by source
order by total desc;
```

3. Revisar calidad operativa:

```bash
curl -s http://localhost:4000/api/analytics/data-quality?limit=100
curl -s http://localhost:4000/api/analytics/reports/runs?limit=50
```

### 5. Criterio de salida de día 30

- un restart del worker no duplica datos
- un fallo de API externa no deja el sistema en estado silencioso
- los datos siguen siendo cruzables
- no hay drift estructural entre fuentes

## Señales de alarma

- `analytics_sync_runs.status = failed` repetido sin patrón claro
- crecimiento de `event_facts` con `source` o `session_id` nulos
- tablas diarias vacías durante más de una ventana normal de sync
- `meta_status = failed` de forma sostenida
- `readyz` en `degraded` por DB
- worker sin logs de jobs durante horas

## Notas

- Si el compose prod falla, primero verificar que existan:
  - `deploy/env/backend.prod.env`
  - `deploy/env/frontend.prod.env`
  - `deploy/env/storefront.prod.env`
- La validación del worker se hace por proceso y logs; no debe ejecutarse dentro del backend API.
