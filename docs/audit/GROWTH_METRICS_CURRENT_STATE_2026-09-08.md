# Auditoría de estado actual — Growth Metrics

Fecha de corte: 2026-09-08
Alcance: auditoría estática y verificaciones locales, sin implementar funcionalidades ni ejecutar sincronizaciones contra proveedores.
Estado del documento: baseline de descubrimiento; no autoriza extracción física ni operaciones sobre campañas.

## 1. Dictamen ejecutivo

El repositorio contiene una base funcional considerable para un producto de métricas: ingestión de eventos propios, normalización, conectores OAuth de lectura para GA4, Google Ads y Search Console, una cola BullMQ con worker, controles de paridad/calidad, exports, healthcheck, insights y un panel administrativo amplio. No es correcto describirlo como una maqueta ni como un proceso exclusivamente en memoria.

Sin embargo, **Growth Metrics no está listo para operar como solución reusable, multi-tenant ni como fuente confiable de decisiones**. Los bloqueos principales son:

1. Hay una mutación real hacia Google Ads (`uploadClickConversions`) expuesta por un endpoint público y un endpoint público que lista sus recibos. También son públicos dos disparadores de normalización/backfill y varias vistas con datos operativos.
2. Los parsers de fecha de Google Ads y Search Console esperan `YYYYMMDD`, aunque esas respuestas usan normalmente `YYYY-MM-DD`; un valor no reconocido se reemplaza por la fecha actual. Esto puede concentrar y sobrescribir días históricos.
3. GA4 guarda `keyEvents` como si fueran `purchases`; el reporting diario vuelve a usar ese mismo proxy, pero deja `purchase` y `orders` en cero. Los controles de confianza comparan esas magnitudes incompatibles.
4. El dashboard considera toda orden creada como revenue y compra, sin distinguir presupuesto, pago confirmado, cancelación o devolución. Además combina compras provenientes de órdenes con eventos de navegador, con riesgo de doble conteo.
5. Sólo `AnalyticsEvent`, `EventFact` y comparaciones de eventos tienen `tenantId` útil. Conexiones, credenciales, sesiones, métricas diarias, reporting, insights, health y recibos de conversión son globales o usan un `global` implícito. Las consultas principales tampoco filtran por tenant.
6. El consentimiento se presume otorgado. El storefront carga GA/GTM sin gate de consentimiento, crea `_fbp`/`_fbc` antes del consentimiento, y Meta CAPI envía si el payload no declara lo contrario. Se persisten payloads con email, teléfono, IP y click IDs sin política de retención visible.
7. No existe ingesta de Meta Ads Insights. La página “Meta Ads” deriva tráfico de UTM/eventos propios y toma gasto/clicks/impresiones de `ReportingDaily`, tabla que hoy sólo alimenta GA4 con esos campos en cero. El nombre y la lectura comercial resultan engañosos.
8. Las señales WhatsApp actuales se limitan a una taxonomía de `whatsapp_click`, algunos clics del CRM administrativo y un chequeo de cobertura. Los enlaces WhatsApp del storefront no están instrumentados, y no existe contrato con la plataforma conversacional para mensaje iniciado, enviado, entregado, respondido, lead o venta atribuida.
9. Los contratos están duplicados y divergentes entre backend, admin y storefront. El endpoint de eventos usa una interfaz TypeScript sin validación runtime; acepta un body global de hasta 15 MB y confía en datos de identidad/tenant provistos por el cliente.
10. La separación actual es nominal: el workspace `metrics` del harness sólo apunta a `backend/src/analytics`, pero el producto real también incluye `backend/src/growth`, `backend/src/conversions`, `backend/src/insights`, Prisma, tracking del storefront, servicios/pantallas del admin, worker, scripts de salud y Compose. Analytics consulta directamente `Order` del Commerce Core en la misma base.

Conclusión: la próxima fase de Growth Metrics debe ser **remediación y cierre de especificaciones**, no ABM de campañas. Primero hay que asegurar el perímetro, corregir datos ya materializados, definir la verdad de negocio, cerrar tenancy/consentimiento y certificar la medición read-only. Las operaciones de campañas deben mantenerse como una fase separada y posterior.

## 2. Alcance y método

Se inspeccionaron, como mínimo:

- `backend/src/analytics`, `backend/src/growth`, `backend/src/conversions` y la dependencia de consulta `backend/src/insights`;
- modelos analytics, conversión y órdenes en `backend/prisma/schema.prisma` y sus migraciones;
- tracking y scripts de growth del storefront en `ecommerce/src/lib/analytics`, `ecommerce/src/components/analytics`, `GrowthScripts` y puntos de contacto WhatsApp;
- servicios, hooks, rutas y páginas analytics/growth del admin;
- worker, BullMQ/Redis, health monitor, workflow de CI y Compose de desarrollo, testing y producción;
- reglas del harness, arquitectura objetivo, roadmap, auditoría histórica y gates de extracción.

No se usaron credenciales reales, no se hicieron llamadas a GA4, Google Ads, Search Console o Meta, y no se inspeccionó una base productiva. Por lo tanto, esta auditoría certifica lo que el código puede hacer y sus riesgos; **no certifica que una cuenta concreta esté conectada, que los datos productivos sean completos ni que exista paridad real con las consolas externas**.

Verificaciones locales ejecutadas:

- `npx prisma validate`: exitoso.
- `npm run lint` en backend (`tsc --noEmit`): exitoso.
- tests focalizados de analytics y conversiones: 9 archivos, 19 tests, todos exitosos.
- test de contrato del storefront: 1 archivo, 2 tests, exitosos.

El resultado verde confirma que la baseline compila y que las pruebas existentes pasan; no reduce los huecos de cobertura detallados en la sección 11.

## 3. Arquitectura actual, tal como existe

```text
Storefront/browser ── POST /analytics/events ──> AnalyticsEvent (raw)
       │                         │
       │                         ├── fire-and-forget ──> Meta CAPI
       │                         └── job normalización ─> EventFact + AnalyticsSession
       │
       └── gtag/dataLayer (sin gate de consentimiento)

Admin/browser ────── POST /analytics/events ───> raw/facts
       └──────────── POST /conversions/track ──> Google Ads click conversion + receipt

GA4 / Google Ads / Search Console
       └── OAuth + BullMQ worker ──────────────> tablas diarias y reporting

Analytics/Insights/Admin
       ├── consulta tablas analytics
       └── consulta directa Order/OrderItem del Commerce Core
```

### 3.1 Inventario y ownership real

| Pieza | Estado actual | Ownership/dependencia observada |
| --- | --- | --- |
| `GrowthModule` | Configuración global de GA/GTM/Ads/SC/Meta e insights | Usa `SecureConfig` compartido; no tiene tenant |
| `AnalyticsModule` | Ingesta, conectores, reporting, confianza, insights, exports, worker | Importa Prisma, Growth y OpenAI; exporta repositorio y conector Ads |
| `ConversionsModule` | Mapea eventos y sube conversiones a Google Ads | Importa internals de Analytics/Growth y Prisma |
| `InsightsModule` | DAL con scopes y service keys para consumidores | Importa Analytics y Storefront; consulta tablas Prisma de ambos dominios |
| Tracking storefront | Eventos estructurales, dataLayer, gtag y contexto de atribución | Tipos propios, sin paquete de contrato ni consentimiento efectivo |
| Tracking admin | Eventos CRM/ventas y duplicación a `/conversions/track` | Mezcla actividad de operadores con conversiones de clientes |
| Prisma | Tablas raw/facts, conexiones, métricas, reporting, calidad, recibos | Mismo datasource y esquema que Commerce/CRM |
| BullMQ worker | Sync GA4/Ads/SC, normalización, baseline | Runtime separado en dev/prod, no en Compose de testing |
| Health monitor | Redis, cola, sync, ingesta, atribución, Meta, trust/parity | Script externo al módulo; lee la misma base y Redis |
| Admin analytics | Varias pantallas operativas | Algunas son funcionales; Marketing, Productos, Comportamiento y Conversiones son placeholders |

