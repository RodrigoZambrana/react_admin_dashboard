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
  - storefront sin warnings de ESLint; el ruido residual ya viene del prerender de rutas demo/heredadas.
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
  - `backend` mejora, pero sigue siendo el frente más riesgoso por `xlsx`, `mjml`, `nodemailer`, `prisma` y dependencias transitivas de toolchain;
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

### Subfase 3.3. Upgrades delicados

- Backend
  - `mjml`
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

### Riesgos abiertos

- Rotación operativa pendiente de secretos ya expuestos históricamente.
- Docker runtime local ya quedó validado; el riesgo abierto es cómo resolver el drift de `CONFIG_ENCRYPTION_KEY` sin depender indefinidamente de una clave histórica.
- La base local depende hoy de una clave histórica conocida; conviene decidir entre compatibilidad temporal en local o regeneración/re-cifrado de `SecureConfig`.
- Cookie-only auth aún no completada al 100% en admin/storefront.
- Remanente relevante de seguridad todavía abierto en `backend` (`xlsx`, `mjml`, `prisma`, toolchain Nest) y en algunas dependencias/tooling del `frontend`.
- Storefront con mezcla de template y producto real.
- Estrategia de procedencia de datos y operación degradada del storefront todavía no definida.
- La clave histórica compatible de la base local quedó identificada en el historial del repo; sigue pendiente decidir si se reutiliza temporalmente o si se limpia/re-cifra `SecureConfig`.

### Próxima sesión sugerida

- Ejecutar la siguiente subronda de seguridad remanente y luego profundizar el recorte de superficie pública del storefront.
- Al volver sobre storefront, revisar si las URLs de categoría deben seguir aterrizando en `/shop?query=<slug>` o migrar a un filtro explícito por categoría.
- Próximo objetivo recomendado:
  - seguir bajando warnings del admin, ahora priorizando `invoice`, `expenses`, `settings` y `sales/ProductForm`,
  - evaluar la decisión estructural para `xlsx` y `mjml`:
    - reemplazo,
    - aislamiento adicional,
    - o aceptación temporal con hardening y riesgo explícito,
  - mantener `vendor-pdf` y `vendor-charts` como únicos bundles grandes aceptados salvo evidencia de impacto real.
