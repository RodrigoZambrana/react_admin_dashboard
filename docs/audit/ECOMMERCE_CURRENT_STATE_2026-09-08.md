# Auditoría de estado actual — Commerce Suite

Fecha de corte: 2026-09-08
Alcance: backend de comercio y CRM, frontend administrativo relacionado y `ecommerce`/storefront.
Tipo de trabajo: auditoría de solo lectura; no incluye remediación ni implementación.
Estado recomendado: **NO-GO para operación real y para extracción física de productos**.

## 1. Propósito y relación con el objetivo general

El objetivo declarado del proyecto es ofrecer soluciones independientes pero interconectadas —Commerce/CRM, Storefront, Growth Metrics y Conversation Platform— reutilizables por distintas empresas y operables desde una experiencia unificada. Esta auditoría no toma un build exitoso ni documentación de cierre anterior como señal suficiente de producto terminado. Su función es establecer qué existe hoy, qué está verificado hoy, qué decisiones siguen abiertas y qué trabajo debe entrar al backlog antes de comenzar nuevas implementaciones.

El resultado es coherente con el marco de trabajo versionado del repositorio:

- `AGENTS.md` y `ai-harness/AGENTS.md` gobiernan el proceso y la trazabilidad.
- `docs/MASTER_PLAN_2026-09-08.md` es el roadmap vigente y `docs/GENERAL_AUDIT_2026-09-08.md` la línea de base inicial.
- `docs/TARGET_PRODUCT_ARCHITECTURE.md` define Commerce Suite como `commerce-core` + `admin-web` + `storefront-web`, manteniendo backend y CRM juntos durante el cierre por su esquema y transacciones compartidas.
- No corresponde extraer físicamente CRM, storefront o backend antes de documentar y verificar contratos, ownership de datos y gate de release.

Esta auditoría aporta la línea de base específica de ecommerce. Los candidatos `EC-xxx` del final son propuestas auditables para convertir en backlog canónico; no autorizan implementación por sí mismos.

## 2. Método, jerarquía de evidencia y límites

### 2.1 Jerarquía utilizada

1. **Evidencia actual:** código, esquema Prisma, manifiestos, configuración, tests, scripts, infraestructura y verificaciones ejecutadas el 2026-09-08.
2. **Documentación canónica:** harness, master plan, auditoría general y arquitectura objetivo.
3. **Evidencia histórica:** reportes `.qa/runs`, `docs/ecommerce/*`, `ecommerce/README.md` y runbooks anteriores. Sirve como contexto, pero no certifica el estado actual.

Cuando documentación y código difieren, este documento reporta el código. Cuando un flujo existe pero no se ejecutó contra dependencias reales, se clasifica como **implementado, no certificado**, no como cerrado.

### 2.2 Verificaciones actuales ejecutadas

| Superficie | Verificación | Resultado actual | Interpretación |
| --- | --- | --- | --- |
| Backend | `npm run lint` | pasa | TypeScript compila sin emitir |
| Backend | build con `SECURITY_LOOP_SKIP=1` | pasa | valida compilación, **no** el gate de seguridad |
| Backend | `npm run test:unit` | 13 archivos, 45 tests, todos pasan | cobertura selectiva definida por script |
| Backend | `npm run test:integration` | 23 archivos, 102 tests, todos pasan | integra módulos con dobles/mocks; no certifica proveedores |
| Admin | `npm run lint` | pasa con 3 warnings | quedan variables sin uso; no bloquea |
| Admin | build | pasa | Vite advierte chunks mayores a 500 kB |
| Admin | tests | 7 archivos, 26 tests, todos pasan | suite reducida, sin umbrales de cobertura |
| Storefront | tests | 7 archivos, 18 tests, todos pasan | suite unitaria muy menor respecto de la superficie |
| Storefront | build | pasa | advierte dependencia faltante de hook y usa configuración mínima al no alcanzar el backend durante prerender |
| Runtime local | probes a backend/admin/storefront | no había servicios escuchando | no se validó runtime actual ni transacción de punta a punta |
| E2E actual | Playwright | no ejecutado | el stack requerido no estaba levantado; no se infiere resultado de evidencia histórica |
| Dependencias runtime | `npm audit --json --omit=dev` por paquete | backend 25, admin 9, storefront 10 | hay deuda alta y una crítica en storefront; ver seguridad |

No se modificó código ni estado de datos para realizar estas comprobaciones. Las suites E2E se inspeccionaron, pero no se ejecutaron porque requieren servicios y base de datos y realizan escrituras directas.

### 2.3 Límites

- No se accedió a un entorno productivo, credenciales reales, datos de producción, Mercado Pago real, SMTP/SendGrid real ni backup externo.
- No se hizo pentest, análisis dinámico, prueba de carga, restore destructivo, migración ni deploy.
- No se calculó cobertura porque ningún paquete fija umbrales y el objetivo era no crear artefactos adicionales.
- Los conteos de `any`, tamaño de archivos y árboles legacy son indicadores de riesgo, no métricas de calidad por sí solos.

## 3. Dictamen ejecutivo

El sistema contiene una porción comercial considerable y coherente: catálogo simple/variable/paramétrico, precios calculados en backend, carrito y checkout, órdenes, stock concurrente básico, efectivo y Mercado Pago, cuenta de cliente, CRM, gestión administrativa, pagos contables, CMS, emails, notificaciones y órdenes de producción. No es un prototipo vacío.

Sin embargo, **no hay evidencia suficiente para operar**. Los bloqueantes principales son:

1. **Credencial compartida de clientes de checkout.** Los clientes creados sin contraseña reciben el mismo `storefrontDefaultPasswordHash`, derivado de `STOREFRONT_GENERIC_CUSTOMER_PASSWORD`, y el login acepta ese hash. Exigir un secreto fuerte en producción no elimina el problema: una misma credencial permite autenticar múltiples cuentas si se conoce su email o teléfono. Es un bloqueante crítico de identidad.
2. **Dependencia crítica en storefront y deuda alta en los tres runtimes.** El audit actual devuelve 1 crítica en `ecommerce`, además de vulnerabilidades altas en backend y admin. Storefront ni siquiera participa del security loop versionado.
3. **Pago real no certificado.** El webhook de Mercado Pago no verifica firma/replay; el E2E denominado “Mercado Pago success” cambia el intent directamente en base de datos en vez de probar aprobación y webhook reales.
4. **El gate actual no representa una compra operativa.** El script crítico filtra solo dos escenarios; cuatro escenarios de readiness están explícitamente `skip`; no cubre catálogo → pago → orden → admin → stock → notificación → fulfillment.
5. **Separación de productos aún insegura.** Commerce, CRM, inbox, analytics e IA comparten un Nest runtime y un esquema Prisma de 3.507 líneas/137 modelos. Los datos centrales de Customer, Product, Order, Payment y ShippingOption no tienen `tenantId`; no existen contratos públicos/versionados de commerce ni eventos durables de dominio.
6. **Operación incompleta.** Hay estructuras para producción y entrega, pero no una política verificada de fulfillment, reservas/expiración de stock, devoluciones/reembolsos, tracking, RPO/RTO, restore periódico ni observabilidad/SLO del checkout.
7. **Build tolerante a ausencia del backend.** El storefront puede prerenderizar con configuración mínima aun con fallbacks de negocio supuestamente desactivados; su health endpoint solo declara que Next responde y no comprueba el backend.

Conclusión: primero deben aprobarse decisiones de producto y seguridad, formalizarse ownership y gates y convertir esta auditoría en backlog. La primera remediación técnica debería ser la identidad insegura de clientes, seguida por supply chain/dependencias y webhook/pagos. No debe iniciarse refactor general ni nuevas features en paralelo con esos bloqueantes.

## 4. Topología actual y límites reales

### 4.1 Backend compartido

`backend/src/app.module.ts` ensambla en un único proceso NestJS módulos de Auth, Users, Customers, Orders/Budgets, Sales/Catalog/Pricing, Accounting, ProductionOrders, Storefront, Email/Notifications, CMS/Media, Inbox, Analytics, Growth, AI y Knowledge. Comparten `PrismaService` y una base PostgreSQL.