### 3.2 Tamaño y acoplamiento

El área revisada suma más de 29.000 líneas en 103 archivos. Dentro del backend destacan:

- `analytics.repository.ts`: 2.588 líneas;
- `insights.service.ts`: 2.218 líneas;
- `analytics.service.ts`: 1.606 líneas;
- `data-parity.service.ts`: 1.326 líneas;
- conectores GA4/Ads/Search Console: entre 811 y 1.111 líneas cada uno;
- `analytics.controller.ts`: 865 líneas;
- `analytics.types.ts`: 1.014 líneas;
- `analytics-queue.service.ts`: 664 líneas.

Esto no es sólo una cuestión estética. El repositorio contiene una superposición manual y ampliamente tipada con `any` sobre Prisma; el controller mezcla ingesta pública, OAuth, operaciones, reporting, exports y salud; y el worker levanta todo `AnalyticsModule`, incluido controller, Growth y dependencias de IA. La frontera de producto todavía no está expresada en puertos pequeños ni adapters reemplazables.

## 4. Estado por fuente y capacidad

| Fuente/capacidad | Lo implementado | Estado de confianza | Faltante para considerarlo cerrado |
| --- | --- | --- | --- |
| Eventos propios | Raw event, normalización idempotente por `sourceEventId`, funnel, UTM, CTA, anomalías | Parcial; cliente controla tenant/identidad y el contrato no se valida | DTO/schema runtime, auth de tenant, consentimiento, cuarentena, retención, tests E2E |
| GA4 | OAuth PKCE, properties, sync inicial/incremental/backfill/repair, reportes/paridad | Parcial; compras mal semantizadas y sin certificación live | Métrica `purchases` real, moneda/zona horaria, fixture contractual, reconciliación por tenant |
| Google Ads lectura | OAuth, campaña/día, impresiones, clics, coste, conversiones y valor | No confiable hasta corregir fechas y claves | Parser, cuenta/MCC, moneda, dimensiones/status, aislamiento por cuenta/tenant |
| Search Console | OAuth read-only, sites, query/page/día, paginación | No confiable hasta corregir fechas y latencia | Parser, cutoff por freshness, dimensiones necesarias, aislamiento por property/tenant |
| Meta Pixel | Loader e `init` | Incompleto | Consent mode, `PageView` y eventos, dedupe Pixel/CAPI, tests de navegador |
| Meta CAPI | Envío server-side y estado por raw event | Riesgoso | Default-deny consent, outbox/retry, timeout, lifecycle del token, catálogo estricto |
| Meta Ads Insights | Sólo se guarda account ID y se muestra una página | Ausente | OAuth/token lifecycle, sync read-only, esquema de campañas/adsets/ads y breakdowns |
| Conversiones Google Ads | Mapeo purchase/lead/contact, hashing, recibo/dedupe | Crítico: endpoint público y semántica de ID ambigua | Ingreso server-truth, autorización, consentimiento, cola, acción correcta, retry/reconcile |
| WhatsApp | Nombre de evento, mapeo CAPI y chequeo trust | Insuficiente y contaminado por clics internos del CRM | Tracking storefront + eventos canónicos de canal/conversación + atribución |
| Campañas/ABM | Ningún CRUD de campañas | Correctamente no iniciado, salvo mutación incidental de conversiones | Diseño separado, permisos, aprobación, dry-run, idempotencia, auditoría, rollback |

## 5. Hallazgos de seguridad y privacidad

### 5.1 Perímetro HTTP

Hallazgos críticos:

- `POST /api/conversions/track` no tiene autenticación ni autorización y puede provocar una escritura real en Google Ads.
- `GET /api/conversions/receipts` no tiene guard y expone transaction/event IDs, click IDs (`gclid`, `wbraid`, `gbraid`), valores, estados y errores.
- `POST /api/analytics/pipelines/normalize-events/run` y `POST /api/analytics/pipelines/backfill-events/run` son públicos y mutan/procesan grandes volúmenes.
- `GET /api/analytics/dashboard`, `overview`, `funnel`, `metrics/funnel`, `structural-quality`, `health`, `health/history` y `data-trust` son públicos. Varias respuestas contienen negocio, diagnóstico o errores internos.

Existe throttling global de 120 solicitudes por minuto, Helmet, CORS y un pipe de sanitización. No compensan la falta de autorización: el body global permitido es de 15 MB, `AnalyticsEventInput` es una interfaz borrada en runtime, y por ello `ValidationPipe` no valida ni aplica whitelist a este endpoint.

El servidor usa `trustProxy: true`; el controller prioriza `x-forwarded-for`, y además el body puede sobrescribir `client_ip_address`. En un despliegue que no restrinja proxies confiables, un emisor puede falsificar IP, afectar rate limit/atribución y aportar identidad incorrecta a CAPI.

### 5.2 OAuth y secretos

Aspectos positivos:

- GA4, Ads y Search Console usan state, PKCE, expiración y tokens cifrados con AES-256-GCM.
- Search Console solicita scope `webmasters.readonly`; GA4 usa scope de lectura.
- Las credenciales tienen cascade desde la conexión.

Riesgos:

- El state OAuth no almacena tenant ni identidad del usuario iniciador. Un callback válido queda asociado sólo a `connectionId`.
- `returnPath` acepta cualquier URL absoluta HTTP(S), y el `Origin` del request se conserva para construir el redirect. Falta una allowlist estricta, por lo que hay riesgo de open redirect post-OAuth.
- `/connections/ga4/callback` intenta completar secuencialmente sesiones GA4, Ads y Search Console, además de existir callbacks específicos; esto amplía complejidad y riesgo de clasificación incorrecta.
- `GrowthService.getOverview()` devuelve la configuración completa, incluido `metaConversionsApiToken`; el admin permite mostrarlo y copiarlo. Un secreto persistido debe ser write-only o quedar enmascarado.
- No hay versionado de la clave de cifrado ni workflow de rotación/re-encriptado visible.
- Los archivos `deploy/env/backend.*.env` están versionados con defaults de desarrollo/placeholder. No se observó un secreto real en esta revisión, pero producción puede arrancar con material criptográfico predecible si el sistema de despliegue no lo sustituye.

### 5.3 Consentimiento, PII y retención

- `readConsentFlag()` devuelve `true` cuando no hay decisión guardada.
- `GrowthScripts` carga GTM y gtag sin consultar consentimiento. Meta Pixel sólo se bloquea si el valor almacenado es exactamente `false`.
- La resolución de contexto crea cookies `_fbp` y `_fbc` aun sin consentimiento explícito.
- `MetaCapiService.resolveConsent()` devuelve permitido cuando el payload no contiene señal.
- Eventos del CRM incluyen email y teléfono en `metadata`; raw events y `requestPayload` de recibos persisten esos datos. El hashing ocurre sólo al formar algunos payloads salientes.
- No se identificaron políticas implementadas de minimización, TTL, borrado por sujeto, residencia, purpose/version del consentimiento ni redacción de logs/exports.

La política objetivo debe ser default-deny para marketing, independiente del consentimiento necesario para telemetría estrictamente operativa, con evidencia versionada de finalidad y origen.

## 6. Hallazgos de exactitud y confianza de datos

### 6.1 Fechas de Google Ads y Search Console

