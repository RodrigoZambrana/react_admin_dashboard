# EXECUTION_ROADMAP

## Propósito

Plan operativo para ejecutar el saneamiento y la evolución del proyecto sin perder control técnico ni contexto.

## Principios de ejecución

- Cambios pequeños, verificables y reversibles.
- Primero seguridad y reproducibilidad; después refactor y features.
- No mezclar refactor grande con upgrades mayores y cambios funcionales.
- Cada bloque debe cerrar con comandos concretos de validación.
- El SEO del storefront queda fuera del alcance prioritario actual y se retoma en una fase posterior.
- El stack Docker local debe seguir operativo en cada iteración relevante como control mínimo de integración y empaquetado.
- No hace falta correr Docker por cada microcambio, pero sí al cierre de cada bloque relevante y al cierre de cualquier cambio en `package.json`, Dockerfiles, compose, envs, imports compartidos o runtime server/client.
- El storefront debe evolucionar con una política explícita de procedencia de datos y degradación controlada cuando el backend no esté disponible.
- Los DTO públicos del storefront deben mantenerse mínimos y auditados para no exponer costos, márgenes o reglas internas innecesarias.
- El flujo de efectivo storefront debe tratar pedido y pago como eventos separados: registrar pedido ahora, confirmar pago solo cuando administración lo asiente.
- Las automatizaciones E2E futuras deben apoyarse en `data-testid` estables en superficies críticas; ese criterio debe formar parte de la aceptación de cambios nuevos o refactors relevantes.
- El bootstrap y la evolución de base deben seguir un camino reproducible con Prisma, pero la estructura física y la performance de consultas también deben revisarse periódicamente con normalización e índices donde corresponda.
- La cobertura de pruebas objetivo debe crecer de forma incremental y priorizada, con regresiones browser para flujos críticos y sin depender de pasos manuales no trazables.
- Las futuras superficies editoriales del sitio deben modelarse en un dominio CMS independiente; no conviene seguir ampliando contenido editorial directamente sobre `Product`.

## Secuencia de trabajo recomendada

### Orden operativo vigente

1. Retirar/rotar secretos y corregir sesiones en browser.
2. Reconciliar envs y dejar `env-check` en verde.
3. Asegurar compatibilidad de despliegue y Docker local.
4. Restaurar baseline de `lint`/`test`/`build`.
5. Aplicar la primera ola de updates de seguridad.
6. Ejecutar una pasada dedicada de refactor/mantenibilidad.
7. Luego avanzar sobre la superficie pública del storefront.

### Criterio de calidad acordado

- El proyecto debe evolucionar priorizando código limpio, entendible, reusable y mantenible.
- La eficiencia importa, pero no por encima de claridad, consistencia y facilidad de evolución.
- La revisión inicial ya detectó deuda y oportunidades de mejora, pero la pasada profunda de refactor queda explícitamente programada después de la estabilización técnica de la etapa 1.
- Los `ALLOWED_ORIGINS` locales son aceptables como soporte de desarrollo/Docker, pero cada entorno no local debe declarar sus URLs reales de forma explícita.
- Cualquier prefill de credenciales en UI, si vuelve a existir, debe estar estrictamente acotado a desarrollo local.
- En el storefront, los datos mostrados fuera del backend vivo deben provenir solo de mecanismos trazables y explícitamente aprobados, no de mocks heredados de procedencia difusa.

## Estado de ejecución actual

- Fase 0: parcialmente ejecutada.
  - secretos versionados neutralizados en repo,
  - persistencia insegura de sesiones reducida,
  - rotación real en infraestructura aún pendiente.
- Referencia operativa adicional:
  - el spec vigente de DigitalOcean compartido por el usuario despliega solo `frontend` y `backend`,
  - la variante activa en ese entorno es `urucortinas`,
  - el `storefront` todavía no forma parte de App Platform.
- Fase 1: ejecutada en su objetivo principal.
  - `make env-check` ya pasa.
- Fase 2: ejecutada en su objetivo principal.
  - compatibilidad de build containerizado recuperada para `backend`, `frontend` y `storefront`,
  - `docker compose -f deploy/docker-compose.dev.yml config` resuelve,
  - `docker compose -f deploy/docker-compose.dev.yml build backend frontend storefront` queda en verde,
  - se corrigieron build args explícitos y la URL pública del storefront en Docker dev.
- Validación final de Fase 2:
  - runtime Docker local quedó validado en verde con la clave histórica compatible,
  - la opción A quedó aplicada localmente sin reintroducir la clave en archivos versionados:
    - `deploy/docker-compose.dev.yml` admite `deploy/env/.env.backend.dev.local` como override local ignorado,
    - `backend/.env` local quedó alineado para desarrollo no containerizado,
  - backend falla al descifrar configuración segura persistida solo cuando se usa la `CONFIG_ENCRYPTION_KEY` placeholder actual.
  - verificación directa sobre la base local:
    - `SecureConfig` contiene 4 registros,
    - `email.provider.config`,
    - `inbox.email.config`,
    - `integrations.google`,
    - `payments.mercadopago`,
    - ninguno desencripta con la clave local actual,
    - todos desencriptan con una clave histórica encontrada en `git`,
    - el problema queda identificado como drift de clave local, no como corrupción de `SecureConfig`.
  - validación runtime con override temporal y cierre del bloque:
    - backend `Up`,
    - frontend `Up`,
    - storefront `Up (healthy)`,
    - backend `/api/health` respondió correctamente,
    - storefront `/api/health` respondió correctamente,
    - frontend respondió `200 OK`,
    - storefront `/` respondió `200`,
    - rutas demo verificadas con redirects y `404` reales.
- Fase 3: ejecutada en su objetivo principal.
  - `backend npm run lint`: verde,
  - `backend npm test`: verde,
  - `backend npm run build`: verde,
  - `frontend npm run lint`: verde, con warnings no bloqueantes,
  - `frontend npm test`: verde,
  - `frontend npm run build`: verde,
  - `ecommerce npm run lint`: verde, ahora sin warnings,
  - `ecommerce npm run build`: verde, con ruido de rutas demo/fallbacks durante SSG.
- Fase 4: parcialmente ejecutada.
  - primera ola de updates aplicada en `backend`, `frontend` y `ecommerce`,
  - segunda subronda aplicada en `backend` y toolchain del `frontend`,
  - `backend npm audit --package-lock-only --json`: 46 vulnerabilidades,
  - `frontend npm audit --package-lock-only --json`: 8 vulnerabilidades,
  - `ecommerce npm audit --package-lock-only --json`: 1 vulnerabilidad moderada,
  - storefront con `next@15.5.14` y `images.remotePatterns` endurecido,
  - storefront sin warnings de ESLint; el ruido residual ya viene del prerender de rutas demo/heredadas,
  - subbloque adicional ya cerrado:
    - `frontend npm run lint`: verde y sin warnings,
    - `frontend npm run build`: verde; el remanente quedó solo en chunks grandes no bloqueantes,
    - `backend npm audit --omit=dev --json`: 32 vulnerabilidades altas, ya concentradas exclusivamente en `mjml` y `xlsx`,
    - `backend` endurecido con sanitización recursiva de payloads `xlsx` y con validaciones adicionales sobre MJML (`mj-raw`, `script`, handlers inline y `javascript:`),
    - validación Docker local renovada para `backend` y `frontend`.
  - subbloque estructural ya cerrado:
    - `backend` migró import/export paramétrico a CSV y removió `xlsx`,
    - `backend` migró generación/render de emails a React Email y removió `mjml`,
    - `backend npm audit --omit=dev --json`: 0 vulnerabilidades productivas,
    - `backend npm run lint`: verde,
    - `backend npm test`: verde,
    - `backend npm run build`: verde,
    - `frontend npm run lint`: verde,
    - `frontend npm test`: verde,
    - `frontend npm run build`: verde,
    - validación Docker local renovada para `backend` y `frontend`,
    - limpieza final aplicada: `EmailTemplate` quedó purgada de registros legacy y el backend ahora acepta solo HTML para templates de email.