En términos reales, hoy no existen runtimes independientes para `commerce-core` y CRM. La cohesión transaccional entre Customer, Order, Payment, stock y producción justifica mantenerlos juntos durante el cierre, como ya decidió la arquitectura objetivo. Inbox/conversaciones, analytics e IA dentro de este backend son acoplamientos heredados que deben convertirse en puentes o contratos antes de retirarse.

### 4.2 Admin web

`frontend` es una aplicación React/Vite multi-dominio. Incluye rutas y vistas para órdenes, presupuestos, catálogo, productos paramétricos, envío, producción, CRM/clientes, pagos/contabilidad, CMS y configuración de Mercado Pago/email, pero también conversaciones, analytics, IA y otras plantillas. La variante se determina en build/runtime por `VITE_CLIENT_SLUG` y feature flags; no representa aislamiento de datos por tenant.

### 4.3 Storefront web

`ecommerce` es Next.js 15/React 19. La política `src/lib/public-route-policy.ts` distingue rutas oficiales de demos y las bloquea o redirige cuando `ENABLE_DEMO_ROUTES` está desactivado. Aun así, el código demo/vendor/shops y grandes datasets de plantilla permanecen compilables y parcialmente referenciados por componentes activos. La independencia de storefront como deployable existe a nivel de paquete, pero su contrato con backend es implícito y no versionado.

### 4.4 Estado frente a la arquitectura objetivo

| Condición para producto independiente | Estado | Evidencia/brecha |
| --- | --- | --- |
| Deploy separado | parcial | admin y storefront tienen imágenes; backend sigue alojando varios productos |
| Contrato API versionado | ausente | prefijo global `/api`, sin OpenAPI propia ni compatibilidad/versionado de commerce |
| Eventos versionados | ausente en commerce | hay timeline/notificaciones internos; no outbox ni schemas de `order.created`/`payment.confirmed` |
| Ownership de datos | conceptual, no aplicado | target documenta owner; esquema y servicios siguen compartidos |
| Tenant isolation | insuficiente | modelos comerciales centrales no tienen `tenantId` |
| Gate de release por producto | parcial/inconsistente | harness define comandos, pero seguridad omite storefront y E2E crítico es incompleto |
| Observabilidad y SLO | insuficiente | correlación y logs existen; no SLO/alertas específicas de checkout/pago/stock |
| Migración/rollback probado | no verificado | scripts y runbook existen; no evidencia actual de drill productivo |

## 5. Inventario funcional actual

Leyenda: **implementado** = hay código y pruebas parciales; **parcial** = falta política/caso principal; **no certificado** = no se verificó contra runtime/proveedor real; **ausente** = no se encontró capacidad material.

| Área | Capacidades encontradas | Estado y brecha principal |
| --- | --- | --- |
| Catálogo | productos simples, variables y paramétricos; categorías, opciones, variantes, imágenes, relaciones, SEO, matrices y tamaños estándar | implementado; complejidad concentrada y contrato no versionado |
| Precios | cálculo server-side, moneda, impuestos, conversiones y snapshot por línea/orden | implementado; requiere invariantes de monto/moneda contra proveedor y definición comercial de impuestos/FX |
| CMS/storefront | navegación, layouts, páginas, historias, media, SEO, revalidación | implementado; build admite fallback mínimo y permanece gran volumen legacy |
| Búsqueda/recomendación | listados, búsqueda, relacionados y categorías | implementado; E2E actual no certifica SEO/categorías porque readiness está skip |
| Carrito | identidad de línea paramétrica y estado cliente | implementado con test crítico de identidad; no es una compra completa |
| Checkout | resumen recalculado por backend, entrega, datos cliente, efectivo/MP | parcial; solo `home_delivery` y Uruguay, sin política final de stock/abandono |
| Identidad cliente | registro email/teléfono, Google OAuth, cookies access/refresh, verificación email, reset y eventos de seguridad | bloqueado por contraseña genérica compartida; OTP de recuperación por teléfono no se envía |
| Órdenes | alta storefront/admin, import/export, edición, estado, delivery, PDF, timeline, conversión presupuesto | implementado; efectos post-transacción y estados necesitan orquestación/política |
| Stock | decremento atómico `stock >= quantity`, variante/producto, restitución al cancelar | parcial; descuenta al crear orden, sin reserva/expiración ni ledger explícito |
| Mercado Pago | preference, card charge, resolve, intent persistido, sync, reconciliación y configuración segura | implementado, no certificado; webhook sin firma y E2E simulado por DB |
| Efectivo/pagos | pago `REGISTERED`, settlement, pagos parciales/adjuntos, contabilidad | parcial; falta política de confirmación, reembolso, conciliación y casos E2E actuales |
| CRM | cliente, estado, contactos, direcciones, perfil, órdenes, pagos, actividades y relación con conversaciones | implementado y fuertemente acoplado; falta lifecycle/privacidad/tenant ownership |
| Notificaciones in-app | registros deduplicados, audiencias, stream y BullMQ opcional | parcial; default `memory` fuerza inline, Redis productivo no persiste y no hay DLQ operativo |
| Email | SMTP/SendGrid/dev, templates, `EmailLog`, dedupe, reintentos BullMQ | implementado, no certificado; métricas son in-memory y no hay prueba de proveedor/alerta actual |
| Producción | WorkOrder/ProductionOrder, asignación, prioridad, fechas, dashboard y estados | parcial; solo habilitado para slug `urucortinas`, acepta saltos arbitrarios de estado y borrado |
| Fulfillment/envío | opción, fee, plazo, delivery fields y estados generales | parcial; sin shipment/tracking/carrier/entrega fallida/pickup/SLA definidos |
| Devolución/reembolso | `PaymentType.REFUND` y metadata de refunds de MP | estructura parcial; no se encontró workflow integral de devolución, stock, contabilidad y cliente |
| Backup/restore | scripts `pg_dump`, checksum/manifest, restore local y runbook | herramientas presentes, operación no certificada; no hay evidencia de schedule/offsite/cifrado/RPO/RTO/drill actual |

### 5.1 Flujo de compra observado

El backend recalcula la cotización y no confía únicamente en el monto del cliente. `checkoutToken` se transforma de forma determinista en UUID de orden, aportando idempotencia básica. Dentro de la transacción se descuenta stock y se crean orden/items; luego ocurren sincronización de dirección, asociación del intent y notificaciones.

Hay una brecha de consistencia: el cliente puede crearse y recibir tareas de bienvenida/verificación antes de la transacción de orden; después del commit, address sync o asociación del intent pueden fallar. El token permite reintentar, pero no sustituye una saga/outbox ni una cola explícita de reparación. La reconciliación de intents aprobados se ejecuta al arrancar `StorefrontService`, con máximo 25 por vez, y registra algunos estados en metadata; no se encontró job dedicado, panel de excepciones ni SLA de reconciliación.

### 5.2 Stock

`OrderStockIntegrityService` agrupa cantidades y usa `updateMany` condicionado por stock suficiente, lo que evita overselling simple bajo concurrencia. Los productos con stock permanente se omiten. La restitución ocurre al pasar una orden a estado cancelado.

No existe entidad de reserva ni vencimiento. Una orden pendiente/efectivo retiene stock indefinidamente salvo cancelación. La política para pago fallido, checkout abandonado, reembolso, cambio desde/hacia cancelado, edición de cantidades y producto fabricado a medida no está cerrada. Una transición forzada permite excepciones y necesita auditoría. Esto es decisión de dominio, no un detalle técnico.

### 5.3 Pagos

`StorefrontPaymentIntent` guarda estado, monto, moneda, identificadores externos, request/idempotency data, snapshot y respuestas crudas. `externalPaymentId` e `idempotencyKey` están indexados pero no son únicos. `Payment` sí tiene unicidad por `(orderId, reference)`.

