# Analytics Operations Checklist

Checklist ejecutable para validar que el sistema de analytics está listo para operar en `dev`, `staging` y `production` sin acumulación silenciosa de basura.

## Uso

- Comando automático base: `cd backend && npm run analytics:health`
- Salida esperada: `OK` o `FAIL` con detalle por chequeo
- Para CI o parsing automático: `cd backend && npm run analytics:health:json`
- Para endpoints protegidos: crear una cookie jar con `POST /sign-in` y reutilizarla con `curl -b /tmp/analytics-auth.cookies`

## Fase 1: Arranque

### Paso 1: levantar infraestructura base

**Paso:** arrancar Redis, backend y worker.

**Comando:**

```bash
docker compose -f deploy/docker-compose.dev.yml up -d redis backend analytics-worker
```

**Resultado esperado:** los tres servicios quedan `Up` y el worker se conecta a Redis.

**Cómo validar:**

```bash
docker compose -f deploy/docker-compose.dev.yml ps redis backend analytics-worker
```

**Qué hacer si falla:**

- revisar `deploy/env/backend.dev.env`
- revisar que `ANALYTICS_QUEUE_URL` y `QUEUE_REDIS_URL` apunten a Redis
- revisar `docker compose -f deploy/docker-compose.dev.yml logs --tail=200 backend analytics-worker redis`

### Paso 2: validar health del backend

**Paso:** confirmar que la API responde y que la base está accesible.

**Comando:**

```bash
curl -s http://localhost:4000/api/healthz
curl -s http://localhost:4000/api/readyz
curl -s http://localhost:4000/api/health
```

**Resultado esperado:** `healthz.status=ok`, `readyz.status=ready`, `health.status=ok`.

**Cómo validar:** el JSON debe incluir `db=true` en `/api/readyz` y `/api/health`.

**Qué hacer si falla:**

- revisar `DATABASE_URL`
- revisar migraciones pendientes
- revisar logs del backend

### Paso 3: validar Redis y la cola

**Paso:** confirmar que Redis responde y que BullMQ está operativo.

**Comando:**

```bash
cd backend && npm run analytics:health -- --base-url http://localhost:4000
```

**Resultado esperado:** los chequeos `redis ping`, `bullmq queue snapshot` y `bullmq repeatable jobs` pasan.

**Cómo validar:** el output debe mostrar `OK` para Redis, colas y repeatables.

**Qué hacer si falla:**

- revisar `ANALYTICS_QUEUE_URL` / `QUEUE_REDIS_URL`
- revisar que Redis tenga persistencia habilitada
- revisar que el worker esté usando `ANALYTICS_QUEUE_WORKER=true`

### Paso 4: validar separación backend/worker

**Paso:** confirmar que el backend no ejecuta jobs y que el worker sí.

**Comando:**

```bash
docker compose -f deploy/docker-compose.dev.yml logs --tail=200 backend
docker compose -f deploy/docker-compose.dev.yml logs --tail=200 analytics-worker
```

**Resultado esperado:** el backend muestra enqueue y requests; el worker muestra ejecución, retries y completions.

**Cómo validar:** en los logs del worker deben aparecer jobs procesados; en los logs del backend no deben aparecer ejecuciones de sync.

**Qué hacer si falla:**

- revisar `ANALYTICS_QUEUE_WORKER`
- revisar que el servicio `analytics-worker` exista en el compose del ambiente
- revisar que no haya fallback inline en producción

### Paso 5: disparar sync manual por fuente

**Paso:** encolar un sync real para cada fuente conectada.

**Comando:**