- Fase 5: iniciada parcialmente dentro del hardening del storefront.
  - existe inventario explícito de rutas en `public-route-policy`,
  - las rutas demo quedaron despublicadas sin borrar código reutilizable,
  - los fallbacks inseguros quedan apagados por defecto en Docker dev y examples,
  - Docker runtime validado: `backend`, `frontend` y `storefront` `Up`, con `storefront` `healthy`,
  - verificación HTTP local:
    - `/` responde `200`,
    - `/login` y `/signup` redirigen,
    - `/checkout-alternative` redirige a `/checkout`,
    - `/market-1` redirige a `/`,
    - `/shop`, `/shops` y `/vendor/dashboard` devuelven `404`.
- Subfase email/privacy hardening:
  - locale por audiencia ya alineado en emails storefront;
  - `welcome email` ya implementado para registro storefront y alta inicial por Google;
  - flujo storefront en efectivo ya expresa `pending_confirmation` y evita tratar el pago como confirmado antes de la registración manual;
  - pendientes que siguen fuera de esta ronda:
    - verificación/activación por email,
    - abandono de checkout con job y reglas de elegibilidad.
- Subfase E2E storefront:
  - Playwright ya quedó integrado en `ecommerce`;
  - suite inicial operativa:
    - wishlist post-login con `sessionStorage`,
    - registro con email + verificación,
    - forgot/reset por email;
  - siguientes bloques naturales pendientes:
    - `shop -> product detail -> cart` para paramétricos publicados,
    - `checkout preview -> pago -> detalle de pedido`,
    - flujo `cash` pendiente de confirmación,
    - notificaciones cliente/admin;
  - pendiente transversal:
    - extender `data-testid` al resto de superficies críticas y tomarlo como criterio de aceptación futuro.

## Fase 0. Preparación y contención

### Objetivo

Congelar el contexto, cortar exposición inmediata y fijar una base de trabajo segura.

### Tareas

- Confirmar qué credenciales versionadas siguen activas.
- Rotar:
  - `SEED_SUPERADMIN_PASSWORD`
  - `DEFAULT_USER_TEMP_PASSWORD`
  - `JWT_SECRET`
  - `COOKIE_SECRET`
  - `CONFIG_ENCRYPTION_KEY`
  - `MP_*` si correspondiera
- Limpiar `app.yaml` y examples para dejar solo placeholders.
- Definir dueño/flujo de despliegue real:
  - Docker Compose
  - App Platform
  - ambos

### Validación

- No quedan secretos funcionales en archivos versionados.
- El equipo sabe qué ruta de despliegue es la vigente.
- Se conserva la capacidad de levantar el stack local por Docker sin regresiones introducidas por el cambio.

## Fase 1. Normalización de entorno

### Objetivo

Hacer que una instalación nueva pueda arrancar sin inferencias ni drift.

### Tareas

- Inventariar variables realmente consumidas por código:
  - backend
  - frontend
  - ecommerce
- Comparar con:
  - `env.schema.json`
  - `.env.example`
  - `deploy/env/*.example`
  - `app.yaml`
- Resolver desalineaciones:
  - faltantes en schema
  - faltantes en examples
  - variables obsoletas
  - nombres inconsistentes
- Documentar servicios opcionales:
  - PostgreSQL
  - Redis
  - SMTP/IMAP
  - Google OAuth
  - Mercado Pago
  - snapshots del storefront

### Dependencias

- Fase 0 idealmente completada.

### Validación

- `make env-check` pasa con examples completos y coherentes.
- La configuración sigue siendo compatible con el flujo de Docker local.

## Fase 2. Compatibilidad de despliegue y Docker local

### Objetivo

Garantizar que el proyecto no solo compile fuera de contenedores, sino que también conserve compatibilidad real con build y runtime containerizado.

### Tareas

- Mantener `.dockerignore` alineado con el repo real para evitar contextos inflados o inconsistentes.
- Pasar build args explícitos a `frontend` y `ecommerce`.
- Mantener coherencia entre URLs internas de red Docker y URLs públicas expuestas al navegador.
- Validar healthchecks efectivos por servicio.
- Confirmar que el backend puede leer su configuración cifrada en entorno local/containerizado.
- Documentar puertos reservados o parametrizar puertos conflictivos del host.

### Dependencias

- Fase 1 completada.

### Validación

```bash
docker compose -f deploy/docker-compose.dev.yml config
docker compose -f deploy/docker-compose.dev.yml build backend frontend storefront
docker compose -f deploy/docker-compose.dev.yml up -d
docker compose -f deploy/docker-compose.dev.yml ps
docker compose -f deploy/docker-compose.dev.yml logs --no-color --tail 120 backend frontend storefront
```

## Fase 3. Línea base de calidad

### Objetivo

Tener señales confiables de salud para poder tocar el sistema con seguridad.

### Tareas backend

- Corregir error tipado en `src/email/__tests__/email.service.spec.ts`.
- Mantener `npm test` y `npm run build` en verde.

### Tareas frontend

- Instalar/corregir `@testing-library/dom`.
- Resolver errores reales de hooks en `ProductForm/ParametricConfigurator.tsx`.
- Resolver errores de lint que hoy cortan la señal.
- Dejar warnings importantes priorizados, no ignorados sin criterio.

### Tareas storefront

- Crear configuración ESLint no interactiva.
- Mantener `npm run build` en verde.
- Incorporar validación del flujo Docker local al menos como smoke test de integración cuando el cambio afecte empaquetado, imports compartidos o resolución de módulos.

### Dependencias

- Fase 2 cerrada.

### Validación

```bash
cd backend && npm run lint && npm test && npm run build
cd frontend && npm run lint && npm test && npm run build
cd ecommerce && npm run lint && npm run build
```

## Fase 4. Ola de seguridad de dependencias

### Objetivo

Reducir superficie vulnerable sin generar regresiones evitables.

### Estado actual

- Primera subronda completada.
- Validación post-update:
  - `backend npm run lint && npm test && npm run build`: verde
  - `frontend npm run lint && npm test && npm run build`: verde
  - `ecommerce npm run lint && npm run build`: verde
- Resultado:
  - `backend` mejoró de forma sustancial y cerró el frente crítico de `xlsx`/`mjml`; el remanente real quedó en seguridad operativa, drift local de secretos/configuración y compatibilidad de plantillas heredadas;
  - `frontend` queda sin críticos, con remanente concentrado en toolchain y librerías UI;
  - `ecommerce` queda prácticamente saneado a nivel dependencias, pero mantiene deuda de superficie pública heredada.

### Subfase 3.1. Fixes directos de bajo riesgo

- Backend
  - `@nestjs/*` patch
  - `@fastify/cors`
  - `@fastify/multipart`
  - `mercadopago`
  - `imapflow`
  - `mailparser`

- Frontend
  - `axios`
  - `dompurify`
  - `lodash`
  - `dayjs`
  - `formik`

- Ecommerce
  - `axios`
  - `lodash`
  - `chart.js`
  - `styled-components`

### Subfase 3.2. Eliminación de dependencias innecesarias

- Backend
  - remover `@nestjs/platform-express` si se confirma no usado

- Frontend
  - revisar y remover `postcss-cli`
  - revisar y remover `rollup-plugin-postcss`
  - revisar y remover `@types/react-portal`

- Ecommerce
  - revisar y remover `motion`

## Fase 6. Rendimiento estructural y consistencia de datos

### Objetivo

Reducir deuda estructural en base de datos y consultas antes de que el crecimiento funcional la vuelva más costosa de corregir.

### Tareas

- Revisar normalización efectiva de tablas con foco en:
  - catálogos/configuraciones que hoy mezclen responsabilidades,
  - duplicaciones históricas mantenidas solo por compatibilidad,
  - estructuras que compliquen reporting, seguridad o mantenimiento.
- Auditar consultas críticas y cardinalidad real en:
  - storefront,
  - pedidos/pagos,
  - timeline/notificaciones,
  - email logs y configuraciones.
- Incorporar índices donde sean realmente necesarios, guiados por:
  - planes de consulta,
  - joins frecuentes,
  - filtros/ordenamientos reales,
  - constraints de unicidad/consistencia.
- Evitar indexación especulativa o no justificada.

### Validación

- Inventario de tablas/campos candidatos a normalización.
- Inventario de consultas calientes.
- Lista priorizada de índices a agregar con justificación técnica.

## Fase 7. Estrategia transversal de cache

### Objetivo

Definir una política de cache coherente para `backend`, `frontend` y `ecommerce`, evitando comportamientos ad hoc o inconsistentes entre proyectos.

### Tareas