Ambos conectores implementan `parseDateDimension()` aceptando únicamente ocho dígitos. Si el valor no cumple, retornan `new Date()`. Los rows persistidos se extraen de `segments.date` y de la primera key de Search Console, respectivamente. Para formatos `YYYY-MM-DD`, el resultado es el día de ejecución, no el día reportado.

Impacto:

- series históricas incorrectas;
- upserts que pisan filas del mismo día/campaña o día/query/page;
- backfills que aparentan éxito por `recordsUpserted` aunque materializan fechas falsas;
- ROAS, CPA, CTR, tendencias, paridad e insights derivados no confiables.

La corrección requiere tests contractuales y un plan de identificación/borrado-reingesta de filas afectadas; no basta cambiar el parser hacia adelante.

### 6.2 GA4 y compras

El sync solicita `sessions`, `totalUsers`, `eventCount`, `keyEvents` y `totalRevenue`. Al persistir:

- `AnalyticsGa4DailyMetric.purchases = keyEvents`;
- `AnalyticsReportingDaily.ga4PurchaseProxy = keyEvents`;
- `AnalyticsReportingDaily.purchase = 0` y `orders = 0`.

`keyEvents` puede contener cualquier key event configurado y no equivale necesariamente a `purchase`. Nombrarlo `purchases` eleva un proxy a verdad de negocio.

### 6.3 Revenue, órdenes y funnel propios

`getOrdersInRange()` lee directamente todas las órdenes por `createdAt` y suma `grandTotal`:

- no filtra `documentType` (presupuesto vs orden);
- no exige pago confirmado;
- no descuenta cancelaciones, devoluciones o reembolsos;
- no normaliza monedas;
- no filtra tenant.

El frontend del storefront dispara `purchase` cuando existe `createdOrder` y el estado no es error, no cuando el pago queda confirmado. Como señal UX puede ser útil, pero no puede ser la conversión financiera canónica.

En productos, el servicio suma unidades compradas desde `OrderItem` y vuelve a incrementar compras desde `EventFact.purchase`; esto puede duplicar la misma operación. El funnel sólo cuenta sesiones únicas por etapa dentro del período; no verifica orden temporal, pertenencia a la misma trayectoria ni timeout de sesión. Sus ratios son aproximaciones de cobertura, no un funnel de cohortes.

### 6.4 Sesiones y atribución

- `AnalyticsSession.id` es global y no tiene tenant.
- El storefront guarda una sesión en `localStorage` sin timeout; puede durar indefinidamente, a diferencia de una sesión analítica estándar.
- Admin y storefront usan implementaciones distintas de sesión/atribución.
- Storefront captura UTM pero no `gclid`, `wbraid` o `gbraid`; el admin sí los captura, aunque el admin no es el origen habitual de adquisición ecommerce.
- La atribución first-touch se conserva indefinidamente y no hay modelo explícito first/last/non-direct touch.
- El chequeo de cobertura exige source + medium + campaign en cada evento. Tráfico directo u orgánico legítimo puede no tener UTM, generando warning aunque la medición sea correcta.

### 6.5 Normalización y cuarentena

Aspectos positivos:

- `sourceEventId` único brinda idempotencia a los facts.
- Se validan campos estructurales obligatorios y se crean anomalías.

Defectos:

- el batch normal omite al escribir facts `pageType`, `componentType`, `componentId`, `ctaId`, `ctaName`, `ctaType`, `ctaContext`, `ctaLocation` y `position`; el backfill sí los escribe. La misma señal produce facts distintos según el camino.
- los eventos inválidos se marcan `processed` después de registrar una anomalía. “quarantined” es sólo un contador; no existe una cola/tabla de cuarentena reintentable.
- ausencia de tenant se completa con `CLIENT_SLUG`/`CLIENT`, contrario a la regla objetivo de no inferir tenant en producción.
- `event_category` del storefront no coincide con las propiedades `category`/`eventCategory` que lee el backend. Las categorías ricas (`navigation`, `ecommerce`, `system`) se pierden y terminan reducidas a `engagement`/`conversion`.

### 6.6 Data trust

El monitor tiene valor operativo: persiste resultados y revisa silencio, conversiones, cobertura, alineación GA4, caída de tráfico, cola, sync y Meta. Pero hoy sus conclusiones no deben usarse como gate comercial porque:

- es global, no por tenant/source/account;
- compara `ga4DailyMetric.purchases` (en realidad `keyEvents`) con `ReportingDaily.purchase` (hoy cero);
- exige un `whatsapp_click`, `form_submit` y `purchase` en cada ventana, aun cuando una empresa/canal no tenga ese caso de uso;
- usa `createdAt` para silencio y `eventDate` para ventanas, mezclando latencia de pipeline y hora de negocio;
- no distingue “sin tráfico esperado” de “pipeline roto” ni freshness específica por proveedor;
- cada check de un run guarda una copia completa del resultado.

## 7. Evaluación específica de Meta y WhatsApp

### 7.1 Meta Pixel/CAPI

El Pixel se inicializa, pero el script no emite `PageView`. El tracker canónico llama dataLayer/gtag, no `fbq`; el único tracker que llama Pixel es el legado `tracking.ts`, actualmente importado sólo para reutilizar `createEventId`. En consecuencia, el flujo Pixel puede no generar eventos salvo que un contenedor GTM externo los reconstruya, dependencia que no está expresada ni testeada.

CAPI recibe todos los eventos ingresados. Para nombres conocidos existe mapping, pero los desconocidos se envían con el nombre original. El envío es fire-and-forget después de guardar raw:

- no hay outbox ni retry automático;
- un crash puede perder el envío;
- no hay timeout de red;
- error/response text puede llegar a logs y estado;
- `ensureConnection()` vuelve a cifrar y persistir el token en cada evento configurado;
- no hay lifecycle/OAuth ni expiración del token de Meta;
- el mismo `event_id` permitiría dedupe Pixel/CAPI, pero el Pixel canónico no envía el evento.

### 7.2 “Meta Ads” no equivale a Meta Ads Insights

`getMetaMarketingMetrics()` filtra eventos first-party por source/UTM Meta y calcula match quality por presencia de IDs. Para spend/clicks/impressions filtra `ReportingDaily`; hoy GA4 es quien escribe esa tabla y deja esos campos en cero. No se consulta Marketing API, campañas, conjuntos, anuncios, delivery, budget, attribution setting ni currency.

La pantalla debe llamarse “Señales Meta/Pixel+CAPI” hasta que exista el conector read-only de Ads Insights. Mostrar ceros como performance de Meta Ads puede llevar a decisiones equivocadas.

### 7.3 WhatsApp

Se identificaron tres universos que hoy se mezclan o faltan:

1. **Intención storefront:** clic en launcher, contacto o compartir presupuesto. Los enlaces existentes no llaman `trackEvent`.
2. **Actividad operativa interna:** clic de un usuario del CRM en teléfono/WhatsApp. Sí genera `whatsapp_click`/`phone_click` y puede terminar en el pipeline de conversiones; no representa adquisición del cliente.
3. **Hechos de canal:** conversación iniciada, mensaje entrante/saliente, aceptado, enviado, entregado, leído, respondido, lead calificado, cita/orden atribuida. No existe contrato de eventos desde Conversation Platform/channel adapters hacia Growth Metrics.

Se requiere una taxonomía que preserve actor (`customer`, `agent`, `automation`), direction, provider/account, conversation/message IDs, campaña/template cuando aplique, estado, timestamps del proveedor, consentimiento y correlación con lead/order. Un `whatsapp_click` debe seguir siendo microconversión, nunca sustituto de conversación o venta.