```bash
ADMIN_EMAIL="${DEFAULT_ADMIN_EMAIL:-desarrollo@software-strategy.com}"
ADMIN_PASSWORD="${DEFAULT_ADMIN_PASSWORD:?set DEFAULT_ADMIN_PASSWORD before running analytics checks}"
curl -s -c /tmp/analytics-auth.cookies -X POST http://localhost:4000/sign-in \
  -H 'content-type: application/json' \
  -d "{\"email\":\"${ADMIN_EMAIL}\",\"password\":\"${ADMIN_PASSWORD}\"}" >/dev/null

GA4_CONNECTION_ID=$(curl -s -b /tmp/analytics-auth.cookies http://localhost:4000/api/analytics/connections | node -e "const fs=require('fs'); const rows=JSON.parse(fs.readFileSync(0,'utf8')); const row=rows.find((entry)=>entry.source==='ga4'); if (!row) process.exit(1); process.stdout.write(row.id);")
ADS_CONNECTION_ID=$(curl -s -b /tmp/analytics-auth.cookies http://localhost:4000/api/analytics/connections | node -e "const fs=require('fs'); const rows=JSON.parse(fs.readFileSync(0,'utf8')); const row=rows.find((entry)=>entry.source==='ads'); if (!row) process.exit(1); process.stdout.write(row.id);")
SEARCH_CONNECTION_ID=$(curl -s -b /tmp/analytics-auth.cookies http://localhost:4000/api/analytics/connections | node -e "const fs=require('fs'); const rows=JSON.parse(fs.readFileSync(0,'utf8')); const row=rows.find((entry)=>entry.source==='search_console'); if (!row) process.exit(1); process.stdout.write(row.id);")

curl -s -b /tmp/analytics-auth.cookies -X POST "http://localhost:4000/api/analytics/connections/${GA4_CONNECTION_ID}/ga4/incremental-sync"
curl -s -b /tmp/analytics-auth.cookies -X POST "http://localhost:4000/api/analytics/connections/${ADS_CONNECTION_ID}/ads/incremental-sync"
curl -s -b /tmp/analytics-auth.cookies -X POST "http://localhost:4000/api/analytics/connections/${SEARCH_CONNECTION_ID}/search-console/incremental-sync"
```

**Resultado esperado:** cada request devuelve un objeto de sync con `status=pending` o `status=running` y luego se actualiza a `success`.

**Cómo validar:**

```bash
cd backend && npm run analytics:health
curl -s -b /tmp/analytics-auth.cookies "http://localhost:4000/api/analytics/sync-runs?limit=20"
```

**Qué hacer si falla:**

- revisar logs del worker
- revisar credenciales OAuth de la fuente
- revisar que el job aparezca en `analytics_sync_runs`
- reintentar una sola vez después de corregir la causa

### Paso 6: validar persistencia de sync

**Paso:** verificar que el sync actualizó tablas normalizadas.

**Comando:**

```sql
select c.source, r.job_type, r.status, r.queued_at, r.started_at, r.finished_at, r.retry_count, r.partial_failure_flag, r.duration_ms, r.records_fetched, r.records_upserted
from analytics_connections c
join lateral (
  select *
  from analytics_sync_runs r
  where r.connection_id = c.id
  order by r.created_at desc
  limit 1
) r on true
order by c.source;
```

**Resultado esperado:** cada fuente conectada muestra una corrida reciente con `status=success` y timestamps poblados.

**Cómo validar:** no deben existir corridas recientes en `running` por más tiempo que el esperado para el volumen del día.

**Qué hacer si falla:**

- revisar `retry_count` y `error_message`
- revisar `last_sync_error_message` en `analytics_connections`
- revisar si el job quedó en `failed` pero sin persistencia actualizada

## Fase 2: Estabilidad

### Paso 1: validar ingestión de eventos propios

**Paso:** enviar un evento de prueba al endpoint canónico.

**Comando:**

```bash
curl -s -X POST http://localhost:4000/api/analytics/events \
  -H 'content-type: application/json' \
  -d '{
    "event":"page_view",
    "timestamp":"2026-04-29T12:00:00.000Z",
    "session_id":"runbook-session-001",
    "url":"https://example.com/producto/a",
    "user_agent":"Runbook/1.0",
    "event_id":"runbook-event-001",
    "page":"/producto/a",
    "path":"/producto/a",
    "referrer":"https://google.com",
    "utm_source":"google",
    "utm_medium":"cpc",
    "utm_campaign":"runbook_check",
    "utm_term":"cortinas",
    "utm_content":"header_cta",
    "device":"desktop",
    "country":"UY",
    "user_id":"runbook-user-001",
    "metadata":{"source":"ga4"}
  }'
```