- Identificar qué recursos pueden cachearse y con qué invalidez esperada.
- Definir por capa:
  - cache HTTP/CDN,
  - cache de aplicación,
  - cache de snapshots,
  - cache cliente.
- Especificar reglas de invalidación por dominio:
  - catálogo,
  - config storefront,
  - categorías,
  - pricing publicado,
  - notificaciones y cuenta.
- Revisar si la cache actual del storefront y snapshots necesita consolidación o simplificación.

### Validación

- Documento de estrategia de cache por capa.
- Lista de recursos cacheables y eventos de invalidación.
- Propuesta técnica unificada para los tres proyectos.

## Fase 8. Cobertura de pruebas y automatización

### Objetivo

Subir progresivamente el nivel de cobertura funcional sin introducir suites frágiles o demasiado costosas de mantener.

### Tareas

- Mantener Playwright como base E2E del storefront.
- Extender `data-testid` a superficies críticas pendientes.
- Incorporar como criterio de aceptación para cambios nuevos:
  - selectores estables,
  - pruebas de regresión cuando el flujo lo justifique,
  - no romper suites existentes.
- Definir un paquete mínimo de regresión obligatoria post-cambio para:
  - auth,
  - wishlist,
  - checkout,
  - pago,
  - pedidos/notificaciones.
- Evaluar luego integración CI/CD para estas suites.

### Validación

- Suite browser mínima estable en storefront.
- Criterio documentado de `data-testid`.
- Lista de regresiones críticas obligatorias por bloque de cambio.

### Subfase 3.3. Upgrades delicados

- Backend
  - `nodemailer`
  - `bullmq`
  - `prisma` si el advisory aplica realmente al árbol final

- Frontend
  - `jspdf`
  - `@typescript-eslint/*`
  - `eslint`
  - `vitest`

- Ecommerce
  - `next` a versión segura `15.x`
  - recién después evaluar `16.x`

### Validación

- Repetir lint/test/build por módulo.
- Repetir `npm audit --package-lock-only --json`.

## Fase 5. Autenticación y sesiones

### Objetivo

Eliminar el principal riesgo de sesión en browser.

### Tareas

- Admin
  - remover token persistido en `redux-persist`
  - usar solo cookie `httpOnly` o reducir a session-only temporal
  - revisar interceptores y renovación de sesión

- Storefront
  - dejar de exponer `refreshToken` al browser
  - migrar `session-context` a `GET /auth/session`
  - mantener cookies `httpOnly` como mecanismo principal

- Backend
  - endurecer arranque si faltan `JWT_SECRET`, `COOKIE_SECRET`, `CONFIG_ENCRYPTION_KEY`
  - revisar si `sign-in` necesita throttling específico por IP/identificador

### Riesgo

- Alto, porque toca login/logout/refresh.

### Validación

- Login admin funciona tras reload.
- Logout invalida sesión.
- Storefront login y refresh sobreviven reload sin `localStorage` de tokens.

## Fase 6. Limpieza estructural del storefront

### Objetivo

Transformar el storefront en una aplicación de producto y no en un template mixto.

### Criterio de implementación acordado

- Estrategia mínima.
- No eliminar todavía layouts, markets o variantes heredadas que puedan reutilizarse en una futura capa de customización.
- Sí despublicar esas rutas del flujo público actual.
- Sí apagar fallbacks mock o inseguros por defecto.
- Sí separar claramente "código reutilizable" de "superficie pública habilitada".
- No abrir en esta etapa un frente SEO dedicado, salvo efectos colaterales de limpieza.

### Precondición recomendada

- Antes de ejecutar esta fase, producir un inventario concreto de `ecommerce/src/app` en tres grupos:
  - rutas públicas reales a conservar,
  - rutas demo a despublicar ahora,
  - rutas reutilizables a preservar pero dejar fuera del flujo público.
- Antes de ampliar esta fase, definir además la política de resiliencia:
  - qué partes pueden seguir operativas sin backend,
  - qué fuente de datos está permitida en modo degradado,
  - cómo se comunica vigencia y procedencia de esa información.

### Tareas

- Definir el set oficial de rutas públicas del storefront.
- Inventariar rutas públicas reales.
- Separar explícitamente estas fuentes de información:
  - datos vivos desde backend,
  - snapshots controlados/exportados,
  - mocks de desarrollo solo permitidos en dev.
- Desactivar u ocultar del flujo público:
  - `/(layout-3)` demo si no forma parte del producto
  - `login`/`signup` genéricos Bonik duplicados
  - secciones demo no conectadas al backend
- Endurecer flags:
  - `NEXT_PUBLIC_ENABLE_STOREFRONT_FALLBACKS=false` por defecto fuera de dev
  - `NEXT_PUBLIC_ENABLE_STOREFRONT_MOCKS=false`
- Cerrar endpoint `api/internal/snapshots` cuando no hay token.
- Evaluar si los snapshots deben:
  - generarse desde backend,
  - versionarse por tenant,
  - exponer fecha de generación y origen,
  - servir como base de un eventual modo estático/exportable.
- Reemplazar textos Bonik en metadata, fallbacks y copy base.

Nota:

- En esta etapa priorizar despublicar y aislar antes que borrar.
- Solo eliminar código cuando ya exista certeza de que no será reutilizado en la futura estrategia de customización.

### Validación

- No quedan rutas demo indexables no deseadas.
- El storefront falla de forma controlada en lugar de publicar datos demo.

## Fase 7. SEO técnico del storefront

### Objetivo

Dejar una base indexable, rastreable y lista para iterar.

### Estado de prioridad

- Diferido.
- No ejecutar en la etapa actual salvo que alguna corrección de estabilidad lo toque indirectamente.

### Tareas

- Crear `robots.ts`.
- Crear `sitemap.ts`.
- Definir `generateMetadata` o metadata consistente por:
  - home
  - categorías
  - productos
  - búsqueda
  - auth/account si aplica
- Canonicals por ruta.
- Titles/descriptions reales por tenant.
- Revisar headings y enlazado interno.
- Revisar `next/image` y `remotePatterns`.
- Evaluar schema markup:
  - Organization
  - BreadcrumbList
  - Product

### Validación

- `npm run build` del storefront.
- Inspección manual del HTML generado.
- Verificación de rutas clave:
  - `/`
  - `/products`
  - `/product/[slug]`
  - `/categories`

## Fase 8. Refactor y evolución incremental

### Objetivo

Entrar en una fase sostenible para nuevas features.

### Nota de secuencia

- Aunque este bloque aparece más adelante como fase de evolución continua, se acuerda realizar una pasada dedicada de refactor/mantenibilidad inmediatamente después de cerrar la estabilización base:
  - secretos/sesiones,
  - entornos,
  - baseline de calidad,
  - primera ola de seguridad.

### Frentes sugeridos

- Extraer módulos densos del admin:
  - ventas
  - productos
  - paramétricos
- Consolidar shared code real.
- Definir convenciones de ownership por carpeta.
- Agregar CI real:
  - lint
  - test
  - build
  - env-check
  - audit
- Evaluar arquitectura de publicación del storefront en más de un modo:
  - dinámico con backend vivo,
  - degradado con snapshots controlados,
  - estático/exportado para clientes o membresías sin backend activo.
- Diseñar evolución futura de producto para el storefront:
  - contenido estático administrado desde base de datos/CMS,
  - páginas, secciones y navbars configurables desde backend,
  - defaults compatibles con variante estática/exportable,
  - mejora progresiva del template, librerías e implementaciones base,
  - SEO y posicionamiento de sitio/productos con datos estructurados.
  - este frente requiere antes definir alcance funcional, actores, modelo de publicación y límites entre modo dinámico y estático.

## Dependencias entre bloques

| Bloque | Depende de | Motivo |
| --- | --- | --- |
| Seguridad de secretos | ninguno | riesgo inmediato |
| Normalización de envs | seguridad básica | evita documentar secretos activos |
| Compatibilidad de despliegue | envs consistentes | evita que el stack empaquetado diverja del desarrollo local |
| Línea base de calidad | compatibilidad de despliegue mínima | si no, las verificaciones son ruido parcial |
| Updates de dependencias | baseline verde | aislar regresiones |
| Sesiones/auth | baseline verde + secretos corregidos | alto riesgo funcional |
| Limpieza storefront | baseline verde | evita mezclar errores de template con errores reales |
| SEO | storefront estable | el SEO sobre rutas demo es desperdicio |