## 8. Contratos, multi-tenancy y seguridad de datos

### 8.1 Drift contractual

- Backend conoce source `meta`; el tipo del admin no.
- Admin usa `purchase_completed`; el catálogo backend no lo declara, aunque la normalización lo preserve como string.
- Backend exige estructura para `add_shipping_info`/`add_payment_info`; storefront no los define ni emite.
- Storefront envía `event_category`; backend busca otras claves.
- Los tipos de evento están copiados entre tres aplicaciones y no se validan mediante JSON Schema, DTO, OpenAPI o paquete versionado.
- No hay política de compatibilidad, deprecación o migración de `schema_version`.

### 8.2 Estado multi-tenant

| Entidad/camino | Tenant actual | Riesgo |
| --- | --- | --- |
| `AnalyticsEvent`, `EventFact`, comparación | Campo `tenantId` | El browser lo elige; consultas globales lo omiten |
| `AnalyticsSession` | Sin tenant | Colisión y mezcla de atribución |
| Connection/credentials/sync runs | Sin tenant | Una sola conexión efectiva por source |
| GA4/Ads/SC/ReportingDaily | Sin tenant; natural keys sin connection | Colisión entre cuentas/properties |
| ConversionReceipt | Default `global`; dedupe global | Falso duplicado o exposición entre tenants |
| Growth config/service keys | Una clave global en SecureConfig | Configuración y acceso compartidos |
| Insights, health, trust, exports | Global | Fuga y decisiones agregadas entre empresas |
| Commerce `Order` | Sin tenant en el modelo auditado | Arquitectura actual parece una instalación por cliente, no SaaS multi-tenant |

La solución no puede declararse multi-tenant agregando filtros opcionales. Debe decidirse y documentarse si el aislamiento será por base/schema/instalación o por `tenantId` en filas. Cualquier opción exige que el tenant provenga de identidad/autorización o de una credencial de ingesta, nunca de un header/body confiado ciegamente.

## 9. Jobs, colas, runtime e infraestructura

### 9.1 Lo que sí existe

- BullMQ + Redis, con worker separado en desarrollo y producción.
- Sync inicial, incremental con solapamiento de tres días, backfill y repair para GA4/Ads/SC.
- Reintentos exponenciales configurables.
- Lock distribuido por source+connection con liberación Lua segura.
- Jobs repetibles: scan de conexiones, normalización y baseline.
- Workflow `analytics-health` que levanta PostgreSQL, Redis, backend y worker en CI.
- Monitor persistente con alertas/digest Slack y health visible en admin.

### 9.2 Riesgos operativos

- La cola usa el nombre constante `analytics-pipeline`; el monitor acepta `ANALYTICS_QUEUE_NAME`. Un override hace que productor/worker y monitor observen colas distintas.
- Si no hay Redis, el backend cae silenciosamente a modo inline incluso en producción. Se pierde aislamiento y durabilidad.
- El lock expira a los 45 minutos y no se renueva; un sync largo puede solaparse con otro.
- Los conectores no usan timeout/cancelación, rate-limit adaptativo ni checkpoint por página/chunk.
- El scan devuelve `enqueued = dueConnections.length` aunque algunas conexiones se omitan o fallen.
- Un retry reutiliza el sync run que el conector ya dejó en `failed`; durante el backoff el estado puede comunicar fallo definitivo aunque haya reintento pendiente.
- `deploy/docker-compose.testing.yml` no incluye worker ni monitor; las solicitudes encoladas no se consumen en ese entorno.
- Redis de producción y testing se ejecuta con snapshot y AOF deshabilitados, sin volumen. Un restart pierde jobs en espera/retry. Desarrollo y el Compose de tests sí habilitan AOF.
- `depends_on` de producción expresa orden, no readiness de backend/base.
- Las tablas diarias guardan `connectionId`/`syncRunId` como strings sin FK en GA4/Ads/SC; la lineage puede quedar colgante.
- No se encontró un restore drill específico de Growth Metrics, política de retención ni objetivo RPO/RTO para raw/facts/credentials/Redis.

El modo inline es razonable como ayuda local, pero producción debe fallar cerrado o declarar explícitamente un modo degradado sin aceptar operaciones que aparenten durabilidad.

## 10. Frontend administrativo y experiencia operativa

Fortalezas:

- navegación y autorización visual para roles de Settings;
- páginas funcionales de overview, funnel, Meta signals, conexiones, health, insights, acceso DAL, calidad, paridad y exports;
- controles para OAuth, properties y sync inicial/incremental/backfill/repair;
- DAL con scopes y service keys almacenadas de forma hasheada/cifrada por el módulo Insights.

Brechas:

- Marketing, Productos, Comportamiento y Conversiones son páginas placeholder con promesas de funcionalidades futuras.
- “Growth & Insights” reutiliza la pantalla de settings, no una superficie de decisiones.
- el cliente `AnalyticsService.ts` y ConnectionsPage son monolitos de 1.169 y 1.323 líneas;
- el frontend protege por una feature general de Settings; el backend usa sólo roles admin/superadmin/ops. No hay capacidades finas como `metrics.read`, `connections.manage`, `sync.run`, `exports.read`, `secrets.rotate` o `campaigns.mutate`;
- la página de configuración materializa el token CAPI completo en memoria/UI;
- la pantalla Meta presenta datos que no son Ads Insights;
- el Data Access vive sobre `InsightsModule`, dependencia que no aparece en el workspace metrics del harness;
- no se encontraron tests focalizados del frontend analytics/growth.

## 11. Pruebas y release gates

Cobertura existente observada:

- analytics backend: repository, normalization, search intelligence, reporting, export, data parity/usage, taxonomy e IA;
- conversiones: sólo mapping de eventos;
- storefront analytics: sólo dos expectativas de normalización de nombre;
- CI health: arranque de stack y chequeo sintético de salud.

Huecos críticos:

- controllers y matriz de autorización pública/privada;
- validación/abuso del endpoint de ingesta;
- conectores con fixtures realistas de respuestas GA4/Ads/SC, incluidos formatos de fecha y paginación;
- OAuth state/user/tenant/redirect allowlist;
- queue, locks, reintentos, caída/restart de Redis y worker ausente;
- Meta Pixel/CAPI, consentimiento, dedupe, failure/retry;
- `ConversionsService` y payload Google Ads;
- conciliación order-created vs payment-confirmed/refund;
- aislamiento multi-tenant y colisiones de natural keys;
- storefront tracking end-to-end y blockers/beacon/network failure;
- WhatsApp desde clic hasta conversación/lead/order;
- tests de las páginas y servicios analytics del admin;
- restore/backfill/rebuild reproducible.

El gate `metrics.quick` actual ejecuta toda la suite de integración compartida del backend y no una suite de contrato propia. `metrics.release` sólo hace build. Para una extracción futura, el producto necesita gates propios de contrato, migración, seguridad, replay y compatibilidad con Commerce/Conversation/Admin.

## 12. Separación read-only vs operaciones de campañas

### Fase M — medición read-only y recomendaciones

Permitido:

- conectar y leer cuentas/properties;
- sincronizar, normalizar y reconciliar métricas;
- recibir eventos first-party con consentimiento/identidad verificados;
- enviar señales de medición explícitamente aprobadas (Pixel/CAPI/offline conversion) mediante outbox auditable;
- producir dashboards, exports, alertas e insights/recomendaciones;
- medir freshness, completitud, lineage y confianza por tenant/fuente.

No permitido en esta fase:

- crear, editar, pausar o borrar campañas/ad sets/ads;
- cambiar presupuesto, bidding, segmentación, creatividades o conversion actions;
- ejecutar recomendaciones de IA automáticamente;
- reutilizar el token de lectura como credencial de mutación sin un boundary independiente.