El webhook público acepta `type` e `id`, vuelve a consultar Mercado Pago y responde HTTP 200 incluso cuando el procesamiento falla (`received: false`). No se encontró validación de `x-signature`/`x-request-id`, protección contra replay o almacenamiento durable del evento recibido. La consulta autoritativa al proveedor reduce confianza en el cuerpo, pero no reemplaza autenticidad, rate policy, trazabilidad y semántica de retry.

La reconciliación crea la orden desde el checkout snapshot al encontrar un intent aprobado sin orden. Antes de confirmar contabilidad debe existir una invariante explícita que compare monto/moneda aprobados con el total esperado bloqueado; las discrepancias deben ir a revisión manual y jamás confirmarse silenciosamente.

### 5.4 Identidad de clientes

Cookies de storefront están separadas del JWT administrativo, con scope/token type, access corto, refresh y versión de sesión. Las contraseñas primarias usan bcrypt 12; reset y verificación almacenan hashes y límites.

No obstante, `StorefrontService.onModuleInit()` rellena `storefrontDefaultPasswordHash` para clientes sin contraseña. Los clientes creados durante checkout también reciben el mismo hash, y `login()` lo valida. Esta compatibilidad heredada transforma una variable global en contraseña compartida de cuentas reales. Debe eliminarse antes de cualquier piloto y migrarse a invitación, magic link, OTP real o establecimiento individual de contraseña. El OTP de recuperación por teléfono actualmente solo escribe un log enmascarado (`TODO`) y no envía SMS/WhatsApp, por lo que ese canal no es funcional.

### 5.5 Fulfillment y notificaciones

Las órdenes de producción tienen estados `PENDING`, `IN_PROGRESS`, `READY`, `DELIVERED`, `CLOSED`, `CANCELED`, pero el servicio permite asignar directamente cualquier estado válido y sincroniza WorkOrder sin validar transición ni timestamps. Además permite borrar la ProductionOrder. El módulo está hardcodeado a `CLIENT_SLUG=urucortinas`, por lo que no es todavía una capacidad reusable de Commerce Suite.

Notificaciones in-app y emails pueden usar BullMQ. Para notificaciones, el provider por defecto es `memory`, lo que activa dispatch inline aun cuando existe Redis si no se configura `NOTIFS_QUEUE_PROVIDER`. Email cae a inline sin URL. En producción Redis se inicia con snapshots y AOF desactivados (`--save "" --appendonly no`), de modo que una caída puede perder jobs pendientes. Hay reintentos y logs de fallo, pero no se encontró DLQ/replay/dashboard/alerta ni prueba de recuperación.

## 6. Datos y Prisma

### 6.1 Estado actual

`backend/prisma/schema.prisma` contiene 3.507 líneas y 137 declaraciones `model`. En el mismo esquema conviven commerce, CRM, seguridad, conversación/inbox, analytics, IA/knowledge, CMS y configuración.

Núcleo comercial relevante:

- identidad/CRM: `Customer`, OAuth, phones, addresses, tokens, OTP, security events, wishlist y status;
- catálogo: `Product`, categorías, opciones/valores, variantes, imágenes, relaciones, review, matrices/configuración paramétrica y canonical configuration;
- venta: `Order`, `OrderItem`, timeline, payment plan/milestones, `Payment` y adjuntos;
- operación: `WorkOrder`, `ProductionOrder`, `ShippingOption`;
- proveedor: `StorefrontPaymentIntent`, `StorefrontOAuthSession`;
- contenido/configuración: CMS, media, `SystemConfig`, `Setting`, `SecureConfig`;
- comunicación: Notification y EmailLog.

### 6.2 Brechas de ownership y tenant

Los modelos `Customer`, `Product`, `Order`, `OrderItem`, `Payment`, `WorkOrder`, `ProductionOrder`, `StorefrontPaymentIntent` y `ShippingOption` no expresan `tenantId`. Algunas configuraciones canónicas, SEO y analytics sí lo hacen. El resolver de storefront usa un scope canónico/global, pero los datos comerciales siguen siendo globales en la base.

Esto impide afirmar aislamiento multi-tenant y bloquea una extracción reusable segura. Antes de migrar datos se necesita decidir entre:

- base/esquema por tenant;
- filas compartidas con `tenantId` obligatorio y constraints compuestos;
- despliegue por cliente como fase transitoria explícita.

La decisión debe incluir claves únicas (email, teléfono, SKU, shipping name, external payment IDs), relaciones, índices, borrado, import/export, backups, analítica y estrategia de backfill. Agregar una columna sin esas reglas no resuelve tenancy.

### 6.3 Migraciones

Existe una baseline consolidada y migraciones posteriores para analytics, CMS, producto y SEO, además de archivos históricos. El entrypoint puede aplicar `migrate deploy`, pero `deploy/docker-compose.prod.yml` usa `PRISMA_APPLY_MIGRATIONS=false` por defecto mientras ejemplos de entorno lo fijan en true. Hace falta una única política verificable de predeploy, backup, migración, compatibilidad N/N-1 y rollback/roll-forward.

## 7. Integraciones externas

| Integración | Implementación encontrada | Evidencia actual | Brecha |
| --- | --- | --- | --- |
| Mercado Pago | SDK, preference/charge/resolve/webhook, secure config, intent y reconciliación | unit/integration con mocks | sin sandbox real, firma webhook, replay, mismatch y retry E2E |
| Google OAuth cliente | flujo PKCE/state/nonce y callback | tests de servicio | no verificado con proveedor/config real |
| Email | SMTP/SendGrid/dev, templates y logs | tests internos | sin entrega real, bounce/complaint ni alertas certificadas |
| SMS/WhatsApp para recovery | solo placeholder en storefront recovery | código explícito TODO | no funcional |
| Redis/BullMQ | email/notificaciones y otras colas | configuración y código | persistencia desactivada en compose prod; falta recovery |
| Cloudinary/media local | configuración y rutas de media | build/código | no verificado contra almacenamiento real/CDN/backup |
| Carrier/logística | no se encontró adapter | ninguna | requiere alcance de negocio |

## 8. Seguridad

### 8.1 Controles presentes

- Helmet; CSP se desactiva solo en desarrollo.
- CORS con allowlist, cookies firmadas, límites multipart y validación/sanitización global.
- rate limit global y límites más estrictos en varias rutas de auth/pago.
- JWT administrativo y storefront separados; cookies HTTP-only/secure en producción.
- correlation ID, filtro de errores y timeout interceptor.
- hash para contraseñas/tokens/OTP y eventos de seguridad.
- SecureConfig cifrado para configuración sensible de proveedor.

### 8.2 Hallazgos prioritarios

| Severidad | Hallazgo | Evidencia/impacto |
| --- | --- | --- |
| Crítica | contraseña genérica compartida para clientes de checkout | acceso transversal a cuentas si la credencial global se conoce; bloqueo de lanzamiento |
| Crítica/alta | 1 vulnerabilidad runtime crítica en storefront | audit actual; paquete directo `next` afectado según metadata de npm |
| Alta | webhook MP sin autenticidad/replay | endpoint público, sin headers de firma; riesgo de abuso/ruido y operación no trazable |
| Alta | autorización administrativa gruesa | Orders, Sales, Customers, Accounting y ProductionOrders usan solo `JwtAuthGuard`; navegación/capabilities cliente no garantizan enforcement servidor |
| Alta | E2E de pago no prueba proveedor | modifica el intent directamente en DB; puede dar falsa confianza de cierre |
| Alta | colas no durables en compose productivo | Redis sin AOF/snapshot; pérdida posible de notificaciones/email pendientes |
| Media/alta | logs de preference incluyen body completo | puede registrar PII o detalles de checkout; necesita redacción/clasificación |
| Media | rutas públicas sensibles con límites desiguales | crear orden, preview, resolve y webhook dependen principalmente del límite global |
| Media | recovery por teléfono no entrega OTP | experiencia engañosa y canal incompleto; no debe anunciarse como operativo |

El análisis de autorización es una brecha de assurance, no una afirmación de explotación: se requiere matriz endpoint × capability y tests negativos.