## Quick wins recomendados para arrancar

1. Remover secretos de `app.yaml`.
2. Corregir `react-router-dom` y `axios`.
3. Agregar `@testing-library/dom`.
4. Crear ESLint no interactivo en `ecommerce`.
5. Eliminar `@nestjs/platform-express`.
6. Endurecer `SNAPSHOT_ACCESS_TOKEN`.

## Bloques ideales de PR

### PR 1. Seguridad operativa

- secretos
- defaults inseguros
- snapshots internos

### PR 2. Entorno y documentación

- schema/env/examples/docs

### PR 3. Baseline de calidad

- lint/test/build

### PR 4. Dependencias wave 1

- patches/minors

### PR 5. Auth y sesiones

- admin + storefront

### PR 6. Storefront cleanup

- rutas demo
- metadata base
- fallbacks

### PR 7. SEO técnico

- robots
- sitemap
- canonicals
- schema

## Bitácora de continuidad

### Estado inicial registrado

- Base documental creada a partir de auditoría del repo real.

### Decisiones tomadas

- El saneamiento inicial de secretos/sesiones/envs ya fue ejecutado y debe tomarse como nueva baseline técnica.
- El storefront ya no debe volver a persistir sesión en `localStorage`.
- El admin no debe volver a persistir `auth` en `redux-persist`.
- El deploy Docker local se adopta como verificación operativa obligatoria en iteraciones que toquen configuración, build, imports compartidos o despliegue.
- El spec actual de DigitalOcean compartido por el usuario se toma como referencia principal para entender el despliegue activo, por encima de supuestos heredados del README.
- Se incorpora como línea de análisis futura del storefront:
  - definir una degradación funcional controlada cuando el backend falle,
  - eliminar dependencia de mocks heredados de procedencia incierta,
  - evaluar snapshots controlados y la viabilidad de `next export` o equivalentes como modo operativo inicial para algunos clientes o planes,
  - considerar CMS en base de datos para contenido estático,
  - considerar configurabilidad dinámica de páginas, secciones y navbars,
  - considerar defaults explícitos para export estático,
  - considerar mejora progresiva del template y su stack base,
  - considerar SEO estructural de sitio y productos como fase posterior.
- Para poder priorizar correctamente esas líneas futuras todavía falta definir:
  - estructura concreta del CMS dentro del backend y su primera implementación funcional,
  - alcance exacto del nuevo rol editor en backend/admin cuando llegue ese bloque,
  - recomendación técnica final entre `next export`, SSG con snapshots o variante híbrida,
  - detalle operativo de regeneración/publicación del modo estático según haya o no backend,
  - partes exactas del template que entrarán primero en configurabilidad,
  - modelo técnico de multi-dominio y SEO por tenant.

### Cambios de prioridad

- Se inserta explícitamente compatibilidad de despliegue/Docker local antes del baseline de calidad.
- Se mantiene el orden acordado: baseline y seguridad antes de tocar superficie pública del storefront.
- La primera ola de seguridad ya fue ejecutada y pasa a ser parte de la baseline vigente.
- La segunda subronda de seguridad ya fue ejecutada parcialmente y deja nuevos valores de referencia:
  - `backend` 46 vulnerabilidades,
  - `frontend` 8 vulnerabilidades,
  - `ecommerce` 1 vulnerabilidad moderada.
- Subbloque adicional ya ejecutado dentro de esa misma línea:
  - hardening de imports `xlsx` en backend con límites explícitos de tamaño/hojas/filas,
  - reducción de warnings del admin de `78` a `55`,
  - reducción del chunk principal del admin desde `~942 kB` a `~491 kB`,
  - validación Docker local renovada para `backend` y `frontend`.
- Nuevo subbloque ya ejecutado:
  - limpieza de warnings en `calendar/crm` y `sales`,
  - `frontend npm run lint` bajó de `55` a `21`,
  - endurecimiento de `mjml` en backend bloqueando `mj-include` y limitando tamaño de template,
  - reducción del `npm audit` del backend de `46` a `41` vulnerabilidades,
  - decisión explícita de aceptar `vendor-pdf` y `vendor-charts` como bundles pesados aislados sin seguir partiéndolos por ahora,
  - validación Docker local renovada otra vez para `backend` y `frontend`.
  - corrección de runtime productivo del admin:
    - se reemplazó `react-apexcharts` por integración directa con `apexcharts` en el wrapper compartido,
    - luego se detectó que la causa más precisa era la circularidad de chunks entre `vendor-react` y `vendor-charts`,
    - el rollback final removió por completo `manualChunks` del admin para priorizar estabilidad del bundle productivo,
    - se agregó `no-cache` al fallback SPA en nginx para evitar que el navegador siga cargando HTML con referencias a chunks viejos,
    - Docker local del frontend fue reconstruido con ese cambio.
  - continuidad de sesión del admin:
    - se agregó bootstrap de sesión desde cookie HTTP-only mediante `GET /auth/session`,
    - `ProtectedRoute` y `PublicRoute` ahora esperan la resolución inicial de sesión antes de redirigir,
    - se preserva el endurecimiento previo: `auth` sigue sin persistirse en storage del navegador.
- El storefront quedó con `lint` limpio y `build` verde; el ruido restante proviene del prerender de rutas demo/heredadas y del modo degradado controlado.
- La limpieza mínima del storefront ya quedó iniciada:
  - rutas demo despublicadas sin borrar código,
  - fallbacks inseguros apagados por defecto en Docker dev,
  - validación Docker/HTTP local cerrada con redirects y `404` reales.
  - ajuste posterior:
    - `/shop` vuelve a formar parte de la superficie pública oficial,
    - la verificación de sesión anónima deja de ensuciar consola con `401` porque `/api/storefront/auth/session` ahora responde `200 null`,
    - Docker local validado nuevamente con `/shop` en `200` y `/product/search/cortinas` redirigiendo al catálogo.
 - Nuevo cierre del bloque actual:
 - `frontend` quedó sin warnings de lint; el remanente del admin se cerró en `sales/ProductForm`,
  - el frente crítico de `backend` sobre `xlsx` y `mjml` quedó cerrado en la subronda siguiente, con audit productivo en `0` tras la migración estructural,
  - los remanentes previos ligados a `prisma/@prisma-config`, `effect` y `ajv` quedaron mitigados con overrides conservadores,
  - Docker local se reconstruyó y validó otra vez para `backend` y `frontend`.

### Riesgos abiertos

- Rotación operativa pendiente de secretos ya expuestos históricamente.
- Docker runtime local ya quedó validado; el riesgo abierto es cómo resolver el drift de `CONFIG_ENCRYPTION_KEY` sin depender indefinidamente de una clave histórica.
- La base local depende hoy de una clave histórica conocida; conviene decidir entre compatibilidad temporal en local o regeneración/re-cifrado de `SecureConfig`.
- Cookie-only auth aún no completada al 100% en admin/storefront.
- Remanente de seguridad operativo: secretos históricos, deriva local de `CONFIG_ENCRYPTION_KEY` y superficie pública/degradación del storefront.
- Storefront con mezcla de template y producto real.
- Estrategia de procedencia de datos y operación degradada del storefront todavía no definida.
- La clave histórica compatible de la base local quedó identificada en el historial del repo; sigue pendiente decidir si se reutiliza temporalmente o si se limpia/re-cifra `SecureConfig`.

- 2026-03-21
  - Retoma operativa:
    - el stack Docker volvió a quedar funcional con PostgreSQL local disponible vía `postgres-local`,
    - `backend`, `frontend` y `storefront` quedaron otra vez en `Up`,
    - se revalidó el bloque antes de seguir con cambios de storefront.
  - Nuevo avance sobre el storefront:
    - se eliminó otro tramo de fallback implícito a datasets Bonik en catálogo y navegación,
