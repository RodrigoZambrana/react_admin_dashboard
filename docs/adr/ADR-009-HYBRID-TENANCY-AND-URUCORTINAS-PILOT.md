# ADR-009 — Tenancy híbrido y piloto UruCortinas

- Estado: aceptada
- Fecha: 2026-09-08
- Decisor y responsable de aceptación del piloto: Rodrigo
- Tarea: `PF-001`
- Decisión local: `DEC-009`
- Supersede: ninguna

## Contexto

La plataforma debe reutilizarse entre empresas, pero sus productos no tienen
hoy el mismo nivel de aislamiento tenant:

- Commerce Core y CRM comparten el schema Prisma principal. De 137 modelos, 19
  declaran `tenantId` o `tenantKey`; entidades centrales como `User`,
  `Customer`, `Product`, `Order`, `Payment` y `SystemConfig` no están
  tenant-scoped.
- Admin, Storefront, Backend y Channel Adapter seleccionan variantes mediante
  `CLIENT_SLUG` o `VITE_CLIENT_SLUG` a nivel de build o proceso. Las topologías
  Docker representan una variante por stack, no resolución tenant por request.
- AI Platform usa una base propia y 27 de sus 28 modelos declaran `tenantId`;
  aun así, `SecureConfig` no está tenant-scoped y Docker admite un
  `DEFAULT_TENANT_ID`, por lo que el schema por sí solo no certifica aislamiento
  productivo.
- Growth Metrics tiene tenant scope en algunas tablas, pero otras tablas
  operativas y de conexión siguen sin él dentro del schema principal.

Elegir SaaS compartido para toda la plataforma exigiría migraciones y controles
que están fuera de PF-001. Elegir despliegue dedicado como destino permanente
impediría aprovechar el aislamiento ya avanzado en algunos productos y
multiplicaría el costo operativo.

## Decisión

Se adopta un **modelo híbrido**:

1. El código, los contratos y la definición de capacidades son comunes.
2. El piloto y todo producto sin aislamiento certificado usan un data plane
   dedicado por tenant: runtime, persistencia, secretos y almacenamiento sin
   mezcla con otros tenants.
3. Un producto podrá ofrecer ejecución SaaS compartida solo después de un gate
   explícito que pruebe identidad tenant confiable, autorización, scope de toda
   persistencia y cache/colas, secretos por tenant, pruebas negativas de fuga,
   observabilidad y procedimiento de onboarding/offboarding.
4. AI Platform y Growth Metrics son candidatos a ejecución compartida futura;
   esta ADR no declara que ya hayan pasado el gate.
5. El futuro Control Plane podrá compartir identidad, catálogo de tenants y
   capacidades, pero PF-001 no autoriza implementarlo.
6. Toda frontera conserva y valida `tenantId`, incluso cuando el runtime es
   dedicado. El despliegue dedicado no habilita inferir o descartar identidad
   tenant en contratos.

## Alternativas descartadas

### SaaS compartido para todos los productos desde el piloto

Se descarta porque Commerce/CRM tiene datos centrales sin tenant scope y la
selección actual de cliente ocurre a nivel de build/proceso. Afirmar aislamiento
compartido antes de migraciones y pruebas negativas crearía riesgo de fuga de
datos y configuración.

### Despliegue dedicado como único modelo permanente

Se descarta porque duplicaría operación, upgrades y observabilidad para cada
cliente, aun en productos cuyo diseño puede certificar aislamiento compartido.
También contradice el objetivo de onboarding reusable sin aportar un beneficio
necesario para todos los segmentos.

## Clases de despliegue

| Clase | Uso | Aislamiento mínimo |
| --- | --- | --- |
| Dedicado | Piloto, Commerce/CRM actual y productos sin gate compartido | Runtime, bases/volúmenes, secretos, storage, dominio y observabilidad separados por tenant |
| Compartido certificado | Solo productos que aprueben su gate de aislamiento | Identidad tenant derivada de una fuente confiable y validada en cada request, job, evento, cache, secreto y acceso a datos |

No existe fallback silencioso entre clases. Cambiar un producto de dedicado a
compartido requiere una tarea gobernada, evidencia del gate y estrategia de
migración/rollback.

## Consecuencias por producto