### 8.3 Dependencias actuales

Resultado de `npm audit --json --omit=dev` el 2026-09-08:

| Paquete | Total runtime | Crítica | Alta | Moderada | Baja | Directas destacadas |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| backend | 25 | 0 | 18 | 6 | 1 | Fastify static/platform, Prisma, mail stack, Mercado Pago, Excel/CSV |
| frontend | 9 | 0 | 2 | 5 | 2 | axios, DOMPurify, router, editor |
| ecommerce | 10 | 1 | 7 | 2 | 0 | Next, axios, lodash, sharp, styled-components |

Incluyendo dev dependencies: backend 34, frontend 23 y ecommerce 16. Estos conteos provienen del grafo que npm reportó en esta fecha y pueden cambiar con el registry; deben fijarse como evidencia del run, no copiarse indefinidamente.

`security/accepted-risks.json` contiene aceptaciones con revisión 2026-06-03, ya vencida. El security loop solo enumera backend/frontend; storefront no tiene scripts de gate. Además los Dockerfiles de backend y admin fijan `SECURITY_LOOP_SKIP=1`, por lo que la imagen puede compilar evitando el control. El reporte `security/latest-report.json` refleja otro alcance/momento y no sustituye los audits actuales.

## 9. Tests, builds, E2E y runtime

### 9.1 Cobertura efectiva

Ningún `vitest.config` fija umbrales de statements/branches/functions/lines. Un test verde, por tanto, no expresa una cobertura mínima contractual. El frontend tiene 904 archivos TS/TSX y 26 tests actuales; storefront 878 archivos y 18 tests. Los números no prueban falta de calidad por sí solos, pero hacen evidente que el gate unitario no representa toda la superficie.

Hay 54 specs Playwright en `ecommerce/e2e`, muchas correspondientes a otros dominios del monorepo. `ecommerce-readiness.spec.ts` declara cuatro escenarios, todos `test.skip`: SEO/categorías, detalle de producto, login email+teléfono y registro por teléfono.

El script `test:e2e:critical` filtra únicamente:

- identidad de una línea paramétrica agregada desde shop/detalle;
- el escenario “Mercado Pago success flow”.

Ese escenario crea preference y luego llama un helper que marca el último intent como approved directamente en PostgreSQL. No prueba cobro sandbox, firma, entrega webhook, duplicados, eventos fuera de orden ni retry. El setup E2E también lee/escribe base directamente y solo exige health del storefront salvo override.

### 9.2 Evidencia histórica

`.qa/runs/qa-2026-05-10T16-07-19-003Z.json` registra una corrida satisfactoria en mayo (backend core/extended, admin, auth y algunos E2E). Es evidencia útil de que ciertos flujos funcionaron con aquel commit/entorno, no certificación del código de septiembre. Una corrida del día previo incluía más casos commerce que el filtro crítico actual, lo que muestra regresión de alcance del gate aunque el nombre se conserve.

`docs/ecommerce/STOREFRONT_CLOSURE.md` y `ecommerce/README.md` contienen afirmaciones de cierre/migración y algunos comportamientos ya divergentes. Por ejemplo, el código actual redirige rutas demo y la home oficial es `/`; además el build observado siguió usando configuración mínima ante backend ausente. Se conservan como historia, no como source of truth operativo.

### 9.3 Build y performance

- Admin: bundle principal ~986,66 kB raw/~302,65 kB gzip, chart chunk ~541,38 kB y CSS ~742,90 kB; Vite advierte chunks mayores a 500 kB.
- Storefront: el build genera 27 páginas prerender y rutas vendor/demo aunque la política runtime las bloquee. Varias rutas activas cargan aproximadamente 150–400 kB iniciales y páginas vendor superan 1 MB.
- Storefront reporta en `ProductIntro.tsx` una dependencia faltante de `useCallback` (`canonicalConfiguration`).
- Durante prerender no pudo alcanzar la configuración del backend y registró uso de configuración mínima, pero el build terminó exitosamente.

### 9.4 Health y runtime

El backend expone `/healthz`, `/readyz` y `/health`; readiness consulta DB, pero devuelve un cuerpo `degraded` sin cambiar explícitamente status HTTP. El healthcheck de compose usa `/api/health` y solo `curl -f`, por lo que una DB degradada puede seguir marcando el contenedor healthy. El storefront `/api/health` es estático y no sondea backend, DB ni capacidad de cotizar.

No había procesos escuchando en puertos esperados durante esta auditoría. Por eso no hay evidencia actual de login, catálogo, checkout, orden, admin o fulfillment funcionando en conjunto.

## 10. Calidad estructural, modularización y deuda

### 10.1 Concentración de responsabilidades

Hotspots actuales:

- `backend/src/storefront/storefront.service.ts`: 7.287 líneas;
- `backend/src/pricing/parametric-pricing.service.ts`: 3.301;
- `backend/src/sales/sales.controller.ts`: 3.084;
- `backend/src/orders/sales-documents.service.ts`: 2.953;
- `backend/src/settings/settings.controller.ts`: 2.489;
- `backend/src/email/email.service.ts`: 1.602;
- `backend/src/customers/customers.controller.ts`: 1.314;
- `backend/src/storefront/payments/mercadopago.service.ts`: 1.246 y `@ts-nocheck`;
- `frontend/.../ConversationsV2.tsx`: 7.520, `OrderNew.tsx`: 4.113, `AberturasQuote.tsx`: 3.063;
- `ecommerce/src/components/cms/CmsPageShell.tsx`: 2.401, `ProductIntro.tsx`: 1.295, `lib/api/storefront.ts`: 1.277.

Hay aproximadamente 556 apariciones de `any` en backend, 775 en admin y 94 en storefront. Deben priorizarse por frontera y riesgo —DTOs, pagos, órdenes y adapters—, no eliminarse mecánicamente.

### 10.2 Storefront heredado

Persisten `src/data/db.ts` (14.743 líneas), `src/__server__/__db__/*`, mocks, page sections y rutas de la plantilla Bonik. Al menos componentes activos todavía importan navegación/datos de plantilla como fallback. El código inalcanzable por policy continúa aumentando superficie de dependencia, bundles y mantenimiento. Antes de borrar se necesita inventario de imports y pruebas de rutas oficiales.

### 10.3 Buenas prácticas recomendadas

- modularizar por bounded context y caso de uso, manteniendo transacciones explícitas;
- separar controller/DTO/application/domain/infrastructure y adapters de proveedor;
- introducir ports para payment, notification, customer identity y inventory;
- contratos versionados y consumer-driven tests antes de extraer runtimes;
- outbox/inbox para efectos externos y eventos de negocio;
- capability enforcement en servidor;
- presupuestos de bundle, coverage y complejidad como gates graduales;
- no combinar un refactor transversal con features de negocio en el mismo cambio.

## 11. Readiness operativo

| Dimensión | Calificación | Razón |
| --- | --- | --- |
| Compra básica | amarilla | código sustancial y tests internos; no E2E actual completo |
| Identidad cliente | roja | credencial global compartida; recovery teléfono incompleto |
| Pago efectivo | amarilla/roja | estructura presente; operación/confirmación no certificada |
| Mercado Pago | roja | webhook y sandbox/provider E2E insuficientes |
| Stock | amarilla | decremento concurrente básico; lifecycle incompleto |
| Notificaciones | amarilla/roja | lógica presente; durabilidad/proveedor/alerta no certificados |
| Fulfillment | roja | estado mutable sin política integral ni carrier/tracking |
| Backup/recuperación | roja | scripts presentes; no prueba reciente de RPO/RTO/offsite |
| Seguridad supply chain | roja | crítica en storefront, altas en todos y gates incompletos |
| Observabilidad | roja | logs/health básicos, sin SLO ni monitores commerce |
| Multi-tenant | roja | core sin tenant isolation |
| Separabilidad | roja | sin contratos/eventos/ownership verificables |
| Mantenibilidad | amarilla/roja | hotspots y legacy importantes; tests selectivos |