- `market-1` quedó reducido a API real + vacío controlado, sin compatibilidad con colecciones mock heredadas,
- la configuración de storefront ya no cae a navegación/footer demo cuando la API falla y los snapshots están desactivados,
- el fallback actual pasa a ser una configuración mínima y explícita del producto real.
  - Estado resultante:
    - `ecommerce lint`: verde,
    - `ecommerce build`: verde,
    - runtime del storefront validado otra vez en Docker,
    - el siguiente paso natural ya no es seguir limpiando mocks del catálogo base, sino atacar la definición final del set oficial de rutas públicas y el recorte de la superficie demo restante.
  - Subbloque adicional ya ejecutado:
    - `shops` deja de depender de snapshots y mocks locales,
    - `mobile-category-nav` queda preservado en `page.demo.tsx`, pero fuera del flujo normal mientras los demo routes sigan desactivados,
    - se mantiene el criterio acordado: preservar código reutilizable, pero separar lo activo de lo heredado/demo.
  - Ajuste puntual ya ejecutado:
    - el configurador paramétrico deja de tratar el `404` de config como error técnico visible en consola,
    - la navegación móvil de categorías pasa a reutilizar el mismo `CategoryDropdown` del menú de categorías principal para evitar divergencia visual y funcional.
  - Nuevo ajuste estructural ya ejecutado:
    - el configurador paramétrico del storefront quedó alineado al contrato real de admin/backend,
    - se reemplazó el modelo legado basado en `inputs.series/color/glass` y medidas en metros por el snapshot canónico con:
      - `selectors.families`, `series`, `materials`, `colors`, `glass`, `widths`, `heights`, `shutterMaterials`,
      - `compatibility.glassBySeries`, `monoblockBySeries`, `sizeLimits`,
      - quote request canónico en milímetros y con flags reales del backend,
    - el storefront ya no inventa breakdowns ni campos no soportados por backend como `monoblockColor`,
    - el carrito pasa a persistir configuración paramétrica canónica.
  - Validación del subbloque:
    - `ecommerce npm run lint`: verde,
    - `ecommerce npm run build`: verde,
    - `docker compose -f deploy/docker-compose.dev.yml up -d storefront`: verde,
    - `curl http://127.0.0.1:3000/api/health`: `{"status":"ok"}`.
  - Cierre de incidencia crítica del flujo paramétrico:
    - el `404` de `/api/storefront/products/:id/parametric-config` se debía a que el entorno local estaba corriendo la variante `core`,
    - se alineó el desarrollo local a `urucortinas` en Docker y en `.env` locales para que admin/backend/storefront compartan el mismo set de features,
    - se dejó además el backend preparado para resolver el `parametricProductId` base cuando el producto público paramétrico no tiene matriz propia.
  - Validación:
    - `backend npm run lint`: verde,
    - `backend npm run build`: verde,
    - `docker compose -f deploy/docker-compose.dev.yml build backend frontend storefront`: verde,
    - `docker compose -f deploy/docker-compose.dev.yml up -d backend frontend storefront`: verde,
    - logs de backend:
      - `GET /api/storefront/products/2115/parametric-config`: `200`,
      - `POST /api/storefront/products/2115/parametric-quote`: `201`.
  - Ajuste de consistencia UX en móvil:
    - el menú general del header móvil quedó reimplementado con la misma base visual y de navegación del drawer de categorías,
    - se reemplazó el árbol textual por un menú por niveles consistente con categorías.
  - Validación:
    - `ecommerce npm run lint`: verde,
    - `ecommerce npm run build`: verde,
    - `docker compose -f deploy/docker-compose.dev.yml build storefront`: verde,
    - `docker compose -f deploy/docker-compose.dev.yml up -d storefront`: verde,
    - `curl http://127.0.0.1:3000/api/health`: `{"status":"ok"}`.
  - Alineación de categorías reales en storefront:
    - el nodo superior del menú general móvil mantiene su nombre `Products`, pero queda desplegado por defecto,
    - los enlaces de categorías del storefront dejan de usar la ruta legacy basada en búsqueda textual y pasan a navegar a `/shop?category=<slug-real>`,
    - `shop` deja de aplicar un filtro cliente redundante por categoría y confía en el filtrado ya resuelto por backend,
    - `/product/search/[slug]` queda como compatibilidad controlada:
      - slugs legacy con formato `nombre-id` redirigen a `/shop?category=<slug-limpio>`,
      - términos libres siguen redirigiendo a `/shop?query=<texto>`,
    - validación adicional:
      - `psql` confirmó que no hay colisiones de slug limpio en categorías ni en productos físicos publicados,
      - `npm run build` del storefront ya levanta con `slug "urucortinas"` y no `core`,
      - `GET /api/storefront/categories` devuelve slugs limpios,
      - `GET /api/storefront/products/cortinas-roller` resuelve el slug limpio directamente,
      - `curl -I http://127.0.0.1:3000/shop?category=aberturas`: `200`,
      - `curl -I http://127.0.0.1:3000/product/cortinas-roller`: `200`.
  - Consistencia entre drawers móviles:
    - el menú general móvil y el drawer de categorías móvil quedan alineados en jerarquía visual y espaciado,
    - el drawer de categorías móvil pasa a comportamiento acordeón:
      - categorías con hijos despliegan subniveles al click,
      - categorías hoja navegan a `shop`,
      - el área clickeable primaria pasa a ser toda la fila del ítem, no solo el chevron,
    - se consolidó el renderer móvil compartido en `AccordionMenu.tsx` para evitar duplicación entre ambos drawers,
    - el menú de categorías desktop mantiene el comportamiento hover actual.
  - Refinamiento del bloque móvil ya ejecutado:
    - el árbol móvil se desacopló visualmente de `categories/styles.tsx` con un bloque propio en `components/mobile-navigation/styles.tsx`,
    - se corrigió la desalineación entre iconos izquierdos y texto introducida por el refactor previo,
    - se agregó estado activo y rama activa para rutas y queries reales,
    - se reforzó el feedback táctil de filas móviles (`hover/press/active`) sin contaminar la capa desktop.
  - Ajuste adicional del storefront:
    - el flujo Google auth del storefront dejó de intentar desmontar listeners DOM sobre el popup cross-origin de Google; la detección de cierre pasa a `popup.closed` dentro del polling de sesión,
    - se consolidó un mapper compartido en `lib/storefront/menu-nodes.ts` para evitar divergencia entre navegación general y categorías al construir el árbol móvil,
    - los endpoints `api/public/snapshots` y `api/internal/snapshots` quedan fuera de servicio (`404`) cuando los snapshot fallbacks están desactivados.
  - Alineación de build/runtime en el admin:
    - se detectó que `frontend` estaba compilando con `VITE_CLIENT_SLUG=core` aunque en runtime exponía `urucortinas`,
    - se corrigió `deploy/docker-compose.dev.yml` para centralizar el stack Docker local en una sola variable `CLIENT_SLUG`,
    - backend/frontend/storefront derivan desde esa única fuente sus valores de slug en build-time y runtime,
    - esto corrige la condición que impedía mostrar el menú `Aberturas` pese a tener activo `PARAMETRIC_PRODUCTS`.
  - Recorte incremental adicional del storefront:
    - se eliminó el enlace demo visible del detalle de producto hacia `/shops/scarlett-beauty`,
    - se alinearon los links de reautenticación del dashboard cliente hacia `/account/login`,
    - el loader de snapshots deja de consultar la API de snapshots cuando esa capa está desactivada.
  - Priorización explícita de pendientes de navegación:
    - `Corto plazo`
      - ajustar fino de QA visual móvil si aparecen desalineaciones residuales,
    - `Pendiente a futuro`
      - agregar CTA secundaria “Ver todo” en categorías con hijos,
    - `Mediano plazo`
      - revisar consolidación adicional del modelado entre desktop y mobile,
      - mantener renderers separados si la interacción sigue siendo diferente (`hover` vs `accordion`).
- Ajuste adicional de entorno:
  - se restableció la convención de desarrollo dual del backend:
    - Docker local usa `deploy/env/backend.dev.env` y el override opcional `deploy/env/.env.backend.dev.local`,
    - desarrollo fuera de Docker usa `backend/.env` con `127.0.0.1:5432`,
  - `backend/.env.example` y `backend/README.md` quedaron alineados con esa separación,
  - validación disponible:
    - `psql` contra `127.0.0.1:5432` respondió correctamente,
    - Docker local siguió estable,
    - el arranque `npm start` del backend desde esta herramienta todavía no quedó demostrado al 100% por un `P1001` inconsistente con la prueba SQL directa, así que conviene cerrarlo con una validación manual en terminal del usuario antes de darlo por totalmente resuelto.

### Próxima sesión sugerida