Nota: subir conversiones no es ABM de campañas, pero sí una mutación externa con impacto de optimización/facturación. Debe tratarse como operación privilegiada de medición, no como efecto lateral de un POST público.

### Fase O — Growth Operations/ABM, posterior

Sólo debe abrirse cuando Fase M tenga datos confiables y gates verdes. Cada comando necesita:

- capability específica y tenant/account scope;
- plan/diff y dry-run;
- aprobación humana configurable por riesgo;
- idempotency key y optimistic concurrency/version del recurso;
- límites de presupuesto y políticas;
- audit trail inmutable de actor, before/after, motivo y correlation ID;
- reconciliación con estado remoto;
- compensación/rollback cuando el proveedor lo permita;
- kill switch y separación de credenciales/servicio respecto del conector read-only.

## 13. Arquitectura objetivo incremental para Growth Metrics

Sin extraer físicamente todavía, la frontera lógica recomendada es:

```text
growth-contracts
  ├── event schemas/versioning
  ├── source/account/tenant IDs
  └── metric/query/command contracts

growth-ingestion
  ├── public collector (credential + consent + limits)
  ├── commerce event adapter
  └── conversation event adapter

growth-connectors-read
  ├── GA4
  ├── Google Ads reporting
  ├── Search Console
  └── Meta Ads Insights

growth-measurement-delivery
  ├── Meta Pixel/CAPI outbox
  └── Google Ads offline/enhanced conversions outbox

growth-core
  ├── normalization/session/attribution
  ├── canonical facts/aggregates/lineage
  ├── data trust/reconciliation
  └── recommendation model

growth-query-api + admin adapter
growth-operations (futuro, runtime/credenciales/capabilities separados)
```

Ownership objetivo:

- Commerce Core es dueño de order/payment/refund/fulfillment y publica eventos canónicos.
- Conversation Platform es dueña de conversación/mensaje/estado de canal y publica señales canónicas.
- Growth Metrics es dueño de credenciales de fuentes de métricas, raw/facts/aggregados, atribución, receipts de delivery e insights.
- Control Plane resuelve tenant/actor/capabilities; mientras no exista, debe haber un adapter explícito y testeado.

### Gates previos a extracción

Growth Metrics permanece en monorepo y base compartida hasta cumplir todos:

1. contrato versionado para eventos y query API;
2. ownership de order/conversation sustituido por eventos/API, sin `prisma.order` directo;
3. estrategia tenant probada;
4. migraciones/backup/restore/rollback ensayados;
5. secretos/configuración propios y rotables;
6. runtime/health/cola independientes, con Redis durable;
7. release suite propia y tests de compatibilidad de consumidores;
8. observabilidad, SLO y runbook;
9. pipeline de deploy independiente;
10. doble lectura/reconciliación y plan de cutover antes de mover datos.

## 14. Decisiones que el harness debe preservar

1. **Read-only primero:** conectores de reporting y recommendations antes de cualquier comando de campañas.
2. **Mutation boundary explícito:** CAPI/offline conversions y, más adelante, ABM viven fuera de los conectores read-only.
3. **No tenant implícito en producción:** identidad derivada de auth/service credential, no de body ni `CLIENT_SLUG` silencioso.
4. **No extracción por carpeta:** contrato, ownership de datos y release gate deben existir y estar verificados.
5. **Verdad de negocio del owner:** pago confirmado/refund desde Commerce; estados WhatsApp desde Conversation/Adapter; métricas proveedor desde cada API.
6. **Trust antes de IA:** ningún insight/recomendación acciona si freshness, completeness, reconciliation o consentimiento están degradados.
7. **Replays seguros:** raw inmutable, normalización versionada, idempotencia y lineage hasta source account/sync run/event.
8. **Secretos write-only y rotables:** nunca se devuelven completos al browser ni se guardan en defaults versionados.
9. **Compatibilidad explícita:** schema version, deprecación y contract tests para admin/storefront/commerce/conversation.
10. **Scope real del workspace:** el inventario metrics debe incluir Growth, Conversions, Insights/DAL, Prisma/migrations, tracking consumidor, worker/health e infraestructura, aunque los owners lógicos queden separados.

## 15. Backlog candidato detallado

Los siguientes IDs son candidatos para el backlog canónico. No implican implementación aprobada. El orden propuesto maximiza reducción de riesgo y trabajo independiente entre agentes.

### Ola 0 — bloquear riesgo y fijar contratos

#### GM-001 — Cerrar el perímetro HTTP de Metrics

- **Prioridad/fase:** P0, seguridad previa a operación.
- **Objetivo:** impedir lectura o mutación no autorizada y aplicar capacidades finas.
- **Alcance:** inventario de endpoints; auth para receipts, datos comerciales, health detallado y jobs; separar collector público; capabilities `metrics.read`, `metrics.manage_connections`, `metrics.run_sync`, `metrics.export`, `metrics.admin`; respuestas health públicas mínimas.
- **Fuera:** rediseñar dashboards o conectores.
- **Dependencias:** decisión de identidad/tenant y remediación general de auth del backend.
- **Aceptación:** ningún endpoint interno responde sin credencial válida; `/conversions/track`, receipts y pipelines no son públicos; matriz route×role/capability documentada.
- **Verificación:** tests controller/E2E 401/403/2xx, escaneo de decorators y prueba de regresión del collector.

#### GM-002 — Contrato seguro de ingesta pública

- **Prioridad/fase:** P0, medición.
- **Objetivo:** aceptar sólo eventos válidos, acotados y atribuibles a un tenant autorizado.
- **Alcance:** DTO/JSON Schema; límites menores de body/string/arrays/metadata; timestamp skew; catálogo/version; credential/signature por tenant/origin; rate limit dedicado; política de IP/proxy; dedupe; respuesta estable.
- **Fuera:** modelar todos los eventos futuros.
- **Dependencias:** GM-004 y contrato de Control Plane temporal.
- **Aceptación:** payload inválido, sobredimensionado, tenant ajeno o timestamp absurdo falla sin persistir ni enviar CAPI.
- **Verificación:** tests de property/fuzz, abuse/rate-limit, contract tests del storefront y prueba detrás del reverse proxy.

#### GM-003 — Consentimiento, PII y retención

- **Prioridad/fase:** P0, privacidad.
- **Objetivo:** separar telemetría necesaria de marketing y aplicar default-deny verificable.
- **Alcance:** modelo versionado de consent/purpose; gates para GTM/GA/Pixel/CAPI/Ads; minimización/redacción; retención por tabla; borrado por sujeto; export/log policy; inventario legal por tenant/región.
- **Fuera:** seleccionar un CMP comercial concreto sin requerimiento.
- **Dependencias:** definición legal/producto y GM-002.
- **Aceptación:** sin consentimiento marketing no se crean IDs Meta ni se cargan/envían tags marketing; cada señal saliente conserva evidencia de finalidad; PII raw tiene TTL y borrado probado.
- **Verificación:** tests de navegador para granted/denied/unknown/revoked, inspección de cookies/requests, jobs de retention en dry-run y delete test.

#### GM-004 — Contrato canónico versionado de eventos y métricas

- **Prioridad/fase:** P0, foundation.
- **Objetivo:** eliminar drift entre backend, admin, storefront, Commerce y Conversation.
- **Alcance:** schemas con owner; nombres/version; categorías; actor/origin; IDs/idempotencia; conversion lifecycle; error envelope; compatibilidad y deprecación; generación/validación de tipos.
- **Fuera:** paquete `shared` generalista sin ownership.
- **Dependencias:** catálogo de eventos de Commerce y Conversation.
- **Aceptación:** `event_category`, `purchase`/`purchase_completed`, shipping/payment steps, Meta/WhatsApp y sources tienen una semántica única; productores incompatibles fallan contract tests.
- **Verificación:** consumer-driven contracts en los tres frontends/backends y fixtures v1→vNext.