| Producto | Aislamiento | Deployment | Onboarding |
| --- | --- | --- | --- |
| Commerce Core + CRM | El piloto usa base, media/uploads y secretos dedicados. Los contratos incluyen `tenantId`; no se declara seguro para base compartida. | Un stack por tenant hasta completar tenancy de entidades core y pruebas de fuga. | Provisionar base/storage/secretos, aplicar schema y seed autorizado, registrar identidad tenant y ejecutar smoke comercial. |
| Admin Web | La sesión y todas las capacidades pertenecen al tenant del despliegue. La UI nunca es autoridad para elegir otro tenant. | Origen y configuración dedicados en el piloto; las variantes de build actuales son compatibilidad, no el modelo final de configuración. | Asociar dominio, branding, roles/capabilities permitidos y conexión al backend del mismo tenant. |
| Storefront Web | Dominio y contexto confiable fijan tenant; parámetros del navegador no pueden cambiarlo. Catálogo, carrito, orden, media y analytics permanecen en el mismo scope. | Instancia/configuración dedicada mientras `CLIENT_SLUG` sea build/process scoped y existan valores hardcoded. | Configurar dominio, marca, locale/moneda, catálogo, pagos, entrega, analytics y smoke del recorrido autorizado. |
| Growth Metrics | Las conexiones, credenciales, jobs, eventos y reportes deben compartir el mismo tenant scope. El scope parcial actual no habilita SaaS compartido. | En el piloto permanece dentro del data plane dedicado. Podrá separarse o compartirse solo tras sus gates de ownership y aislamiento. | Autorizar cada fuente, custodiar credenciales, fijar IDs externos/SLA y validar reconciliación sin cambios de código por tenant. |
| Conversation Platform | Conversaciones, mensajes, knowledge, prompts, canales y ejecuciones se aíslan por `tenantId`; `SecureConfig` y el tenant por defecto impiden certificar hoy ejecución compartida. | Base/Redis/Qdrant y secretos dedicados para el piloto. Es candidato temprano a compartido después de gate. | Crear tenant explícito, configurar políticas/capabilities, cargar knowledge aprobado, vincular canales y probar acceso cruzado negativo. |
| Channel Adapters | Cada mensaje canónico transporta `tenantId`; credenciales, sesiones, retries e idempotencia no se comparten entre tenants sin un resolver seguro. | Proceso y secret set dedicados mientras `CLIENT_SLUG` sea global al proceso. | Vincular cuenta/canal, webhook, secretos y destino de Conversation Platform; verificar firma, replay y entrega tenant-scoped. |
| Control Plane futuro | Será owner de tenant, identidad global y catálogo de capacidades, no de los datos de dominio. | Fuera de alcance; no se crea runtime en PF-001. | El onboarding del piloto es manual y auditable hasta que una tarea posterior justifique automatizarlo. |

## Ownership de configuración

El tenant decide valores de negocio dentro de contratos que la plataforma
define y valida.

| Configuración | Owner de la decisión/valor | Owner de schema, custodia y enforcement |
| --- | --- | --- |
| Marca, dominio, locale, moneda, zona horaria y contenido | Tenant | Plataforma |
| Catálogo, precios, impuestos aplicables, stock y políticas comerciales | Tenant | Commerce Core |
| Métodos de pago/entrega y cuentas de integraciones | Tenant | Producto dueño de la integración |
| Canales, knowledge, prompts y capacidades habilitadas | Tenant, dentro del catálogo permitido | Conversation Platform / Channel Adapter / plataforma según el dato |
| Credenciales y secretos aportados por el tenant | Tenant autoriza y puede revocar | Plataforma custodia, cifra, rota y audita |
| Schema/versionado de configuración, defaults seguros y compatibilidad | Plataforma | Plataforma |
| Guardrails de seguridad, privacidad, retención mínima, auditoría y aislamiento | Plataforma; no son relajables por tenant | Plataforma y producto ejecutor |
| Clase de deployment y excepciones operativas | Plataforma y tenant mediante acuerdo explícito | Plataforma |

Las configuraciones versionadas bajo `*/src/clients/<slug>` son bootstrap o
compatibilidad del estado actual. No deben convertirse en el único sistema de
configuración productiva ni almacenar secretos.

## Piloto aprobado

- Tenant: **UruCortinas** (`urucortinas`).
- Segmento: empresa uruguaya de cortinas y aberturas a medida.
- Responsable de aceptación: **Rodrigo**.
- Clase: data plane dedicado para todos los productos usados por el piloto.
- Alcance: validar que el tenant puede configurarse, desplegarse y operarse sin
  mezcla de datos, secretos o storage; recorrer únicamente las capacidades que
  sus tareas funcionales y gates de release autoricen.
- Fuera de alcance: segundo tenant, go-live implícito, migraciones multi-tenant,
  Control Plane, extracción de repositorios y habilitación automática de tareas
  dependientes.

La aceptación de PF-001 confirma esta decisión y el alcance del piloto; no
certifica todavía que ecommerce, métricas, conversaciones o canales estén
listos para producción.

## Verificación de la decisión

La revisión se realizó contra:

- `backend/prisma/schema.prisma`: 137 modelos, 19 con campo tenant explícito;
  entidades comerciales críticas continúan sin él.
- `ai-platform/backend/prisma/schema.prisma`: 28 modelos, 27 con `tenantId`;
  `SecureConfig` permanece sin scope tenant.
- `deploy/docker-compose.dev.yml`, `deploy/docker-compose.prod.yml` y
  `docker-compose.test.yml`: selección por `CLIENT_SLUG`/`VITE_CLIENT_SLUG` y
  bases/volúmenes por stack.
- `ai-platform/docker-compose.yml`: base, Redis y Qdrant propios, con
  `DEFAULT_TENANT_ID` a nivel de proceso.
- `deploy/docker-compose.channel-adapter.yml`: `CLIENT_SLUG` a nivel de proceso.

El resultado es compatible con el estado actual porque el piloto comienza
dedicado y, a la vez, impide confundir esa separación física con aislamiento
lógico ya certificado.

## Seguimiento

Las tareas dependientes conservan sus propios gates. Esta ADR desbloquea su
evaluación por el backlog, pero no las inicia ni aprueba implementación,
migraciones o Control Plane.