- Profundizar el recorte de superficie pública del storefront y la política de fallbacks controlados.
- Próximo objetivo recomendado:
  - mantener `vendor-pdf` y `vendor-charts` como únicos bundles grandes aceptados salvo evidencia de impacto real,
  - seguir luego con el recorte de superficie pública del storefront y la política de fallbacks controlados.
- 2026-03-21
  - Bloque completado:
    - implementación de `/contact` con contenido dummy controlado y parametrizable,
    - revisión exhaustiva de traducciones activas del storefront (`es/en`) en flujo público,
    - limpieza de metadata activa residual de `Bonik/UI-LIB/Storefront`,
    - redirect estable de `/products` y `/search` hacia `/shop`,
    - saneamiento de topbar/footer/paneles para no mostrar valores template en runtime.
  - Archivos/base técnica incorporada:
    - `ecommerce/src/components/storefront/InfoPage.tsx`
    - `ecommerce/src/components/i18n/TranslatedText.tsx`
    - `ecommerce/src/lib/page-metadata.ts`
  - Estado después del bloque:
    - storefront `lint/build`: verdes,
    - Docker local validado,
    - metadata pública activa validada en runtime para `/contact` y `/cart`,
    - `/products` validado con redirect `307 -> /shop`.
  - Siguiente foco recomendado:
    - continuar recortando superficie demo restante del storefront,
    - seguir consolidando el fallback controlado sin reintroducir datos demo,
    - después retomar el siguiente bloque del roadmap general.
- 2026-03-21
  - Bloque incremental ejecutado antes de volver al roadmap general:
    - reforzar uso de `companyProfile` del backend/admin en storefront activo,
    - cerrar preferencia de idioma con persistencia real para usuarios autenticados,
    - atacar la intermitencia del home,
    - mejorar búsqueda por producto/categoría y feedback de vacío.
  - Implementación aplicada:
    - `companyProfile`
      - se consolidó el consumo en `Logo`, `Topbar`, `Footer1` y `/contact`,
      - no se agregó una segunda fuente de datos; se mantuvo `storefront/config` como contrato único hacia el storefront.
    - `i18n`
      - la detección inicial usa `navigator.languages`,
      - el orden efectivo de resolución queda:
        - preferencia del usuario autenticado en DB,
        - preferencia persistida en navegador,
        - idioma del navegador,
        - fallback a `es`,
      - el cambio de idioma de usuario autenticado ahora sincroniza hacia backend vía `account/profile`.
    - `home`
      - categorías destacadas, productos destacados y novedades pasaron de fetch server-side frágil a fetch cliente con cache/control de refresh,
      - se reutilizó el mismo enfoque para el shelf por categoría,
      - esto reduce la divergencia que existía entre menú de categorías cargado en cliente y home vacía por fallo puntual de render server-side.
    - `búsqueda`
      - el buscador ahora trabaja sobre productos y categorías,
      - respeta la categoría seleccionada como scope,
      - navega al catálogo aunque no haya match exacto,
      - usa `/shop?category=<slug>` cuando la coincidencia exacta es una categoría,
      - mejora el feedback cuando no hay resultados.
  - Estado al cierre del bloque:
    - storefront `lint`: verde,
    - storefront `build`: verde,
    - Docker local del storefront: validado,
    - se mantiene como observación abierta el fallback mínimo durante `next build` cuando el backend/config responde `500/503` en prerender.
  - Nuevo avance sobre el recorte de superficie demo y fallback controlado:
    - se limpió el home activo para que ya no sirva hero/carrusel demo heredado del template,
    - `market1Defaults` deja de arrastrar assets `apple-watch`, textos genéricos y links absolutos a `localhost`,
    - `/contact` queda incorporada explícitamente al set oficial de rutas públicas,
    - la navegación pública deja de depender de un override puntual de `urucortinas` y pasa a centralizarse en una base compartida para `core` y tenants, evitando mezclas de arrays heredados del backend/defaults,
    - la config pública serializada al cliente deja fuera `layouts` y `policies` demo que no se usan en la UI activa,
    - el carousel del home se reincorpora con información parametrizada del storefront real en vez de slides demo del template,
    - `shops`, `vendor` y `checkout-demo` pasan a patrón de carga diferida:
      - cuando las demo routes están desactivadas, cortan antes de importar layouts y secciones internas,
      - el código demo sigue preservado, pero fuera del flujo normal del storefront,
    - el storefront fue reconstruido sin caché para validar el artefacto real y no un build viejo,
    - la validación desde contenedor confirma:
      - `/login` -> `/account/login`,
      - `/signup` -> `/account/register`,
      - `/market-1` -> `/`,
      - `/checkout-alternative` -> `/checkout`,
      - `/shops` -> `404`,
      - `/mobile-category-nav` -> `404`,
      - el HTML del home ya no incluye marcas demo heredadas,
      - el HTML público del tenant ya no serializa `/about`, `/faq`, `/policies/*`, `nav-services` ni `/services/measurement`.
  - Siguiente foco recomendado:
    - seguir con el recorte restante de superficie demo del storefront en rutas/páginas preservadas de `layout-3`, vendor y shops,
    - seguir consolidando fallback controlado sin reintroducir datos demo ni branding genérico en build-time,
    - luego retomar el siguiente bloque del roadmap general.
- 2026-03-21
  - Subbloque ejecutado sobre el recorte restante del storefront:
    - se reforzó `shops`, `vendor` y `checkout-demo` para que no solo salgan del flujo público, sino que además eviten cargar sus módulos demo pesados cuando las demo routes están deshabilitadas;
    - esto se hizo moviendo layouts/páginas a un patrón de guard clause + import diferido;
    - en `checkout-demo` las implementaciones preservadas quedaron separadas en `page.demo.tsx`.
  - Subbloque general retomado a continuación:
    - limpieza del audit del admin/frontend,
    - salieron `lodash-es` y `mdast-util-to-hast` del reporte productivo,
    - quedó solo `quill` con 2 vulnerabilidades bajas heredadas por `react-quill-new`.
  - Próximo foco recomendado:
    - decidir si el riesgo residual de `quill` se acepta temporalmente o si conviene reemplazar el editor rico del admin,
    - seguir luego con el recorte restante de la superficie demo todavía preservada en módulos no activos,
    - después retomar el siguiente bloque general del roadmap.
- 2026-03-21
  - Ajuste puntual ejecutado fuera del bloque mayor:
    - se contrajo el trigger de categorías del header desktop del storefront para alinearlo con el patrón visual de `fashion-3`,
    - el cambio quedó intencionalmente limitado a ese elemento, sin abrir un rediseño del topbar ni del dropdown desktop.
  - Validación:
    - `cd ecommerce && npm run lint`: verde,
    - `cd ecommerce && npm run build`: verde,
    - `docker compose -f deploy/docker-compose.dev.yml build storefront`: verde,
    - `docker compose -f deploy/docker-compose.dev.yml up -d --force-recreate storefront`: verde,
    - `curl http://127.0.0.1:3000/api/health`: `{"status":"ok"}`.
- 2026-03-21
  - Decisión de riesgo aceptado:
    - el remanente de `quill` en el admin queda aceptado temporalmente como riesgo bajo, dado que la funcionalidad está confinada al panel administrativo y no al storefront público.
  - Subbloque storefront adicional:
    - `shop` recupera la barra superior de resultados con ordenamiento y tipo de visualización,
    - la home desktop pasa a consumir la misma fuente/cache de categorías que usa navegación y catálogo para evitar divergencia funcional.
- 2026-03-21
- Medida operativa incorporada al plan:
  - el `storefront` del compose de desarrollo pasa a ejecutarse en `next dev` dentro de Docker para evitar la recurrencia de runtime desfasado por rebuilds productivos lentos,
  - este cambio queda restringido al stack local de `deploy/docker-compose.dev.yml`,
  - el flujo productivo y el despliegue en DigitalOcean permanecen sin cambios.
- Ajustes funcionales asociados:
  - `/shop` ya no trata `All` como categoría activa,
  - el buscador limpia/cierra mejor al navegar a resultados,
  - el selector de categoría del buscador recupera prioridad de click.
- Criterio a partir de este punto:
  - usar el `storefront` Docker local en modo dev para iteración y validación rápida,
  - reservar validaciones de build productivo del `ecommerce` para bloques específicos donde realmente haga falta chequear el artefacto de release.