**Resultado esperado:** la API responde con el evento persistido o con la representación canónica del evento procesado.

**Cómo validar:**

```sql
select event_name, event_timestamp, session_id, user_id, source, utm_source, utm_medium, utm_campaign, utm_term, utm_content, landing_page, conversion_flag, meta_status
from event_facts
where session_id = 'runbook-session-001'
order by created_at desc
limit 5;
```

**Qué hacer si falla:**

- revisar `curl http://localhost:4000/api/health`
- revisar logs del backend
- revisar si `event_facts` no recibió fila por validación o error de persistencia

### Paso 2: validar consistencia de atributos canónicos

**Paso:** comprobar que `source`, `medium`, `campaign` y `landing_page` se guardan con normalización consistente.

**Comando:**

```sql
select
  source,
  medium,
  campaign,
  landing_page,
  count(*) as total
from event_facts
where event_date >= current_date - interval '7 days'
group by source, medium, campaign, landing_page
order by total desc;
```

**Resultado esperado:** los valores de `source` quedan normalizados y no aparecen aliases incompatibles para el mismo canal.

**Cómo validar:** `meta`, `ga4`, `ads` y `search_console` no deben mezclarse con aliases crudos como `fb`, `facebook`, `gads` o `google_ads` en la capa canónica.

**Qué hacer si falla:**

- revisar `backend/src/analytics/event-taxonomy.ts`
- revisar el parseo de UTMs en ingestion
- corregir mapeos antes de seguir acumulando datos

### Paso 3: validar Meta Pixel en frontend

**Paso:** confirmar que el navegador carga Pixel y genera cookies de first-party.

**Comando:**

```javascript
window.fbq
document.cookie.includes('_fbp=')
document.cookie.includes('_fbc=')
```

**Resultado esperado:** `window.fbq` existe y las cookies `_fbp` y `_fbc` aparecen cuando el flujo de navegación las genera.

**Cómo validar:** usar la consola del navegador sobre el sitio real o staging y revisar la pestaña Network para requests hacia `facebook.com/tr`.

**Qué hacer si falla:**

- revisar el injector global del frontend
- revisar que el pixel id esté configurado
- revisar consent gating

### Paso 4: validar Meta CAPI en backend

**Paso:** confirmar que el backend marca entrega, deduplicación y estado.

**Comando:**

```sql
select event_name, meta_sent_at, meta_event_id, meta_status
from event_facts
where created_at >= now() - interval '24 hours'
order by created_at desc
limit 20;
```

**Resultado esperado:** los eventos enviados a Meta muestran `meta_status=sent` y `meta_event_id` poblado.

**Cómo validar:** no deben existir duplicados de `meta_event_id` en el mismo rango temporal.

**Qué hacer si falla:**

- revisar `META_ACCESS_TOKEN` y `META_PIXEL_ID`
- revisar `analytics_connections` para la fuente `meta`
- revisar `meta_status` en la fila afectada

### Paso 5: validar mismatch Pixel vs CAPI

**Paso:** comparar el flujo del navegador con la persistencia del backend.

**Comando:**

```sql
select meta_event_id, count(*) as total
from event_facts
where meta_status = 'sent'
  and meta_event_id is not null
  and created_at >= now() - interval '7 days'
group by meta_event_id
having count(*) > 1
order by total desc;
```

**Resultado esperado:** cero duplicados.

**Cómo validar:** si el navegador generó el evento y el backend también, el `event_id` debe coincidir entre capas.

**Qué hacer si falla:**

- revisar deduplicación por `event_id`
- revisar si Pixel y CAPI están usando la misma clave de evento
- revisar match quality y consent

### Paso 6: validar estabilidad del día 7

**Paso:** ejecutar el chequeo automatizado y revisar fallas persistentes.