#### GM-005 — Aislamiento tenant/account end-to-end

- **Prioridad/fase:** P0, arquitectura.
- **Objetivo:** impedir colisiones/fugas y hacer reusable el producto.
- **Alcance:** ADR de aislamiento; tenant/account/property en conexiones, sesiones, daily metrics, reporting, receipts, trust, insights, exports y keys; claves únicas/FK; backfill/migración; tenant derivado de auth.
- **Fuera:** extraer repositorio o base en esta tarea.
- **Dependencias:** GM-001, GM-002, Control Plane temporal y plan de migración.
- **Aceptación:** dos tenants pueden conectar la misma fuente/campaign/query/session ID sin colisión; toda consulta y job queda scoped; no existe fallback `global` en producción.
- **Verificación:** suite de aislamiento con tenants A/B, constraints Prisma, pruebas negativas y query review automatizable.

#### GM-006 — Corregir fechas Ads/SC y reparar datos materializados

- **Prioridad/fase:** P0, exactitud.
- **Objetivo:** restaurar series por día confiables.
- **Alcance:** parser estricto `YYYY-MM-DD` y, donde corresponda, `YYYYMMDD`; error/quarantine en formato desconocido; identificación de filas sospechosas; backup; reingesta/backfill por conexión; reconciliation before/after.
- **Fuera:** agregar dimensiones nuevas.
- **Dependencias:** GM-005 para evitar reintroducir colisiones y acceso controlado a cuentas de prueba.
- **Aceptación:** ninguna fecha inválida se sustituye por “hoy”; los rangos reingresados coinciden con fixture/consola dentro de tolerancia.
- **Verificación:** unit fixtures reales anonimizados, integración con fake server, reporte de reparación y paridad diaria.

#### GM-007 — Definir verdad de conversión ecommerce

- **Prioridad/fase:** P0, contrato de negocio.
- **Objetivo:** distinguir intención, orden creada, pago confirmado, cancelación y refund.
- **Alcance:** eventos Commerce `order.created`, `payment.confirmed`, `order.cancelled`, `refund.*`; currency; transaction/order IDs; regla de revenue; adapter hacia Growth; conciliación con browser event.
- **Fuera:** implementar checkout/fulfillment del ecommerce.
- **Dependencias:** owner Commerce, GM-004 y backlog de cierre ecommerce.
- **Aceptación:** revenue y purchase canónicos proceden de estado confirmado del owner; presupuesto/cancelación no suman venta; refund revierte según política; browser event queda como señal UX.
- **Verificación:** contract tests Commerce→Growth, escenarios payment/refund, reconciliation orden-evento y no doble conteo.

#### GM-008 — Proteger y rediseñar Google Ads conversion delivery

- **Prioridad/fase:** P0, mutación de medición.
- **Objetivo:** hacer segura, correcta y auditable la carga offline/enhanced conversions.
- **Alcance:** retirar trigger público; separar conversion tag ID (`AW-*`), label y conversion action resource/ID; source server-truth; consentimiento; tenant dedupe; outbox/queue/retry; partial failure; reconcile/receipt seguro.
- **Fuera:** crear o editar campañas/conversion actions.
- **Dependencias:** GM-001, GM-003, GM-005 y GM-007.
- **Aceptación:** un browser no puede fabricar una compra; action resource es válido; una transacción se entrega como máximo una vez por tenant/action; fallo transitorio se reintenta.
- **Verificación:** mock de API Google v22, idempotencia concurrente, retry/DLQ, validación `validateOnly` en cuenta sandbox y auditoría de receipt.

#### GM-009 — OAuth, redirects y secretos endurecidos

- **Prioridad/fase:** P0, seguridad.
- **Objetivo:** vincular autorización a actor/tenant y reducir exposición de credenciales.
- **Alcance:** state con actor+tenant+source; callback único por source; allowlist de redirect; token CAPI write-only/masked; key version/rotation; validación de secretos obligatorios; evitar re-encriptar en cada evento.
- **Fuera:** cambiar de proveedor de secretos.
- **Dependencias:** GM-005 y plataforma de secretos disponible.
- **Aceptación:** callback cruzado/expirado/otro actor falla; no hay open redirect; ninguna API/UI devuelve token completo; rotación ensayada sin downtime.
- **Verificación:** tests OAuth negativos, URL allowlist, snapshot de respuestas y drill de rotación.

#### GM-010 — Normalización consistente y cuarentena reintentable

- **Prioridad/fase:** P0, data pipeline.
- **Objetivo:** producir el mismo fact válido por batch, backfill o replay.
- **Alcance:** mapping único; incluir campos estructurales omitidos; quarantine con reason/payload/version; estado raw explícito; retry/replay idempotente; métricas por causa.
- **Fuera:** rediseñar reporting.
- **Dependencias:** GM-004 y GM-005.
- **Aceptación:** batch y backfill generan facts equivalentes; inválidos no se marcan exitosos ni desaparecen; replay no duplica.
- **Verificación:** golden fixtures, comparación de caminos, property test de idempotencia y operación de quarantine en entorno de test.

### Ola 1 — certificar medición read-only

#### GM-011 — Semántica de sesión y atribución

- **Prioridad/fase:** P1, medición.
- **Objetivo:** producir sesiones y modelos de atribución explicables.
- **Alcance:** timeout/renewal; tenant en session; first/last/non-direct touch; captura UTM/gclid/wbraid/gbraid/fbclid; timezone; actor storefront vs admin; funnel ordenado por sesión.
- **Fuera:** atribución algorítmica/ML.
- **Dependencias:** GM-004/005.
- **Aceptación:** sesiones vencen conforme al contrato; admin no contamina adquisición storefront; cada conversión explica touchpoints.
- **Verificación:** timelines sintéticos, navegación cross-day, direct/organic/paid y comparación con GA4 documentada.

#### GM-012 — Reporting canónico y lineage

- **Prioridad/fase:** P1, datos.
- **Objetivo:** reemplazar agregados con nombres engañosos por métricas tipadas y rastreables.
- **Alcance:** separar `keyEvents`, `purchase`, orders y revenue confirmado; currency; source/account; merge de GA4/Ads/SC/own facts; FK/lineage a connection/sync/schema; reglas de dedupe.
- **Fuera:** data warehouse externo obligatorio.
- **Dependencias:** GM-005/006/007/010/011.
- **Aceptación:** cada KPI tiene definición, owner, grain, currency y lineage; no se suma proxy como purchase ni la misma compra dos veces.
- **Verificación:** metric contracts, reconciliation fixtures, constraints/FK y queries de lineage.

#### GM-013 — Certificación GA4 read-only

- **Prioridad/fase:** P1, conector.
- **Objetivo:** declarar GA4 apto con métricas/dimensiones correctas.
- **Alcance:** purchase real; properties; timezone/currency; pagination/quotas; timeout; incremental/backfill; freshness; fixture anonimizado; cuenta sandbox.
- **Fuera:** mutar configuración GA4.
- **Dependencias:** GM-005/009/012.
- **Aceptación:** sync repetido es idempotente y reproduce consola/export dentro de tolerancias por tenant/property.
- **Verificación:** unit contract, fake API, sandbox y reporte de parity firmado.

#### GM-014 — Certificación Google Ads reporting read-only