No se debe declarar “ecommerce cerrado” hasta que los rojos de identidad, seguridad, pago, release gate y recuperación tengan evidencia reproducible.

## 12. Decisiones de negocio aún no especificadas

Estas preguntas cambian el diseño. Deben resolverse y quedar registradas en el harness antes de implementar los bloques afectados:

1. ¿La primera operación será single-tenant por deployment o multi-tenant en base compartida? ¿Cuál es la transición prevista?
2. ¿Qué datos son propiedad de Commerce y cuáles podrá replicar CRM/Conversation/Analytics? ¿Quién resuelve identidad duplicada?
3. ¿Se permite checkout invitado? Si crea cuenta, ¿cómo reclama el cliente esa cuenta sin contraseña compartida?
4. ¿Cuándo se descuenta stock: reserva al iniciar pago, creación de orden, aprobación o confirmación manual? ¿Cuándo expira?
5. ¿Qué tipos de producto requieren stock, fabricación o servicio? ¿Cómo se maneja material a medida/paramétrico?
6. ¿Cuáles son los estados y transiciones permitidas de orden, pago, producción, envío, cancelación y cierre? ¿Quién puede forzar y cómo se audita?
7. ¿Qué significa “pago efectivo”: reservado, pendiente, cobrado en local/entrega, vencido? ¿Quién lo confirma?
8. ¿Se aceptan pagos parciales, señas, múltiples monedas, redondeo, diferencias de cambio y sobre/subpago?
9. ¿Cuál es la política de cancelación, devolución, reembolso total/parcial, reposición de stock y notas contables?
10. ¿Qué métodos y zonas de entrega existen: domicilio, pickup, instalación, carrier? ¿Cómo se calculan costo, SLA y tracking?
11. ¿Se crea WorkOrder automáticamente? ¿Para qué tenants/productos y en qué punto del pago?
12. ¿Qué notificaciones son obligatorias, por qué canal, con qué consentimiento, idioma, SLA y escalamiento por fallo?
13. ¿Cuáles son los roles/capabilities exactos para catálogo, precio/costo, cliente, pago, cancelación, refund, producción y configuración?
14. ¿Qué PII se guarda, por cuánto tiempo, bajo qué consentimiento y cómo se exporta/elimina/anonymiza?
15. ¿Cuál es el RPO/RTO; retención, cifrado y ubicación de backups; quién ejecuta y aprueba restores?
16. ¿Qué métricas definen operación sana: conversión, pagos huérfanos, oversell, orders stuck, notificaciones fallidas, latency y error rate?
17. ¿Qué sandbox/cuenta MP y qué evidencia financiera se exige para habilitar live mode?
18. ¿Cuál es el tenant piloto, catálogo, impuestos, moneda, copy legal, soporte y criterio explícito de go-live/no-go?

## 13. Backlog candidato detallado

### Reglas de uso

- Todos los ítems son **candidatos** hasta incorporarse al backlog canónico del harness con owner, prioridad y trazabilidad.
- Ninguna tarea de implementación debe comenzar si sus dependencias de decisión están abiertas.
- Para cada ejecución, el agente debe verificar precondiciones, cambios locales, alcance permitido y comandos de aceptación según `ai-harness/AGENTS.md`.
- Orden recomendado: decisiones y contratos → bloqueantes de seguridad → invariantes de compra/pago/stock → operación → modularización/extracción.

### EC-001 — Carta de producto y Definition of Done de Commerce Suite

- **Objetivo:** fijar qué significa cerrar `commerce-core`, CRM, admin y storefront para la primera operación.
- **Alcance:** actores, journeys, capacidades incluidas, no funcionales, SLA/SLO, entorno piloto, métricas y criterio go/no-go; enlazar master plan, auditoría y backlog.
- **Fuera de alcance:** diseñar UI o implementar features.
- **Dependencias:** ninguna.
- **Criterios de aceptación:** documento versionado y aprobado; cada requisito tiene ID, owner, prioridad, evidencia esperada y producto dueño; no quedan términos ambiguos como “pago completo” o “fulfillment listo”.
- **Verificación:** revisión del harness + matriz requisito → `EC-xxx` → test/gate; aprobación explícita de negocio y técnica.

### EC-002 — Registro de decisiones operativas ecommerce

- **Objetivo:** cerrar las 18 decisiones de la sección 12 antes de diseñar implementación.
- **Alcance:** ADRs/policies para tenancy, identidad invitada, stock, estados, pago, refund, shipping, producción, comunicaciones, PII, backup y piloto.
- **Fuera de alcance:** migraciones y código.
- **Dependencias:** EC-001.
- **Criterios de aceptación:** cada decisión registra alternativas, elegida, consecuencias, responsable, fecha de revisión y sistemas afectados; toda pregunta tiene decisión o bloqueo explícito.
- **Verificación:** `doctor`/validador del harness y revisión cruzada contra backlog sin tareas dependientes huérfanas.

### EC-003 — Mapa de bounded contexts, ownership y datos

- **Objetivo:** convertir la arquitectura objetivo en fronteras verificables para Commerce, CRM, Storefront y consumidores externos.
- **Alcance:** inventario de módulos/tablas/endpoints, system of record, lectores/escritores, PII, transacciones y dependencias hacia Metrics/Conversation/Control Plane.
- **Fuera de alcance:** mover módulos o crear repositorios.
- **Dependencias:** EC-001, EC-002.
- **Criterios de aceptación:** cada modelo central tiene owner único; cada escritura cross-context está identificada; se documentan anti-corruption layers y deprecaciones.
- **Verificación:** análisis estático/import graph + revisión de Prisma y endpoints; ningún modelo commerce queda sin owner.

### EC-004 — Estrategia de tenant isolation y migración

- **Objetivo:** definir una ruta segura de single-tenant actual a solución reusable.
- **Alcance:** opción de aislamiento, constraints/índices compuestos, identidad, claves externas, backfill, datos globales, backup/restore y observabilidad por tenant.
- **Fuera de alcance:** aplicar columnas o backfill.
- **Dependencias:** EC-002, EC-003.
- **Criterios de aceptación:** modelo objetivo y transición N/N-1 aprobados; threat model de fuga entre tenants; rollback/verification plan y decisión para emails/teléfonos/SKU/MP IDs.
- **Verificación:** walkthrough con dataset de dos tenants y consultas esperadas; checklist de acceso cross-tenant negativo.

### EC-005 — Contratos versionados de Commerce y eventos

- **Objetivo:** hacer explícitas las interfaces antes de separar productos.
- **Alcance:** schemas de API/errores y eventos mínimos `customer`, `order`, `payment`, `stock`, `fulfillment`; versionado, idempotencia, trace ID, compatibilidad y owners/consumidores.
- **Fuera de alcance:** broker productivo o extracción física.
- **Dependencias:** EC-003, EC-004.
- **Criterios de aceptación:** schemas versionados sin paquete `shared` generalista; ejemplos válidos/inválidos; política de evolución y consumer matrix.
- **Verificación:** validación automática de schemas + contract tests producer/consumer sobre fixtures.

### EC-006 — Threat model y matriz de autorización Commerce

- **Objetivo:** convertir riesgos de identidad, pago, PII y administración en controles/test concretos.
- **Alcance:** trust boundaries, STRIDE/abuse cases, endpoint × actor × capability, webhooks, uploads, exports/imports y operaciones forzadas.
- **Fuera de alcance:** remediación.
- **Dependencias:** EC-001, EC-003.
- **Criterios de aceptación:** matriz completa para endpoints commerce/CRM/storefront; riesgos con severidad/owner/mitigación; acciones de costo/precio/pago/refund/cancel/config protegidas.
- **Verificación:** revisión de seguridad y generación de tests negativos pendientes con trazabilidad.

### EC-007 — Eliminar contraseña genérica compartida de clientes