**Comando:**

```bash
cd backend && npm run analytics:health -- --base-url http://localhost:4000 --json
```

**Resultado esperado:** `status=OK` o, como mínimo, no quedan fallas críticas en salud, cola, ingestión ni duplicación.

**Cómo validar:** revisar `sync runs failures 7d`, `event_facts critical nulls`, `source lag` y `meta delivery today`.

**Qué hacer si falla:**

- corregir la fuente con peor lag
- corregir duplicados antes de cargar más volumen
- no avanzar a producción si hay fallas persistentes

## Fase 3: Validación profunda

### Paso 1: medir data quality base

**Paso:** confirmar que no hay días vacíos y que la calidad no degrada en silencio.

**Comando:**

```sql
select event_date, count(*) as events
from event_facts
where event_date >= current_date - interval '30 days'
group by event_date
order by event_date;
```

**Resultado esperado:** no existen días con cero eventos salvo ventanas planificadas de caída o ambiente sin tráfico.

**Cómo validar:** comparar el conteo con el día anterior y con la misma ventana de la semana previa.

**Qué hacer si falla:**

- revisar despliegue de frontend y tracking
- revisar problemas de consentimiento o rotura de injector
- revisar si el backend dejó de recibir eventos

### Paso 2: detectar caídas abruptas

**Paso:** comparar día actual contra el día previo.

**Comando:**

```sql
with daily as (
  select event_date, count(*) as events
  from event_facts
  where event_date >= current_date - interval '14 days'
  group by event_date
)
select
  d1.event_date,
  d1.events,
  d2.events as previous_day_events,
  case
    when d2.events = 0 then null
    else round(((d1.events - d2.events)::numeric / d2.events) * 100, 2)
  end as percent_change
from daily d1
left join daily d2 on d2.event_date = d1.event_date - interval '1 day'
order by d1.event_date;
```

**Resultado esperado:** no hay caídas superiores al 60% sin explicación operativa.

**Cómo validar:** revisar si el cambio coincide con incidentes, releases o problemas de tracking.

**Qué hacer si falla:**

- revisar cambios de frontend
- revisar datos de consentimiento
- revisar errores de ingestión o un bloqueo en la cola

### Paso 3: detectar duplicados de negocio

**Paso:** verificar que no se repiten `event_id` ni `meta_event_id`.

**Comando:**

```sql
select event_id, count(*) as total
from event_facts
where event_id is not null
  and created_at >= now() - interval '30 days'
group by event_id
having count(*) > 1
order by total desc;
```

**Resultado esperado:** cero duplicados.

**Cómo validar:** repetir la query para `meta_event_id`.

**Qué hacer si falla:**

- corregir idempotencia antes de continuar
- no volver a sincronizar a ciegas

### Paso 4: validar sincronización de reporting

**Paso:** confirmar que las tablas diarias y `analytics_reporting_daily` siguen pobladas.

**Comando:**

```sql
select 'ga4' as table_name, count(*) as rows from analytics_ga4_daily_metrics
union all
select 'ads', count(*) from analytics_ads_daily_metrics
union all
select 'search_console', count(*) from analytics_search_console_daily_metrics
union all
select 'reporting', count(*) from analytics_reporting_daily;
```

**Resultado esperado:** el layer reporting no queda en cero si las fuentes están activas.

**Cómo validar:** cruzar la fecha más reciente con cada fuente y revisar que la ventana incremental actualiza datos.

**Qué hacer si falla:**

- revisar `analytics_sync_runs`
- revisar `analytics_data_quality_checks`
- revisar el worker y Redis antes de relanzar

### Paso 5: validar lag por fuente

**Paso:** medir retraso operativo de cada fuente sincronizable.

**Comando:**

```sql
select
  source,
  status,
  needs_reauth,
  last_successful_sync_at,
  last_synced_at,
  last_attempted_sync_at,
  last_sync_error_message
from analytics_connections
where source in ('ga4', 'ads', 'search_console')
order by source;
```