- **Prioridad/fase:** P1, conector.
- **Objetivo:** medir campañas con contexto suficiente y sin capacidad incidental de ABM.
- **Alcance:** customer/MCC y `login-customer-id`; campaign ID/name/status; currency; network; conversions/actions; quotas/timeouts; natural key tenant+account+date+campaign.
- **Fuera:** comandos de campaña y conversion delivery de GM-008.
- **Dependencias:** GM-005/006/009/012.
- **Aceptación:** múltiples cuentas no colisionan; coste/CTR/CPA/ROAS tienen moneda y definición; credencial/runtime de lectura está separado del mutation boundary.
- **Verificación:** fixtures searchStream, cuenta sandbox, reconciliation por campaña/día y test de permisos insuficientes.

#### GM-015 — Certificación Search Console read-only

- **Prioridad/fase:** P1, conector.
- **Objetivo:** producir SEO por property/query/page con freshness explícita.
- **Alcance:** cutoff por retraso de datos; domain/url property; country/device/search appearance si se aprueban; pagination; quotas/timeouts; claves tenant+property.
- **Fuera:** operaciones SEO externas.
- **Dependencias:** GM-005/006/009/012.
- **Aceptación:** no se marca incompleto un día aún no maduro; properties no colisionan; totales concilian dentro de tolerancia conocida.
- **Verificación:** fixtures paginados, sandbox/property test y reporte de freshness/parity.

#### GM-016 — Medición Meta Pixel+CAPI confiable

- **Prioridad/fase:** P1, delivery.
- **Objetivo:** obtener cobertura browser/server deduplicada y recuperable.
- **Alcance:** consentimiento; Pixel PageView/eventos; catálogo mapping; mismo event ID; CAPI outbox, timeout, retries/DLQ; test event code; match quality real; token lifecycle.
- **Fuera:** Ads Insights y ABM.
- **Dependencias:** GM-003/004/005/009/010.
- **Aceptación:** evento consentido aparece una vez tras dedupe; denied no sale; fallos quedan reintentables; custom no permitido no se envía.
- **Verificación:** test de navegador, payload snapshots, Meta test events/sandbox, crash/retry e inspección de delivery receipts.

#### GM-017 — Conector Meta Ads Insights read-only

- **Prioridad/fase:** P1, nuevo conector.
- **Objetivo:** reemplazar el pseudo “Meta Ads” por métricas reales de cuenta/campaña/adset/ad.
- **Alcance:** auth/token lifecycle; account selector; spend/impressions/clicks/reach/conversions/value; currency/timezone/attribution window; jobs/backfill/freshness; esquema y UI etiquetada.
- **Fuera:** crear/modificar campañas y usar señales first-party como sustituto de Insights.
- **Dependencias:** GM-005/009/012/016.
- **Aceptación:** la UI identifica origen y freshness; spend no proviene de GA4; múltiples accounts no colisionan; paridad documentada.
- **Verificación:** fixtures Graph API, cuenta de prueba, paginación/rate-limit y reconciliation por día/campaña.

#### GM-018 — Contrato y pipeline de señales WhatsApp

- **Prioridad/fase:** P1, integración.
- **Objetivo:** medir intención, operación de canal y resultado comercial sin confundir actores.
- **Alcance:** instrumentar enlaces storefront; excluir/separar clics de agentes; eventos Conversation/Adapter; estado/direction/provider; attribution a lead/order; tenant/idempotencia/consent.
- **Fuera:** automatizar respuestas IA o administrar WhatsApp.
- **Dependencias:** GM-004/005/007 y contrato de Conversation Platform.
- **Aceptación:** dashboard separa click, conversación iniciada, respuesta, lead y compra; un clic interno no se sube como conversión de adquisición.
- **Verificación:** contract tests de los tres productores, journey sintético click→conversation→lead→order y dedupe.

#### GM-019 — Data trust por tenant/fuente y gates de decisión

- **Prioridad/fase:** P1, calidad.
- **Objetivo:** convertir health/parity en evidencia utilizable para decisiones.
- **Alcance:** freshness específica; expected traffic; coverage por canal habilitado; reconciliación de métricas homólogas; severity/SLO; trust score por dataset; bloqueo de insights/action cuando degrada.
- **Fuera:** inventar tolerancias sin baseline.
- **Dependencias:** GM-012–018.
- **Aceptación:** un check no compara `keyEvents` con compras; tenant sin WhatsApp habilitado no falla por cero clics; cada insight expone trust/freshness.
- **Verificación:** escenarios healthy/stale/partial/no-traffic/mismatch y comparación con snapshots externos.

#### GM-020 — Robustecer cola, retries y entornos

- **Prioridad/fase:** P1, runtime.
- **Objetivo:** garantizar ejecución durable y observable.
- **Alcance:** nombre de cola único configurable; fail-closed prod; Redis AOF/volumen/backup; worker+monitor en testing; lock renewal; timeouts/cancel; checkpoints; estado retry; DLQ; conteos exactos.
- **Fuera:** cambiar BullMQ sin necesidad probada.
- **Dependencias:** infraestructura y GM-005 para locks scoped.
- **Aceptación:** restart no pierde job; sync >45m no se duplica; testing consume colas; retry se muestra como retry; ausencia Redis impide modo durable ficticio.
- **Verificación:** chaos/restart, lock concurrency, Compose testing/prod, queue metrics y recovery drill.

#### GM-021 — Observabilidad, retención, backup y recuperación

- **Prioridad/fase:** P1, operaciones.
- **Objetivo:** operar Growth Metrics con SLO, RPO/RTO y runbooks propios.
- **Alcance:** logs/traces/correlation; métricas de ingesta/lag/error/quota; alertas accionables; retención; backup Postgres/Redis/secure config; restore/rebuild desde raw; runbooks y on-call ownership.
- **Fuera:** observabilidad general de toda la plataforma.
- **Dependencias:** GM-019/020 y política de infraestructura.
- **Aceptación:** SLO/RPO/RTO publicados; alerta enlaza runbook; restore en entorno aislado recupera datos/lineage y secretos según procedimiento.
- **Verificación:** restore drill, synthetic checks, alert test y evidencia de dashboard/SLO.

#### GM-022 — Completar y corregir la experiencia admin

- **Prioridad/fase:** P1, producto.
- **Objetivo:** que cada pantalla muestre capacidades reales y acciones seguras.
- **Alcance:** renombrar Meta signals hasta GM-017; estados empty/stale/error; completar o retirar placeholders; capabilities; ocultar secretos; historial de jobs/receipts; definiciones y lineage visibles.
- **Fuera:** ABM de campañas.
- **Dependencias:** GM-001/009/012/019.
- **Aceptación:** ninguna vista presenta un cero desconocido como cero real; no promete datos ausentes; operaciones requieren capability y confirmación apropiada.
- **Verificación:** component/integration tests, accessibility, snapshots de estados y E2E de conexión/sync/diagnóstico.

#### GM-023 — Suite de contrato y release gate de Metrics

- **Prioridad/fase:** P1, calidad.
- **Objetivo:** permitir trabajo independiente de agentes sin romper consumidores ni datos.
- **Alcance:** suite propia para contracts, connectors, controller auth, tenancy, consent, queues, migrations, replay, UI y adapters; fixtures anonimizados; coverage/risk gates; smoke runtime.
- **Fuera:** exigir cobertura porcentual sin criterio de riesgo.
- **Dependencias:** tareas funcionales anteriores y harness.
- **Aceptación:** `metrics.quick`, `standard` y `release` tienen comandos específicos; un cambio incompatible o fuga tenant falla antes de merge.
- **Verificación:** ejecutar gates limpios en CI y mutation/negative tests sobre invariantes críticas.