- 2026-03-21
  - Ajuste adicional del buscador del storefront:
    - se consolidó una única fila base reutilizable para el nav de categorías desktop y los resultados del buscador,
    - esto evita mantener dos implementaciones visuales separadas para categorías/productos dentro del dropdown,
    - la diferenciación entre ambos tipos queda resuelta por jerarquía de contenido sobre el mismo componente compartido.
- 2026-03-22
  - Se declara cerrado el bloque actual del storefront:
    - inventario final y criterio `activo / preservado / despublicado` documentado,
    - política de fallback y procedencia de datos cerrada,
    - backlog diferido separado para evitar seguir ampliando el alcance de este frente.
  - A partir de este cierre, el siguiente frente principal del roadmap pasa a ser `Product Readiness / E2E Commerce`;
  - cualquier ajuste menor del storefront deja de tratarse como bloque abierto y pasa a modalidad incidencia puntual/backlog.

## Fase 8. Product Readiness / E2E Commerce

### Objetivo

Convertir la base ya estabilizada en un flujo comercial completo, verificable y apto para salida controlada.

### Estado actual de partida

- Catálogo público, navegación, carrito base y checkout existen en código y storefront activo.
- Mercado Pago, mails y datos de entrega existen parcialmente a nivel técnico, pero no quedaron aún validados como flujo completo punta a punta.
- No hay todavía una evidencia consolidada de:
  - compra completa sin intervención manual,
  - envío de mails transaccionales reales,
  - conciliación básica entre checkout, pago, notificaciones y estado posterior.

### Estado deseado

- Flujo básico end-to-end operativo y probado:
  - producto -> carrito -> checkout -> compra -> pago -> confirmación.
- Mails transaccionales funcionales para:
  - comprador,
  - administración/propietario del sitio.
- Mercado Pago validado con:
  - creación de preferencia/orden,
  - retorno/estado,
  - notificaciones relevantes,
  - consistencia mínima entre backend y storefront.
- Datos de envío/entrega relevados e incorporados al flujo con el mínimo necesario para operación real.
- Checklist funcional y testing exploratorio con incidencias críticas en cero.

### Subfases recomendadas

#### Subfase 8.1. Relevamiento técnico-operativo

- Mapear estado actual y huecos de:
  - catálogo y stock público,
  - carrito,
  - checkout,
  - Mercado Pago,
  - mails transaccionales,
  - datos de envío/entrega,
  - notificaciones.
- Identificar:
  - qué ya existe,
  - qué está parcial,
  - qué está desconectado,
  - qué requiere definición funcional.

Estado relevado:

- documentado en `PRODUCT_READINESS_E2E_ASSESSMENT.md`;
- `catálogo y stock público`: usable, con gap pendiente sobre reserva/descuento de stock;
- `carrito`: usable, pero local-only y sin persistencia server-side;
- `checkout`: mínimo funcional, pero todavía sin fulfillment real cerrado;
- `Mercado Pago`: implementado, pero con inconsistencias críticas a resolver antes de considerarlo cierre E2E;
- `mails` y `notificaciones`: infraestructura existente, aún no consolidada como flujo transaccional final del comprador;
- `envío/entrega`: modelado en backend/admin, no resuelto todavía en storefront público.

Conclusión de la subfase:

- la siguiente prioridad no es abrir nuevas features;
- es cerrar la semántica de pago y el post-pago real antes de pasar a QA intensiva.

#### Subfase 8.2. Cierre del flujo comercial base

- Dejar operativo el camino mínimo:
  - agregar producto,
  - persistir carrito,
  - completar checkout,
  - generar orden,
  - disparar pago,
  - confirmar resultado,
  - dejar trazabilidad de post-compra.

Prioridad interna sugerida:

1. corregir tratamiento de estados `pending` / `in_process` / `approved` / `authorized`;
2. alinear `paymentIntent`, `Payment`, estado de orden y timeline;
3. asegurar que el pago confirmado dispare notificaciones y mails correctos;
4. recién después consolidar cierre funcional del pedido.

Delegación operativa:

- documentada en `E2E_DELEGATION_PLAN.md`;
- workstreams de exploración inicial:
  - `payments-semantics`,
  - `post-payment-orchestration`,
  - `checkout-fulfillment`,
  - `stock-order-integrity`,
  - `e2e-test-design`;
- criterio de implementación:
  - `payments-semantics` + `post-payment-orchestration` se implementan en un mismo frente (`codex/e2e-payments-core`) para evitar divergencia y conflictos de merge;
  - `checkout-fulfillment`, `stock-order-integrity` y `e2e-test-design` siguen después como frentes separados.

Estado actual del frente `codex/e2e-payments-core`:

- ya quedó implementado el primer slice seguro:
  - checkout/storefront deja de considerar `pending` / `in_process` / `authorized` como pago finalizado;
  - `createOrder` ya no fuerza `PAID` al adjuntar `paymentIntentId`;
  - `MercadoPagoService` recalcula financieros de la orden tras espejar el pago;
  - `authorized` deja de tratarse como liquidado.
- siguiente slice interno del mismo frente:
  - consolidar post-pago transaccional:
    - timeline real,
    - notificaciones,
    - mails,
    - y cierre consistente entre webhook, attach y accounting.
- avance adicional ya aplicado:
  - se agregó una capa compartida mínima de settlement en `orders` para evitar duplicación entre accounting y Mercado Pago storefront;
  - attach/webhook/manual payment ahora convergen en:
    - `recalculateOrderFinancials`,
    - `ensurePaymentWaiting`,
    - timeline de captura,
    - transición de estado,
    - dispatch post-commit de notificaciones;
  - el frente ya no está solo en “alineación de estados”, sino también en “orquestación post-pago base”.
- pendiente dentro del mismo frente:
  - pruebas más integrales de transición completa `createOrder -> attach/webhook -> paid`,
  - revisar drift residual de escenarios manuales/ediciones,
  - luego pasar a `checkout-fulfillment`.
- refuerzo adicional ya aplicado:
  - `accounting/payments.service.ts` queda cubierto por tests del flujo de settlement compartido;
  - el blocker explícito de build en `/account/address/create` queda corregido con `Suspense`.
- refuerzo adicional posterior:
  - `storefront.service.spec.ts` agrega una prueba de borde de `createOrder` con `paymentIntentId` adjunto y estado `authorized`, verificando que la orden no se cierre como `PAID`;
  - se abre la primera capa de `checkout-fulfillment` con `shippingOptionId` público y snapshot de entrega en la orden.
- lectura actual:
  - el frente de pagos queda suficientemente estabilizado para seguir profundizando `checkout-fulfillment`,
  - manteniendo los escenarios de integración E2E de pagos dentro del checklist final de commerce readiness.

#### Subfase 8.3. Integraciones transaccionales

- Validar mails al comprador y al sitio.
- Validar Mercado Pago real o sandbox con evidencia suficiente.
- Revisar notificaciones necesarias:
  - internas,
  - al cliente,
  - asociadas a cambios de estado de la compra.

#### Subfase 8.4. Envío y entrega

- Relevar los datos mínimos requeridos para entrega:
  - dirección,
  - localidad/departamento,
  - contacto,
  - observaciones,
  - modalidad de entrega o retiro,
  - cualquier dato adicional que el negocio realmente necesite.
- Ajustar modelo/checkout solo después del relevamiento, no por intuición.

Observación vigente:

- backend/admin ya soportan `shippingVendor`, `deliveryFees`, `estimatedMin`, `estimatedMax`;
- storefront ya consume una primera capa operativa del modelo:
  - expone opciones públicas de entrega,
  - exige selección en checkout,
  - suma `deliveryFees` al total público,
  - y snapshota `shippingVendor` + `estimatedMin/estimatedMax` al crear la orden.
- capa adicional ya aplicada:
  - la modalidad pública queda explicitada como `home_delivery`,
  - backend la valida junto con país (`UY`) y opción de entrega,
  - review/confirmación ya muestran snapshot real de entrega.
- pendiente dentro de la subfase:
  - endurecer reglas futuras si se incorpora retiro u otras modalidades,
  - y revisar restricciones futuras de moneda/fee si el storefront vuelve a operar multi-currency.

#### Subfase 8.4.a. Stock Integrity MVP

- Slice ya aplicado:
  - `OrderStockIntegrityService` centraliza commit/release de stock básico;
  - storefront descuenta stock no permanente dentro de la transacción de creación de orden;
  - admin libera stock al cancelar una orden.