- **Objetivo:** impedir autenticación de múltiples clientes con una credencial global.
- **Alcance:** deshabilitar `storefrontDefaultPasswordHash` para login/checkout, migrar cuentas existentes, flujo de claim/invitación/passwordless, invalidación de sesiones y telemetría de migración.
- **Fuera de alcance:** rediseño completo del CRM.
- **Dependencias:** EC-002 (decisión de guest/claim), EC-006.
- **Criterios de aceptación:** ningún checkout crea credencial reutilizable; hash genérico no autentica; cuentas legacy tienen ruta segura individual; secreto retirado y sesiones afectadas revocadas; no hay enumeración de cuenta.
- **Verificación:** unit/integration + E2E negativos entre dos clientes; búsqueda de referencias; migración ensayada y conteos pre/post reconciliados.

### EC-008 — Completar recovery por teléfono o retirarlo del producto

- **Objetivo:** que la recuperación anunciada sea segura y funcional.
- **Alcance:** adapter SMS/WhatsApp aprobado, rate limits, consentimiento, masking, TTL/attempts, provider failure; alternativamente remover UI/API hasta disponer de canal.
- **Fuera de alcance:** automatización conversacional general.
- **Dependencias:** EC-002, EC-006, EC-007.
- **Criterios de aceptación:** no existe placeholder silencioso; OTP nunca se loguea; entrega/fallo son observables; fallback no reduce seguridad.
- **Verificación:** provider sandbox + E2E happy/failure/replay/brute-force; revisión de logs sin OTP/PII.

### EC-009 — Security loop común para backend, admin y storefront

- **Objetivo:** impedir releases con vulnerabilidades no aceptadas y eliminar bypass estructural.
- **Alcance:** incorporar `ecommerce`, definir severidades, hashes/baselines, expiración de accepted risks, SBOM/audit reproducible y retirar `SECURITY_LOOP_SKIP=1` de imágenes release.
- **Fuera de alcance:** upgrades funcionales no requeridos.
- **Dependencias:** EC-006.
- **Criterios de aceptación:** tres paquetes ejecutan gate en install/build/CI; excepción requiere owner, justificación, compensación y fecha vigente; build release no puede omitirlo por default.
- **Verificación:** CI con caso limpio y fixture vulnerable que falla; inspección de Docker build logs y reportes por commit.

### EC-010 — Remediar dependencia crítica y altas del storefront

- **Objetivo:** llevar `ecommerce` a cero críticas/altas no aceptadas sin regresión.
- **Alcance:** Next y dependencias directas/transitivas reportadas; compatibilidad React, SSR, imágenes, styled-components y E2E oficiales.
- **Fuera de alcance:** limpieza completa de plantilla.
- **Dependencias:** EC-009.
- **Criterios de aceptación:** audit runtime sin crítica/alta o riesgos formalmente aceptados vigentes; build/test/E2E oficiales verdes; advisory/fix documentado.
- **Verificación:** audit fijado + build + unit/integration + smoke/mobile/critical en imagen final.

### EC-011 — Remediar dependencias runtime backend y admin

- **Objetivo:** reducir deuda alta preservando comportamiento commerce.
- **Alcance:** Fastify/Nest/Prisma/mail/MP y frontend axios/router/editor/sanitizer; revisar accepted risks vencidos.
- **Fuera de alcance:** upgrades cosméticos sin relación de riesgo.
- **Dependencias:** EC-009.
- **Criterios de aceptación:** cero críticas/altas no aceptadas; riesgos moderados vigentes con controles; lockfiles reproducibles.
- **Verificación:** audits, build, suites backend/admin y E2E commerce; smoke de uploads/email/import/export cuando cambien stacks afectados.

### EC-012 — Enforcement server-side de roles y capabilities

- **Objetivo:** asegurar que ocultar navegación no sea el control de autorización.
- **Alcance:** guards/decorators/policies para Orders, Sales, Customers, Accounting, ProductionOrders, CMS y settings; force/refund/export/import/config sensibles.
- **Fuera de alcance:** nuevo sistema global de identidad.
- **Dependencias:** EC-006.
- **Criterios de aceptación:** cada endpoint tiene actor/capability; denegación consistente 403; auditoría de acciones sensibles; SUPERADMIN no es workaround implícito.
- **Verificación:** contract/integration tests por capability y tests negativos de escalamiento horizontal/vertical.

### EC-013 — Autenticidad, replay e ingest durable del webhook Mercado Pago

- **Objetivo:** procesar notificaciones del proveedor de forma auténtica, idempotente y recuperable.
- **Alcance:** validación de firma/timestamp/request ID según contrato MP, replay window, rate limit, persistencia del evento, dedupe, respuesta/retry y redacción de logs.
- **Fuera de alcance:** agregar otro proveedor.
- **Dependencias:** EC-006, EC-005.
- **Criterios de aceptación:** firma inválida no muta estado; duplicado/out-of-order es idempotente; fallo transitorio produce retry/replay; evento conserva correlation sin PII innecesaria.
- **Verificación:** fixtures firmados oficiales/sandbox; E2E válidos, inválidos, duplicados, expirados y provider outage.

### EC-014 — Invariantes de monto, moneda e idempotencia de pagos

- **Objetivo:** evitar confirmar pago/orden con montos inconsistentes o intents duplicados.
- **Alcance:** expected amount/currency lock, redondeo, uniqueness de IDs externos/idempotency keys por tenant/proveedor, mismatch manual review y concurrencia.
- **Fuera de alcance:** refunds y settlement parcial, salvo definir interfaces.
- **Dependencias:** EC-002, EC-004, EC-013.
- **Criterios de aceptación:** solo pago autoritativo coincidente confirma; mismatch nunca crea/settlea silenciosamente; requests concurrentes crean un único intent/pago/orden.
- **Verificación:** tests de property/concurrencia, migración de constraints y E2E de double-submit/mismatch/moneda.

### EC-015 — Reconciliación operativa de pagos huérfanos

- **Objetivo:** resolver intents aprobados sin orden con SLA, evidencia y intervención humana.
- **Alcance:** job durable/paginado, locking, estados de reconciliación, retries, panel/alerta, runbook y acción manual auditada.
- **Fuera de alcance:** contabilidad general.
- **Dependencias:** EC-014, EC-019.
- **Criterios de aceptación:** no depende de reiniciar backend ni límite fijo de 25; cada intent termina resolved/manual/terminal con razón; alerta por edad/volumen.
- **Verificación:** fault injection antes/después de aprobación/orden; restart; backlog drenado sin duplicados.

### EC-016 — Modelo de reserva y lifecycle de stock

- **Objetivo:** formalizar cuándo se reserva, consume y libera inventario.
- **Alcance:** policy por producto/método de pago, expiración, edición/cancel/refund, permanente/paramétrico/fabricado, ledger/reservation y concurrencia.
- **Fuera de alcance:** WMS externo.
- **Dependencias:** EC-002, EC-004.
- **Criterios de aceptación:** todas las transiciones tienen efecto definido e idempotente; no oversell ni stock retenido indefinidamente; ajuste manual auditado.
- **Verificación:** state-machine/property tests, dos checkouts concurrentes, expiry, cancel/reopen/refund y reconciliación de ledger vs stock.

### EC-017 — Orquestación transaccional de creación de orden

- **Objetivo:** eliminar efectos parciales entre cliente, stock, orden, intent, dirección y comunicaciones.
- **Alcance:** boundary transaccional, outbox/saga, idempotencia de checkout, compensaciones y retry; distinguir efectos críticos y asincrónicos.
- **Fuera de alcance:** microservicios o broker generalista.
- **Dependencias:** EC-005, EC-014, EC-016.
- **Criterios de aceptación:** fallo en cada punto deja estado consistente/reparable; reintento no duplica cliente/orden/stock/email; outbox conserva eventos post-commit.
- **Verificación:** integration con fault injection y kill/restart; invariantes SQL y conteos antes/después.

### EC-018 — Máquinas de estado de orden, pago y producción