### Ola 2 — modularización y separación real

#### GM-024 — Modularizar código y definir puertos/adapters

- **Prioridad/fase:** P2, estructura.
- **Objetivo:** reducir archivos monolíticos y dependencias internas compartidas.
- **Alcance:** controllers por superficie; repositories tipados por aggregate; ports de source, queue, clock, secrets, business events; separar insights IA de core; eliminar overlay Prisma `any`; owners y dependency rules.
- **Fuera:** reescritura total o cambio de framework.
- **Dependencias:** GM-004/012/023.
- **Aceptación:** ningún módulo consumidor importa `AnalyticsRepository` o connector concreto; límites se validan; unidades pequeñas tienen tests.
- **Verificación:** dependency graph/lint rules, typecheck sin overlay `any` crítico y suite release.

#### GM-025 — Desacoplar Commerce y Conversation mediante eventos

- **Prioridad/fase:** P2, separación.
- **Objetivo:** quitar acceso directo a tablas de otros productos.
- **Alcance:** adapters para business events; outbox del owner; consumer idempotente; read model Growth; dual-read y reconciliation durante transición.
- **Fuera:** mover tablas o repositorios inmediatamente.
- **Dependencias:** GM-007/018/024.
- **Aceptación:** Growth no usa `prisma.order` ni tablas de conversaciones; pérdida/replay de evento está controlada; owner conserva verdad.
- **Verificación:** contract/integration tests, dependency scan, dual-read parity y replay.

#### GM-026 — Runtime y datos separables de Growth Metrics

- **Prioridad/fase:** P2, extracción lógica.
- **Objetivo:** ejecutar el producto con config, health y lifecycle propios dentro del monorepo.
- **Alcance:** módulo de worker mínimo; API/query runtime; migraciones o schema ownership; secretos/Redis; deploy; health; backup/restore; service-to-service auth.
- **Fuera:** extracción Git antes de gates.
- **Dependencias:** GM-005/020/021/024/025.
- **Aceptación:** runtime puede desplegarse/reiniciarse sin levantar internals de Commerce/OpenAI; contratos mantienen consumidores; datos tienen owner inequívoco.
- **Verificación:** Compose/entorno aislado, release suite, compatibility tests y restore drill.

#### GM-027 — Corregir scope y gobernanza del harness para Metrics

- **Prioridad/fase:** P2, automatización.
- **Objetivo:** que agentes auditen el producto completo y respeten invariantes/gates.
- **Alcance:** registrar todos los paths consumidores/owners; matriz de archivos y verificaciones; reglas read-only/mutation; tenant/consent/data-trust invariants; evidencia/backlog links; evitar overlaps entre agentes.
- **Fuera:** modificar código funcional de Metrics.
- **Dependencias:** decisiones GM-004/005/023/024.
- **Aceptación:** una tarea sobre Metrics carga Growth, Conversions, Insights, Prisma, tracking, admin e infraestructura pertinentes; doctor/gates detectan omisiones.
- **Verificación:** harness doctor, dry-run de quick/standard/release y escenarios de routing de agentes.

### Ola 3 — Growth Operations, sólo después de certificar read-only

#### GM-028 — Especificar command plane de campañas

- **Prioridad/fase:** P3, diseño previo a implementación.
- **Objetivo:** definir una frontera segura y provider-neutral para ABM.
- **Alcance:** comandos/diffs; capability/approval policy; idempotencia; límites; audit; reconcile; rollback/compensation; separación de credenciales/runtimes; matriz Google/Meta.
- **Fuera:** ejecutar comandos reales.
- **Dependencias:** GM-019/021/023/026 y requerimientos operativos validados con usuarios.
- **Aceptación:** ADR y threat model aprobados; cada comando tiene precondiciones, riesgo, rollback y evidencia; no se reutiliza incidentalmente el conector read-only.
- **Verificación:** tabletop de fallos, contract tests del command model y revisión de seguridad.

#### GM-029 — Implementar Google Ads Operations con aprobación

- **Prioridad/fase:** P3, mutaciones controladas.
- **Objetivo:** permitir ABM Google Ads sólo bajo el command plane.
- **Alcance:** subconjunto aprobado de campañas/budget/status; dry-run; approval; idempotencia; audit; reconcile/rollback; quotas y kill switch.
- **Fuera:** autonomía IA o cobertura completa de Google Ads desde el inicio.
- **Dependencias:** GM-014 y GM-028; datos read-only certificados.
- **Aceptación:** ningún cambio remoto ocurre sin capability/policy; before/after es trazable; duplicar request no duplica cambio; kill switch bloquea writes.
- **Verificación:** sandbox, tests de concurrencia/idempotencia, approval E2E, rollback y audit export.

#### GM-030 — Implementar Meta Ads Operations con aprobación

- **Prioridad/fase:** P3, mutaciones controladas.
- **Objetivo:** permitir ABM Meta sólo bajo el mismo modelo seguro.
- **Alcance:** subconjunto aprobado de campaign/adset/status/budget; dry-run; approval; audit; reconcile/compensation; token scopes y kill switch.
- **Fuera:** publicación creativa irrestricta o autonomía IA.
- **Dependencias:** GM-017 y GM-028; Meta read-only certificado.
- **Aceptación:** equivalentes a GM-029 y diferencias del proveedor documentadas; métricas posteriores no se confunden con confirmación de comando.
- **Verificación:** cuenta sandbox, E2E de aprobación, reconcile eventual, compensation y evidencia de auditoría.

## 16. Secuencia recomendada y gates de salida

1. **Contención:** GM-001, GM-002, GM-003, GM-008 y GM-009.
2. **Contrato y tenancy:** GM-004, GM-005, GM-007, GM-010 y GM-011.
3. **Reparación/canonical data:** GM-006 y GM-012.
4. **Certificación de fuentes:** GM-013 a GM-018.
5. **Operabilidad y experiencia:** GM-019 a GM-023.
6. **Separación real:** GM-024 a GM-027.
7. **Campañas:** GM-028; sólo después, y por proveedor, GM-029/030.

Gate para afirmar “medición lista”:

- cero P0 abiertos;
- aislamiento tenant/account probado;
- consentimiento default-deny certificado;
- purchase/revenue desde Commerce reconciliado;
- GA4, Ads, SC y Meta declarados individualmente `ready`, `partial` o `not_configured`, nunca por ceros ambiguos;
- WhatsApp diferencia intención, conversación y resultado;
- queue/restore drills verdes;
- release suite propia verde;
- data trust por tenant sin comparaciones semánticamente inválidas.

Gate para comenzar ABM:

- el gate de medición lleva al menos una ventana operativa estable acordada;
- requisitos reales y roles de operación están aprobados;
- GM-028 y threat model aprobados;
- sandbox y límites presupuestarios disponibles;
- aprobación humana, audit, idempotencia, reconcile, rollback/compensation y kill switch probados.

## 17. Riesgos si se implementan features antes de cerrar este backlog

- optimizar campañas contra fechas, compras o revenue incorrectos;
- subir conversiones fabricadas o actividad interna del CRM;
- mezclar datos/credenciales entre empresas;
- incumplir consentimiento o retención de PII;
- perder jobs/señales en restart sin saberlo;
- consolidar contratos incompatibles en más productores;
- extraer un servicio que todavía depende de tablas y transacciones del monolito;
- automatizar recomendaciones de IA basadas en datos etiquetados como confiables sin serlo.

La base existente merece preservarse y modularizarse, no descartarse. Pero su cierre debe medirse por contratos, seguridad, verdad de negocio, paridad y operación recuperable; no por cantidad de pantallas o conectores presentes.