**Resultado esperado:** las fuentes activas están en `ready`, sin `needs_reauth`, y con `last_successful_sync_at` reciente.

**Cómo validar:** el lag no debe superar `36h` para fuentes sincronizables.

**Qué hacer si falla:**

- reauth de la fuente
- revisar developer token, property o permisos
- no dejar la fuente en `syncing` indefinidamente

### Paso 6: validar la capa de calidad de datos

**Paso:** revisar la tabla de quality checks.

**Comando:**

```bash
cd backend && npm run analytics:health -- --base-url http://localhost:4000
```

**Resultado esperado:** `data quality checks` no reporta fallas recientes.

**Cómo validar:** revisar `analytics_data_quality_checks` para status `warning` o `critical`.

**Qué hacer si falla:**

- corregir la fuente antes de volver a sincronizar
- evitar backfills masivos hasta entender la causa

### Paso 7: validar resiliencia

**Paso:** simular caída del worker y recuperación.

**Comando:**

```bash
ADMIN_EMAIL="${DEFAULT_ADMIN_EMAIL:-desarrollo@software-strategy.com}"
ADMIN_PASSWORD="${DEFAULT_ADMIN_PASSWORD:?set DEFAULT_ADMIN_PASSWORD before running analytics checks}"
curl -s -c /tmp/analytics-auth.cookies -X POST http://localhost:4000/sign-in \
  -H 'content-type: application/json' \
  -d "{\"email\":\"${ADMIN_EMAIL}\",\"password\":\"${ADMIN_PASSWORD}\"}" >/dev/null

GA4_CONNECTION_ID=$(curl -s -b /tmp/analytics-auth.cookies http://localhost:4000/api/analytics/connections | node -e "const fs=require('fs'); const rows=JSON.parse(fs.readFileSync(0,'utf8')); const row=rows.find((entry)=>entry.source==='ga4'); if (!row) process.exit(1); process.stdout.write(row.id);")
docker compose -f deploy/docker-compose.dev.yml stop analytics-worker
curl -s -b /tmp/analytics-auth.cookies -X POST "http://localhost:4000/api/analytics/connections/${GA4_CONNECTION_ID}/ga4/incremental-sync"
docker compose -f deploy/docker-compose.dev.yml start analytics-worker
```

**Resultado esperado:** el job queda en cola, el worker retoma y el sync termina una sola vez.

**Cómo validar:**

```bash
cd backend && npm run analytics:health
curl -s "http://localhost:4000/api/analytics/sync-runs?limit=20"
```

**Qué hacer si falla:**

- revisar persistencia de Redis
- revisar el lock distribuido
- revisar si el job quedó duplicado o perdido

### Paso 8: salida production-ready

**Paso:** decidir si el sistema está listo para producción.

**Comando:**

```bash
cd backend && npm run analytics:health -- --base-url http://localhost:4000 --json
```

**Resultado esperado:** `status=OK`.

**Cómo validar:** deben cumplirse todas estas condiciones:

- todas las fuentes conectadas sincronizan sin error persistente
- `event_facts` recibe eventos correctamente
- Meta recibe eventos por Pixel y CAPI
- no hay jobs fallidos persistentes
- el lag está dentro del umbral
- los datos son consistentes entre fuentes
- la atribución completa cubre al menos `80%` de los eventos rastreables y `95%` de los eventos pagados

**Qué hacer si falla:**

- no promover a producción
- corregir primero la fuente, luego la cola, luego el dato
- repetir desde Fase 1

## Señales de alerta

- `analytics:health` devuelve `FAIL`
- `analytics_sync_runs` acumula errores sin recuperación
- `event_facts` presenta `source` nulo
- `meta_status` queda en `failed` o `not_configured` en staging/prod
- el worker no muestra jobs en logs durante horas
- Redis vuelve a cero después de reinicios porque la persistencia no está activa

## Automatización recomendada

- usar `cd backend && npm run analytics:health` como gate de despliegue
- usar `cd backend && npm run analytics:health:json` para CI y cron
- programar la ejecución diaria del script en staging y producción