- **Objetivo:** impedir saltos/retrocesos inválidos y hacer auditable `force`.
- **Alcance:** estados/transiciones/guards/timestamps para Order, Payment, WorkOrder y ProductionOrder; relación entre ellos y capabilities.
- **Fuera de alcance:** carrier.
- **Dependencias:** EC-002, EC-012, EC-016, EC-017.
- **Criterios de aceptación:** transición válida única por evento; transición inválida falla; force requiere capability, motivo y audit; timestamps derivados, no arbitrarios.
- **Verificación:** model-based tests de todas las aristas; E2E admin; audit trail inmutable.

### EC-019 — Outbox y entrega durable de notificaciones/email

- **Objetivo:** garantizar que eventos comerciales post-commit se entreguen o escalen.
- **Alcance:** outbox, BullMQ durable, retries/backoff, DLQ, replay, dedupe, status y alertas; configurar notification provider explícito.
- **Fuera de alcance:** copy final de todas las plantillas.
- **Dependencias:** EC-005, EC-017.
- **Criterios de aceptación:** pérdida/restart de Redis no pierde evento; fallo terminal visible y replayable; envío no bloquea transacción; métricas persistentes por canal/template.
- **Verificación:** apagar Redis/provider, restart, duplicados y recuperación; comparar outbox/log/job/notification.

### EC-020 — Política y workflow de cancelaciones, devoluciones y reembolsos

- **Objetivo:** cerrar el reverso de la compra en stock, pago, contabilidad, fulfillment y cliente.
- **Alcance:** cancel pre/post pago, refund parcial/total MP y efectivo, devolución física, stock, fees, timeline, permisos y comunicación.
- **Fuera de alcance:** chargebacks complejos salvo registro/alerta.
- **Dependencias:** EC-002, EC-014, EC-016, EC-018, EC-019.
- **Criterios de aceptación:** matriz de casos aprobada; operación idempotente; totales y stock concilian; toda excepción requiere revisión/audit.
- **Verificación:** E2E por caso, duplicado de refund, fallo proveedor y conciliación financiera/stock.

### EC-021 — Fulfillment reusable y órdenes de producción

- **Objetivo:** convertir la capacidad hardcodeada a urucortinas en workflow configurable por tenant/producto.
- **Alcance:** reglas de creación, asignación, estados, SLA, fechas, evidencia de entrega, no-delete o cancel auditado y relación con pago/stock.
- **Fuera de alcance:** integraciones carrier no decididas.
- **Dependencias:** EC-002, EC-004, EC-018.
- **Criterios de aceptación:** feature/capability configurable sin condicional de slug; transiciones válidas; no se borra historia operativa; dashboard refleja stuck/overdue.
- **Verificación:** E2E para producto stock, fabricado y tenant sin producción; tests de permisos/estado.

### EC-022 — Shipping, pickup, tracking y promesa de entrega

- **Objetivo:** implementar solo los modos comerciales aprobados con costo y SLA reproducibles.
- **Alcance:** zonas, opciones activas, fee, pickup/instalación si aplican, shipment/tracking/carrier adapter, entrega fallida y comunicación.
- **Fuera de alcance:** carrier específico hasta decisión/proveedor.
- **Dependencias:** EC-002, EC-018, EC-021.
- **Criterios de aceptación:** backend valida opción/dirección y recalcula costo; promesa queda snapshot; tracking/status no se inventa en cliente; excepciones auditadas.
- **Verificación:** contract tests de rate adapter y E2E por modo/zona/no-disponible/fallo.

### EC-023 — Lifecycle, privacidad y deduplicación del Customer/CRM

- **Objetivo:** hacer al CRM dueño consistente de identidad comercial sin fugas ni duplicados.
- **Alcance:** merge por email/teléfono, claim de checkout, consentimiento, export/delete/anonymize, retención, relación conversaciones y referencias históricas.
- **Fuera de alcance:** extraer CRM a otro runtime.
- **Dependencias:** EC-003, EC-004, EC-007.
- **Criterios de aceptación:** reglas de identidad/dedupe explícitas; borrado respeta obligaciones financieras; PII inventory/retention aprobado; acciones auditadas por tenant.
- **Verificación:** fixtures de duplicados/conflictos, DSAR export/delete y tests cross-tenant.

### EC-024 — Backup, restore y continuidad Commerce

- **Objetivo:** demostrar recuperación completa dentro de RPO/RTO.
- **Alcance:** schedule, cifrado, offsite, retención, acceso, checksums, restore aislado y validación de Customer/Product/Order/Payment/Intent/Stock/Notification/CMS.
- **Fuera de alcance:** DR multi-región salvo requerimiento.
- **Dependencias:** EC-002, EC-004.
- **Criterios de aceptación:** política y owner; backups monitorizados; restore drill reciente; integridad referencial y balances/stock validados; secreto/config cubiertos por plan separado.
- **Verificación:** restore automatizado a entorno efímero, smoke commerce y reporte firmado con tiempos reales.

### EC-025 — Health, observabilidad y SLO de compra

- **Objetivo:** detectar degradación antes de que clientes/operadores la reporten.
- **Alcance:** readiness con status HTTP correcto, storefront dependency probe, métricas/traces para checkout/pago/stock/reconcile/queue, dashboards y alertas.
- **Fuera de alcance:** plataforma observability corporativa completa.
- **Dependencias:** EC-001, EC-015, EC-019.
- **Criterios de aceptación:** SLI/SLO y budgets aprobados; health distingue live/ready/dependency; alertas accionables con runbook y tenant/correlation sin PII.
- **Verificación:** synthetic checkout no financiero, fault injection DB/backend/Redis/MP y prueba de alerta/resolución.

### EC-026 — Configuración fail-fast y promoción de entornos

- **Objetivo:** impedir builds/deploys que oculten ausencia de backend o secretos/config críticas.
- **Alcance:** schema de env por paquete, flags mocks/fallbacks/demo, prerender, MP live/sandbox, URLs, secrets y diferencias build/runtime.
- **Fuera de alcance:** nuevo proveedor de secrets.
- **Dependencias:** EC-001, EC-009.
- **Criterios de aceptación:** producción falla ante config crítica ausente; fallback permitido queda explícito/observable; no se compilan/habilitan demos accidentalmente; matriz dev/test/stage/prod.
- **Verificación:** tests de configuración y builds negativos/positivos; inspección de imagen final/env contract.

### EC-027 — Modularización backend por casos de uso

- **Objetivo:** reducir hotspots sin alterar comportamiento comercial.
- **Alcance:** separar `StorefrontService`, `SalesController`, `SalesDocumentsService`, pricing, MP y Customers en application/domain/adapters; puertos y transacciones.
- **Fuera de alcance:** cambiar features, tablas o extraer servicio.
- **Dependencias:** EC-003, EC-005 y characterization tests EC-030.
- **Criterios de aceptación:** límites y dependencias unidireccionales; ningún archivo concentra flujos heterogéneos; `@ts-nocheck` eliminado en MP; resultados contractuales idénticos.
- **Verificación:** characterization/contract tests antes y después, architecture rules/import graph, builds y E2E.

### EC-028 — Modularización admin y enforcement de contratos

- **Objetivo:** desacoplar vistas gigantes, estado y transporte manteniendo operación.
- **Alcance:** OrderNew, productos/paramétricos, clientes, pagos, CMS y producción; query/adapters tipados; capability UI como apoyo al backend.
- **Fuera de alcance:** rediseño visual general.
- **Dependencias:** EC-005, EC-012, EC-030.
- **Criterios de aceptación:** features por dominio con API tipada; menos `any` en fronteras; errores/loading y permisos consistentes; bundle budgets definidos.
- **Verificación:** component/integration tests, contract mocks generados/validados, build y E2E de operador.

### EC-029 — Retiro controlado de plantilla/demo storefront

- **Objetivo:** reducir superficie, dependencias y bundle sin romper rutas oficiales.
- **Alcance:** import graph de `data`, `__server__`, mocks, vendor/shops/layouts; reemplazar fallbacks activos y borrar por lotes con route inventory.
- **Fuera de alcance:** rediseño de storefront o CMS.
- **Dependencias:** EC-001, EC-026, EC-030.
- **Criterios de aceptación:** ninguna ruta oficial depende de dataset/mock; demos no aparecen en build productivo; reducción medida de archivos/bundle; policy simplificada.
- **Verificación:** static import checks, build route table, visual/mobile/SEO E2E y bundle comparison.