- Alcance actual:
  - producto simple / paramétrico con stock a nivel producto,
  - variante con stock propio.
- Política cerrada:
  - no se soporta reapertura `cancelled -> activo` sobre la misma orden;
  - `reabrir`, `repetir` y `regenerar` deben crear una nueva orden;
  - la orden cancelada original permanece cancelada;
  - la validación ya quedó codificada en `backend/src/orders/order-finance.service.ts`.
- Pendiente:
  - verificar manualmente en admin los flujos excepcionales para asegurar que la UI/operativa respete esta política.

#### Subfase 8.5. QA funcional y testing exploratorio

- Ejecutar una pasada integral sobre:
  - catálogo y stock público,
  - carrito,
  - checkout,
  - pago,
  - mails,
  - datos de envío,
  - estados posteriores a compra.
- Cerrar incidencias críticas antes de abrir nuevos frentes de experiencia/marketing.
- Base ya documentada en `E2E_COMMERCE_QA_CHECKLIST.md`.
- Evidencia mínima ya reunida:
  - health backend/storefront,
  - categorías públicas,
  - producto simple por slug,
  - config paramétrica,
  - shipping options,
  - creación real de orden storefront con snapshot de entrega.

### Validación esperada al cierre

- Compra punta a punta reproducible en entorno controlado.
- Registro consistente de orden, pago y estado final.
- Mails transaccionales emitidos correctamente.
- Datos de entrega capturados con criterio operativo real.
- Checklist funcional documentado con incidencias críticas en cero.

## Fase 9. Mobile-First + Contenido Dinámico

### Dependencia

- No abrir antes de cerrar la Fase 8.

### Objetivo

Evolucionar el storefront hacia una experiencia mobile-first con contenido dinámico y componentes de alto valor visual/comercial.

### Líneas ya acordadas

- Home más fuerte en mobile.
- Feed tipo stories con componentes round, fotos y videos por producto.
- Carousels dinámicos cargados desde CMS interno.
- Navegabilidad móvil inspirada en patrones tipo Instagram/Spotify.
- Mantener criterio de contenido dinámico controlado, no volver a templates demo.

### Criterio

- Esta fase es valiosa, pero no debe competir con el cierre del flujo comercial.
- Abrirla antes de la Fase 8 volvería a mezclar UX avanzada con huecos operativos críticos.

## Fase 10. SEO Dinámico

### Dependencia

- No abrir antes de que:
  - la Fase 8 esté cerrada,
  - el modelo de producto/página y el contenido queden suficientemente estables,
  - la Fase 9 defina el patrón de presentación que realmente va a persistir.

### Objetivo

Implementar SEO dinámico consistente con un ecommerce SaaS real.

### Líneas ya acordadas

- Metadata dinámica por producto/categoría/página.
- Datos estructurados.
- Estructuración de páginas.
- Reacción correcta ante altas, bajas y cambios de productos.
- Base compatible con multi-dominio y evolución futura por tenant.

### Criterio

- No conviene abrir SEO profundo sobre modelos o layouts todavía inestables.
- El SEO dinámico depende de una superficie pública ya consolidada y de contratos de contenido más firmes.

## Nota operativa vigente sobre pagos storefront

- `StorefrontPaymentIntent` pasa a ser la fuente canónica de respaldo para el tramo `pago -> confirmación -> creación de orden`.
- La UX local del checkout puede seguir usando `context/sessionStorage`, pero la consolidación post-pago no debe depender solo del navegador.
- El `checkoutSnapshot` se conserva únicamente mientras sea útil para reconciliación:
  - terminal negativo: 1 hora,
  - intermedio: 24 horas,
  - aprobado sin orden: 7 días,
  - desconocido: 48 horas.
- El intent no se borra por cleanup; se mantiene para auditoría y troubleshooting.
- La reconciliación automática vigente queda así:
  - `resolve` y webhook intentan reconciliar `approved/captured` sin `orderId` usando el snapshot ya preparado en backend;
  - si falta contexto suficiente, el intent se marca para `manual_review_required`;
  - si el provider no está disponible en el boot, la reconciliación histórica se difiere sin degradar esos intents a error funcional.

## Backlog exploratorio storefront adicional

- Quedó documentado en `STOREFRONT_EXPLORATORY_BACKLOG_2026-03-22.md`.
- Agrupa los siguientes bloques para ejecución posterior:
  - pagos parciales y cronología final de pedido,
  - moneda única de compra vs visualización posterior,
  - selector de idioma reactivo,
  - selector de búsqueda con `Todas las categorías`,
  - variantes configurables de productos paramétricos publicados,
  - registro/perfil de usuario con validaciones reales y sin datos dummy,
  - mejora integral de `contact`,
  - filtro correcto de rango de precios en `shop`,
  - feed tipo stories para categorías como evolución mobile-first.

### Estado parcial de la ola 1

- Ya resuelto en esta ronda:
  - selector de idioma reactivo sin refresh manual,
  - reaparición de `Todas las categorías` en el selector de búsqueda,
  - filtro de rango de precios sin clamp artificial de query,
  - preservación de moneda original elegida por el cliente en el snapshot de checkout previo al post-pago,
  - registro storefront alineado a `teléfono obligatorio / mail opcional`,
  - normalización consistente de teléfono en frontend/backend para lookup y recuperación,
  - perfil público sin saldo dummy.
- Sigue pendiente dentro de la misma ola:
  - definición final de visualización histórica de moneda luego de la compra,
  - bajada operativa del relevamiento nuevo de:
    - ABM de plantillas/configuración de mails,
    - correos transaccionales de compra/autenticación,
    - anonimización/protección de datos personales.

### Validación adicional cerrada

- Pagos parciales manuales:
  - caso real ejecutado sobre la orden `#101` usando `PaymentsService` dentro del contenedor backend;
  - secuencia resultante validada:
    - `ORDER_RECEIVED`
    - `PAYMENT_PARTIAL`
    - `PAYMENT_PARTIAL`
    - `PAYMENT_FULL`
- UX storefront:
  - cards principales activas ajustadas para mostrar el nombre completo del producto sin truncado de una sola línea.
  - `/contact` alineado al layout storefront real y sin warning React por keys duplicadas.
  - edición de perfil storefront alineada a `teléfono obligatorio / mail opcional`, con avatar solo informativo y copy consistente.
  - registro storefront con feedback visible de obligatoriedad/opcionalidad y hint de normalización de teléfono.
  - backlog exploratorio ampliado con la implementación recomendada para:
    - variantes configurables de paramétricos publicados basadas en resolver canónico backend,
    - operación real de templates/emails,
    - privacidad/anonimización.
  - slice inicial implementado para paramétricos publicados:
    - backend ya expone `publishedParametricOptions` con variantes reales por `productId`,
    - storefront detalle ya puede seleccionar entre variantes publicadas disponibles sin reabrir el flujo de cotización libre.
  - bloque operativo de mails/privacidad relevado y aterrizado en:
    - `EMAIL_PRIVACY_OPERATIONS_2026-03-22.md`.

## Subfase Email/Privacy Hardening

- Documento operativo activo:
  - `EMAIL_PRIVACY_HARDENING_2026-03-23.md`
- Primer slice ya implementado:
  - locale separado por audiencia en emails transaccionales (`customer` vs `admin`);
  - masking server-side de direcciones en logs de email del panel admin.
- Segundo slice ya implementado:
  - mails storefront enriquecidos para:
    - `pedido recibido`,
    - `pago recibido`,
    - `cambio de estado`;
  - defaults de `NotificationSettings` ajustados para dejar activos por defecto los canales `EMAIL` que el flujo storefront necesita;
  - patch conservador para settings legacy nunca modificados.
- Estado actual:
  - validación de código cerrada;
  - evidencia end-to-end real de envíos storefront todavía pendiente.
- Próximos pasos:
  1. validar compra storefront con evidencia real de:
     - orden recibida,
     - pago recibido,
     - aviso admin;
  2. cerrar gobernanza operativa de templates/settings:
     - roles,
     - versión activa por locale/variant,
     - preview/test controlado;
  3. seguir con inventario/masking de PII en:
      - `orders`,
      - `customers`,
      - `notifications`,
      - exportes/reportes.
  4. dejar explicitado como backlog aparte:
      - welcome mail de registro,
      - activación/verificación de cuenta por email,
      - abandono de checkout.