### EC-030 — Suite de caracterización y matriz de regresión Commerce

- **Objetivo:** congelar comportamiento actual válido antes de modularizar o migrar.
- **Alcance:** catálogo/precio/checkout/order/stock/payment/customer/admin/CMS; DB fixtures deterministas y contratos; activar readiness hoy skipped.
- **Fuera de alcance:** provider real y performance, cubiertos aparte.
- **Dependencias:** EC-001, EC-002, EC-006.
- **Criterios de aceptación:** matriz requisito → nivel de test; cero `skip` en casos obligatorios; umbrales de cobertura por código crítico; fixtures no dependen de estado residual.
- **Verificación:** corrida repetida desde DB limpia al menos dos veces; mutation/coverage focalizada en invariantes críticas.

### EC-031 — E2E real de compra, efectivo y operación admin

- **Objetivo:** certificar el journey mínimo desde storefront hasta fulfillment inicial.
- **Alcance:** catálogo simple/variable/paramétrico, stock, guest/claim, checkout efectivo, orden, admin, confirmación, notificación y cancelación; desktop/mobile.
- **Fuera de alcance:** Mercado Pago real, tarea EC-032.
- **Dependencias:** EC-007, EC-016, EC-017, EC-018, EC-019, EC-030.
- **Criterios de aceptación:** journey sin helpers que muten DB para simular negocio; asserts en UI/API y estado observable; limpia sus datos; falla ante regresiones reales.
- **Verificación:** Playwright en compose efímero desde cero y evidencia de artefactos/logs por commit.

### EC-032 — Certificación sandbox de Mercado Pago

- **Objetivo:** demostrar flujo proveedor real antes de live mode.
- **Alcance:** preference/card, aprobación/rechazo/pendiente, signed webhook, retry/duplicate/out-of-order, mismatch, reconciliación, refund básico si aprobado.
- **Fuera de alcance:** dinero real/live credentials.
- **Dependencias:** EC-013, EC-014, EC-015, EC-017, EC-020, EC-030.
- **Criterios de aceptación:** ninguna aprobación se simula por SQL; evidencia de IDs sandbox; contabilidad/orden/stock concilian; secretos no quedan en artefactos.
- **Verificación:** pipeline/manual gate controlado contra sandbox y reporte redacted aprobado por finanzas/técnica.

### EC-033 — Performance, accesibilidad y SEO de rutas oficiales

- **Objetivo:** fijar calidad mínima observable para adquisición y conversión.
- **Alcance:** budgets JS/CSS/imágenes, Core Web Vitals objetivo, teclado/lector, metadata/canonical/sitemap y páginas de categoría/producto/CMS.
- **Fuera de alcance:** optimización de demos a retirar.
- **Dependencias:** EC-029, EC-030.
- **Criterios de aceptación:** budgets y niveles WCAG/SEO definidos; no regresión en rutas oficiales; terceros medidos.
- **Verificación:** Lighthouse/axe/Playwright y bundle analyzer en CI con thresholds.

### EC-034 — Gate de deploy, migración, rollback y release

- **Objetivo:** convertir evidencia dispersa en una única promoción reproducible.
- **Alcance:** install reproducible, security, migrations, build, unit/integration/contracts/E2E, backup previo, canary/smoke, rollback/roll-forward y aprobación.
- **Fuera de alcance:** extracción a repos separados.
- **Dependencias:** EC-009, EC-024, EC-025, EC-026, EC-031, EC-032.
- **Criterios de aceptación:** gate bloqueante por producto y conjunto; ninguna bandera skip por default; DB incompatible impide promoción; artefacto trazable a commit/evidencias.
- **Verificación:** ensayo de release y rollback en staging, incluyendo migración fallida y dependencia degradada.

### EC-035 — Onboarding y piloto del primer tenant

- **Objetivo:** validar que Commerce Suite puede configurarse y operarse con datos/reglas reales.
- **Alcance:** catálogo, moneda/impuestos, shipping, branding/CMS, roles, MP/email, datos legales, soporte, capacitación y checklist go-live.
- **Fuera de alcance:** automatizar onboarding masivo.
- **Dependencias:** EC-004, EC-023, EC-024, EC-034.
- **Criterios de aceptación:** tenant piloto aislado y reproducible; configuración inventariada; UAT firmado; soporte/rollback y ownership definidos.
- **Verificación:** provisioning desde cero en staging, UAT de journeys y revisión de isolation/backup.

### EC-036 — Gate de extracción real de Commerce/CRM/Storefront

- **Objetivo:** decidir con evidencia cuándo un componente puede convertirse en proyecto independiente.
- **Alcance:** checklist de contratos, data ownership, tenancy, observabilidad, release, compatibility, migration y rollback; evaluar primero storefront deployable y luego CRM.
- **Fuera de alcance:** ejecutar la extracción.
- **Dependencias:** EC-003, EC-004, EC-005, EC-025, EC-034, EC-035.
- **Criterios de aceptación:** scorecard por candidato; cero escrituras cross-boundary no contratadas; consumer tests; plan de transición y owner operativo; decisión ADR go/no-go.
- **Verificación:** simulación de deploy independiente y failure isolation; revisión de dependencias/imports/DB access.

## 14. Secuencia recomendada y gates

### Gate A — especificación cerrada

EC-001 a EC-006 aprobados. No se inicia feature/arquitectura que dependa de decisiones abiertas.

### Gate B — seguridad mínima

EC-007 a EC-013 cerrados. No hay credencial compartida, crítica no aceptada, bypass de gate ni webhook no autenticado.

### Gate C — integridad comercial

EC-014 a EC-020 cerrados. Pago, orden, stock, reversas y efectos asincrónicos tienen invariantes y recuperación.

### Gate D — operación

EC-021 a EC-026 y EC-030 a EC-032 cerrados. Fulfillment, backup, health y E2E real generan evidencia repetible.

### Gate E — mantenibilidad/piloto

EC-027 a EC-035 cerrados según alcance del piloto. Los refactors se realizan sobre caracterización verde y por lotes pequeños.

### Gate F — separación física

Solo EC-036 puede autorizar una extracción. Hasta entonces la independencia se construye con límites, contratos y gates dentro del monorepo.

## 15. Trazabilidad mínima a conservar en el harness

Para evitar otro ciclo sin cierre, cada `EC-xxx` que se active debe registrar:

- requisito/decisión origen;
- owner de producto y owner técnico;
- alcance y archivos/módulos permitidos;
- precondiciones y dependencias verificadas;
- evidencia before/after;
- tests/gates exactos y artefactos;
- riesgo, rollback y observabilidad;
- decisión de aceptación con fecha;
- deuda diferida como tarea nueva, no comentario perdido.

El progreso no debe inferirse de commits o builds: debe actualizarse solo cuando el criterio de aceptación y la verificación del ítem estén completos. Esta regla es especialmente importante al trabajar con múltiples agentes sobre módulos compartidos.

## 16. Conclusión

Commerce Suite tiene suficiente implementación para ser prioridad real, pero todavía no es una base operacional segura. El trabajo más valioso ahora no es agregar compra/fulfillment “en abstracto”, sino cerrar especificación, corregir la identidad compartida, integrar storefront al gate de seguridad, certificar pagos, formalizar stock/estados/reversas, demostrar recuperación y crear contratos que permitan independencia futura.

El orden propuesto conserva la inversión existente y evita dos riesgos simultáneos: lanzar un ecommerce vulnerable o separar físicamente módulos antes de conocer quién posee sus datos y contratos. La siguiente fase debe seleccionar y aprobar los ítems del Gate A y, en paralelo solo donde no dependa de decisiones abiertas, preparar la remediación crítica EC-007/EC-009/EC-010/EC-013.
