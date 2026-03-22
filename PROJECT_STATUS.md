# PROJECT_STATUS

## Contexto inicial del proyecto

Este documento preserva el marco base acordado para el proyecto:

- Analizar el repositorio completo como base de continuidad de largo plazo.
- Priorizar primero seguridad, mantenibilidad, estabilidad y capacidad real de evolución.
- Tomar el código, la configuración y la estructura real del repo como fuente principal.
- Usar `README.md` solo como apoyo contextual y marcar explícitamente sus desactualizaciones.
- Dejar una memoria técnica reutilizable para futuras retomadas, cambios de criterio y nuevas etapas.

## Alcance y evidencia usada

Hechos observados sobre el repositorio al `2026-03-20`:

- Módulos principales presentes: `backend/`, `frontend/`, `ecommerce/`.
- Infraestructura presente: `deploy/docker-compose.*.yml`, `Makefile`, `app.yaml`, `env.schema.json`, `scripts/check-env.mjs`.
- Documentación principal leída: `README.md`.
- Validaciones ejecutadas localmente:
  - `make env-check`
  - `docker compose -f deploy/docker-compose.dev.yml config`
  - `docker compose -f deploy/docker-compose.dev.yml build backend frontend storefront`
  - `docker compose -f deploy/docker-compose.dev.yml up -d`
  - `docker compose -f deploy/docker-compose.dev.yml ps`
  - `docker compose -f deploy/docker-compose.dev.yml logs --no-color --tail 120 backend frontend storefront`
  - `backend`: `npm run lint`, `npm test`, `npm run build`, `npm audit --package-lock-only --json`, `npm outdated --json`
  - `frontend`: `npm run lint`, `npm test`, `npm run build`, `npm audit --package-lock-only --json`, `npm outdated --json`
  - `ecommerce`: `npm run lint`, `npm run build`, `npm audit --package-lock-only --json`, `npm outdated --json`

Limitaciones:

- No se ejecutó una prueba funcional end-to-end contra backend + admin + storefront corriendo integrados.
- La validación Docker quedó parcial por conflictos de puertos del host (`3000`, `5432`) y por una desalineación entre `CONFIG_ENCRYPTION_KEY` y valores cifrados persistidos en la base local.
- No se validó acceso real a base de datos, Redis, Google OAuth, Mercado Pago o SMTP/IMAP.
- Cuando una conclusión depende de comportamiento de negocio no visible en código, se marca como validación manual pendiente.

## 1. Resumen ejecutivo

### Estado general

El proyecto tiene una base funcional y una separación razonable por aplicaciones, pero hoy no está en una condición operativa consistente para mantenimiento seguro:

- `backend` recuperó baseline operativa: `lint`, `test` y `build` en verde. La deuda principal ya no está en tooling, sino en vulnerabilidades y endurecimiento.
- `frontend` recuperó baseline ejecutable: `lint` sin errores, `test` en verde y `build` en verde. Persisten warnings y señales de bundle/CSS que no bloquean.
- `ecommerce` recuperó baseline ejecutable: `lint` y `build` en verde. El lint ya quedó limpio; el ruido remanente aparece durante `next build` por prerender de rutas demo/heredadas y degradación controlada cuando el backend no está disponible.

### Principales riesgos

- Exposición histórica de secretos/credenciales en archivos versionados.
- Tokens de sesión persistidos en navegador para admin y storefront.
- Dependencias vulnerables relevantes en los tres módulos, aunque la primera ola de actualización ya redujo materialmente el riesgo en `frontend` y `ecommerce`.
- Documentación y validación de entornos desalineadas con el código real.
- Storefront con metadata genérica, rutas demo heredadas todavía presentes en código y ruido de prerender; los fallbacks mock ya quedaron apagados por defecto en Docker dev.
- Tooling ya volvió a ser ejecutable, pero todavía no es “silencioso”: `frontend` conserva warnings y señales de bundle/CSS; `ecommerce` conserva ruido de prerender y rutas demo heredadas durante `next build`.
- Docker local ya fue validado en runtime real con override local no versionado para `CONFIG_ENCRYPTION_KEY`; queda pendiente decidir si esa compatibilidad temporal se mantiene o si se re-cifra/limpia `SecureConfig`.

### Principales fortalezas

- Separación clara de backend, admin y storefront.
- Backend con NestJS/Fastify, Prisma, validación global, filtros de errores, correlación y timeouts.
- Infraestructura local y de despliegue visible en repo.
- `env.schema.json` y `scripts/check-env.mjs` existen y ya quedaron reconciliados como baseline de entorno.
- Existe un inicio de capa compartida entre admin y storefront en `src/common`.
- El storefront ya consume parte de la API real y tiene una capa de adapters/configuración reutilizable.

### Qué conviene atacar primero

1. Higiene de secretos y sesiones.
2. Compatibilidad de despliegue y Docker local realmente sana.
3. Línea base de calidad ejecutable: lint, tests y build.
4. Actualización de dependencias vulnerables de bajo riesgo.
5. Limpieza de residuos de template y definición real del alcance del storefront.
6. Recién después: SEO técnico profundo y optimización.

## 2. Mapa del proyecto

### Estructura observada

```text
root/
├── backend/        API NestJS + Fastify + Prisma + PostgreSQL
├── frontend/       Admin React + Vite + Redux Toolkit
├── ecommerce/      Storefront Next.js App Router + styled-components
├── deploy/         Docker Compose dev/testing/prod + env examples
├── docs/           Documentación funcional/técnica adicional
├── scripts/        Validadores/utilidades de repo
├── src/common/     Código compartido real entre admin/storefront
├── app.yaml        Config de DigitalOcean App Platform
├── env.schema.json
├── Makefile
└── README.md
```

### Rol de cada aplicación

- `backend`: concentra lógica de negocio, auth, usuarios, clientes, ventas, pricing paramétrico, email, notificaciones, storefront API y pagos.
- `frontend`: panel administrativo interno para operación del sistema.
- `ecommerce`: storefront público, parcialmente integrado al backend, todavía mezclado con demo/template Bonik.

### Tecnologías principales por módulo

- `backend`
  - Node.js + TypeScript
  - NestJS 11 + Fastify
  - Prisma
  - BullMQ + Redis opcional
  - Nodemailer / MJML / IMAP
  - Mercado Pago

- `frontend`
  - React 19 + Vite 7
  - Redux Toolkit + redux-persist
  - ESLint + Vitest
  - Tailwind CSS 4
  - ApexCharts, React Router, Formik/Yup

- `ecommerce`
  - Next.js 15 App Router
  - React 19
  - styled-components
  - axios + mock adapter
  - mezcla de integración real con backend y fallback a datos demo

### Relación entre módulos

- `frontend` consume `backend` por `/api`.
- `ecommerce` consume `backend` por `/api/storefront`.
- `frontend` y `ecommerce` comparten utilidades mínimas desde `src/common`.
- `deploy/docker-compose.*.yml` define stacks con backend/admin/storefront.
- `app.yaml` solo despliega `frontend` y `backend`; no incluye `ecommerce`.

## 3. Estado actual técnico

### Qué está bien resuelto

- El backend tiene una estructura modular clara y amplia cobertura funcional.
- Hay validación global, sanitización, manejo unificado de errores y correlación de requests.
- La API del storefront ya existe y no es solo una idea de roadmap.
- Hay intención explícita de multi-tenant vía `CLIENT_SLUG`/`VITE_CLIENT_SLUG`/`NEXT_PUBLIC_CLIENT_SLUG`.
- Existen scripts y ejemplos para compose/envs.

### Qué está frágil o desordenado

- La documentación de entorno y despliegue no refleja bien el estado real.
- La calidad automatizada no está alineada con “código listo para evolucionar”.
- El storefront mezcla integración real, fallbacks, snapshots y muchas rutas demo heredadas.
- El storefront no deja suficientemente claro el origen de la información cuando falla el backend: hoy conviven datos vivos, snapshots y residuos demo/mock sin una política de procedencia y degradación bien definida.
- Hay artefactos huérfanos o ambiguos:
  - `root/package-lock.json` sin `package.json` raíz.
  - `root/src/app` y `root/src/components` sin una app raíz que los consuma.
  - `frontend/scripts/sync-shared-common.mjs` copia a `frontend/.shared`, pero la app resuelve `@common` directo contra `../src/common`.

### Qué falta documentar

- Variables reales usadas en runtime: faltan varias en `env.schema.json` y en `.env.example`.
- Estado real de despliegue: hoy hay señales de Docker Compose y DigitalOcean App Platform, pero no una fuente única consistente.
- Dependencias externas opcionales: Redis/colas, SMTP/IMAP, Google OAuth, Mercado Pago, snapshots del storefront.

### Áreas que requieren validación manual adicional

- Flujos reales de auth admin/storefront en browser.
- Cola de emails/notificaciones con Redis habilitado.
- Google OAuth y Mercado Pago de punta a punta.
- Persistencia/caducidad de sesión del storefront bajo refresh y logout.
- Calidad de indexación real del storefront una vez que compile y despliegue.

## 4. Contraste entre README y código real

### Coincidencias

- El repo sí contiene `backend`, `frontend`, `ecommerce`, `deploy`, `Makefile`, `SECURITY.md` y `README.md`.
- La arquitectura general documentada backend/admin/storefront coincide con el repo.
- Existen `env.schema.json` y `scripts/check-env.mjs`.
- Docker Compose dev/testing/prod existe.

### README desactualizado o incompleto

| Tema | README | Código real observado | Impacto |
| --- | --- | --- | --- |
| CI/CD | Habla de GitHub Actions y `.github/workflows/` | No existe `.github/` en el repo | La estrategia de despliegue documentada no es verificable desde el código actual |
| Despliegue | Describe droplet + SSH + GitHub Environments | También existe `app.yaml` para DigitalOcean App Platform | Hay dos historias de despliegue y ninguna aparece consolidada |
| Storefront en despliegue | README lo incluye en la narrativa principal | `app.yaml` solo define `frontend` y `backend` | Riesgo de asumir que storefront está desplegado cuando no hay evidencia en ese manifiesto |
| Validación de envs | README afirma centralización confiable | `make env-check` falla masivamente por drift schema/código/examples | Onboarding y deploy pueden romperse aun siguiendo la doc |
| Estructura | No menciona `app.yaml`, `root/src/common`, `root/src/app`, `docs/` como memoria operativa | Todos existen | Falta mapa real del repo y aparecen piezas huérfanas o no explicadas |

### Información útil del README

- Sirve como visión funcional y de intención de infraestructura.
- Ayuda a entender objetivos de ambientes, compose y variables.
- Es útil como referencia de negocio/módulos más que como verdad operativa exacta.

### Información dudosa u obsoleta

- Pipeline de CI/CD.
- Flujo exacto de despliegue productivo.
- Confiabilidad de `env.schema.json` como lista exhaustiva.

## 5. Auditoría de seguridad y mantenimiento

### Hallazgos priorizados

| Severidad | Título | Módulo | Descripción e impacto | Recomendación | Acción concreta sugerida |
| --- | --- | --- | --- | --- | --- |
| crítico | Secretos y credenciales versionados | repo/app deploy | Hallazgo original confirmado en la auditoría inicial. Quedó parcialmente mitigado en repo: `app.yaml`, `.env.example` y manifests auxiliares ahora usan placeholders no operativos. El riesgo remanente es operativo: todavía hay que rotar en proveedor los secretos que hayan sido usados antes de esta limpieza. | Completar rotación fuera del repo y validar despliegue. | Rotar superadmin, JWT, cookies, MP y `CONFIG_ENCRYPTION_KEY`; confirmar que App Platform y cualquier entorno real ya no reutilizan credenciales históricas. |
| crítico | Storefront con superficie vulnerable heredada del template | ecommerce | Hallazgo parcialmente mitigado. `next` fue actualizado a `15.5.14` y `images.remotePatterns` ya no acepta cualquier host. El riesgo residual ya no es la versión vulnerable base, sino la gran superficie pública heredada: rutas demo, snapshots públicos y prerender innecesario de secciones no oficiales. | Pasar de hardening de dependencias a hardening de superficie pública. | Mantener `next` actualizado, conservar la allowlist de imágenes y avanzar luego con el recorte explícito de rutas públicas/demo. |
| alto | Tokens admin persistidos en navegador | frontend | Hallazgo parcialmente mitigado. El admin ya no persiste `auth` en `redux-persist`, por lo que el JWT dejó de sobrevivir reloads vía storage. Sigue pendiente la mejora estructural: migrar a cookie-only auth o bootstrap explícito desde cookie segura. | Completar transición a auth basada en cookies. | Mantener `auth` fuera del estado persistido y planificar endpoint/me o bootstrap server-side para no depender de bearer en memoria. |
| alto | Access y refresh token del storefront persistidos en `localStorage` | ecommerce/backend | Hallazgo parcialmente mitigado. El storefront ya no persiste sesión en `localStorage` y el backend dejó de exponer `refreshToken` al cliente web. Sigue existiendo `accessToken` en memoria mientras la UI todavía lo usa para algunos llamados protegidos. | Terminar convergencia a cookie-only auth. | Mantener `session-context` basado en `/auth/session` + cookies y, en una iteración posterior, eliminar la necesidad de `Authorization: Bearer` desde la UI. |
| bajo | Reimplementación limpia de importación paramétrica y templates de email | backend | El frente crítico quedó cerrado de forma estructural: `xlsx` fue reemplazado por import/export CSV y `mjml` fue removido en favor de HTML + React Email. También se eliminaron los templates legacy persistidos en la base local para dejar un único formato soportado. | Mantener formato único y evitar reintroducir compatibilidades innecesarias. | Considerar como contrato vigente: CSV-only para matrices paramétricas y HTML-only para templates de email; rechazar cualquier intento de volver a formatos heredados. |
| medio | Dependencias vulnerables relevantes en frontend | frontend | La segunda ola redujo el audit a 8 vulnerabilidades (3 altas, 4 moderadas, 1 baja). El remanente quedó concentrado en toolchain (`rollup`, `minimatch`, `ajv`) y librerías UI/editor (`quill`). | Tratar esta ronda como mitigación parcial y aislar una siguiente pasada de toolchain/UI. | Evaluar actualización adicional de ESLint/tooling transitivo y revisar si `quill` sigue siendo imprescindible o puede encapsularse/reemplazarse. |
| alto | Validación de entornos rota y documentación de envs inconsistente | repo completo | Hallazgo mitigado en esta etapa. Se reconciliaron `env.schema.json`, `.env`, `.env.example` y `deploy/env/*` hasta recuperar `make env-check` en verde. Persiste deuda de fondo: todavía hay duplicación documental entre manifests y varios archivos de entorno. | Mantener una única fuente de verdad por módulo. | Tomar el schema actual reconciliado como baseline, evitar nuevas variables fuera de ese circuito y revisar más adelante si conviene generar examples automáticamente. |
| medio | La baseline de calidad volvió a estar operativa, pero queda ruido de build | repo completo | El bloqueo duro ya quedó resuelto: `backend lint/test/build`, `frontend lint/test/build` y `ecommerce lint/build` pasan. El riesgo remanente es de mantenibilidad y señal: `frontend build` todavía emite warnings CSS/chunks y `ecommerce build` sigue generando logs de degradación controlada y prerender sobre rutas demo/heredadas. | Tratar la baseline actual como piso mínimo y bajar el ruido por prioridad. | Mantener estos comandos como gate obligatorio y abrir una subfase de cleanup enfocada en build noise de `frontend` y reducción de rutas demo/SSG innecesario del storefront. |
| alto | Rutas demo y metadata de plantilla expuestas en storefront | ecommerce | Persisten rutas y textos Bonik (`/login`, `/signup`, `/(layout-3)`, metadata “Bonik”), junto con fallback a mocks y ausencia de `robots`/`sitemap`. Afecta SEO, marca y control de alcance. | Recortar superficie pública a las rutas reales del storefront. | Deshabilitar o borrar rutas demo, fijar metadata por tenant y agregar `robots.ts`/`sitemap.ts`. |
| alto | Procedencia de datos poco clara en modo degradado del storefront | ecommerce | Ante fallas del backend, el storefront puede terminar mostrando snapshots o fallbacks sin que quede claro su origen, vigencia ni criterio de activación. Eso es riesgoso para negocio, soporte y evolución hacia un producto con modos de operación diferenciados. | Definir una política explícita de resiliencia de datos antes de seguir expandiendo el storefront. | Separar formalmente datos vivos, snapshots controlados y mocks de desarrollo; exponer metadatos de procedencia/frescura y prohibir fallback implícito a datasets demo sin trazabilidad. |
| medio | Endpoint interno de snapshots queda público si falta token | ecommerce | `src/app/api/internal/snapshots/route.ts` autoriza `GET`/`POST` si `SNAPSHOT_ACCESS_TOKEN` no está definido. Los examples actuales omiten esa variable en varios casos. | Exigir token siempre o deshabilitar la ruta fuera de entornos controlados. | Hacer fail-closed: si no hay token, devolver 403/404 y documentar la variable. |
| medio | Subida de SVGs servidos desde mismo origen | backend | `persistShippingLogo` acepta `image/svg+xml` y los sirve desde `/uploads/`. SVG navegable puede introducir riesgo de scripting/abuso si no se sanea estrictamente. | Restringir tipos o sanitizar SVG del lado servidor. | Quitar SVG del allowlist o procesarlo/sanitizarlo antes de persistir. |
| medio | Fallbacks mock activos por defecto en storefront | ecommerce | Hallazgo parcialmente mitigado. Los defaults inseguros ya quedaron en `false` para Docker dev y examples, y el storefront devuelve datasets vacíos/controlados cuando falla el backend en esos escenarios. El riesgo remanente es de gobernanza: todavía hay que revisar otros entornos y terminar de separar snapshots controlados, degradación funcional y residuos demo heredados. | Hacer fail-safe en todos los entornos y documentar procedencia de datos. | Mantener defaults en `false`, revisar manifests restantes y definir formalmente cuándo se permite snapshot, fallback controlado o vacío funcional. |
| medio | CORS y secretos con defaults inseguros si faltan envs | backend/frontend | Mitigado en gran parte. Backend y frontend ahora exigen secretos configurados fuera de `development`/`test`, manteniendo solo fallbacks locales explícitos para desarrollo. Sigue pendiente revisar la política de match de CORS y reducir defaults de conveniencia que no sean estrictamente necesarios. | Completar endurecimiento de arranque y revisar CORS. | Mantener validación estricta en no-dev y hacer una pasada específica sobre allowlist de orígenes. |
| medio | Docker local requiere política explícita para `CONFIG_ENCRYPTION_KEY` | deploy/backend/frontend/ecommerce | La compatibilidad de build y runtime Docker ya quedó validada. El riesgo que permanece no es de arranque sino de gobernanza local: hoy el entorno depende de una clave histórica compatible para descifrar `SecureConfig` existente. | Definir si esa compatibilidad será temporal o si se re-cifrará/limpiará la configuración segura local. | Mantener el override local no versionado mientras se decide la migración de `SecureConfig`; evitar promover esa clave histórica a manifests trackeados. |
| alto | Desalineación entre `CONFIG_ENCRYPTION_KEY` y configuración cifrada persistida | backend | Al levantar backend dentro de Docker, `ConfigEncryptionService` no pudo descifrar valores seguros existentes (`Unsupported state or unable to authenticate data`). La verificación posterior confirmó que la base local no fue cifrada con la clave dummy actual, sino con una clave histórica versionada en commits anteriores. El backend arranca, pero parte de la configuración operativa queda inválida mientras se use la clave local placeholder. | Resolver la consistencia entre clave de cifrado y datos persistidos antes de depender del entorno local como referencia operativa. | Usar en local la clave histórica compatible solo si se necesita preservar esa base; en paralelo planificar limpieza o re-cifrado de `SecureConfig` para no depender de una clave conocida históricamente. |
| bajo | Higiene de repo débil | repo completo | Hay `.DS_Store` versionados en varios subárboles, `root/package-lock.json` vacío/origen dudoso, y código raíz sin ownership claro. | Limpiar artefactos y definir ownership. | Eliminar residuos, actualizar `.gitignore` y documentar si `src/common` es shared package real o no. |

## 6. Librerías y dependencias

### Vulnerabilidades confirmadas por `npm audit`

| Módulo | Resumen |
| --- | --- |
| backend | 0 vulnerabilidades productivas tras remover `xlsx` y `mjml` del grafo de dependencias |
| frontend | 8 vulnerabilidades: 3 altas, 4 moderadas, 1 baja |
| ecommerce | 1 vulnerabilidad moderada (`lodash-es`) |

### Dependencias directas a priorizar

#### Backend

- `@nestjs/platform-fastify` `11.1.7 -> 11.1.17`
- `@nestjs/common` `11.1.7 -> 11.1.17`
- `@nestjs/core` `11.1.7 -> 11.1.17`
- `@nestjs/config` `4.0.2 -> 4.0.3`
- `@nestjs/cli` `11.0.10 -> 11.0.16`
- `@prisma/client` / `prisma` `6.18.0 -> 6.19.2` (`7.5.0` latest mayor)
- `mercadopago` `2.9.0 -> 2.12.0`
- `imapflow` `1.0.200 -> 1.2.16`
- `mailparser` `3.7.5 -> 3.9.4`
- `mjml` removido; reemplazado por React Email + HTML como único formato soportado
- `xlsx` removido; reemplazado por import/export CSV con `csv-parse`
- `nodemailer` `6.10.1 -> 8.0.3` mayor
- `bullmq` `4.18.3 -> 5.71.0` mayor

#### Frontend

- `axios` `1.12.2 -> 1.13.6`
- `dompurify` `3.3.0 -> 3.3.3`
- `jspdf` `3.0.3 -> 4.2.1` mayor y sensible
- `react-router-dom` `6.26.2 -> 6.30.3` mínimo seguro (`7.13.1` latest mayor)
- `@typescript-eslint/*` `6.21.0 -> 8.57.1` mayor
- `eslint` `8.57.1 -> 10.1.0` mayor
- `vite` `7.1.12 -> 7.3.1` (`8.0.1` latest mayor)
- `vitest` `1.6.1 -> 4.1.0` mayor

#### Ecommerce

- `next` `15.2.3 -> 15.5.14+` mínimo seguro (`16.2.0` latest mayor)
- `axios` `1.8.4 -> 1.13.6`
- `lodash` `4.17.21 -> 4.17.23`
- `styled-components` `6.1.17 -> 6.3.12`
- `motion` `12.7.5 -> 12.38.0`

### Dependencias probablemente innecesarias o a revisar

Con evidencia local de uso nulo o muy dudoso:

- `backend`
  - `@nestjs/platform-express`: no hay imports en `backend/src`, pero sí agrega superficie vulnerable.

- `frontend`
  - `postcss-cli`: no aparece referenciado fuera de `package.json`.
  - `rollup-plugin-postcss`: no aparece referenciado fuera de `package.json`.
  - `@types/react-portal`: no aparece referenciado fuera de `package.json`.
  - `frontend/scripts/sync-shared-common.mjs`: parece redundante con aliases directos a `../src/common`.

- `ecommerce`
  - `motion`: no se observa uso en código; el código usa `framer-motion`.
  - Parte grande del stack Bonik demo/mocks sigue presente aunque el objetivo del proyecto ya es otro.

### Dependencias redundantes o inconsistentes

- `frontend` y `ecommerce` mantienen stacks de UI muy distintos y parcialmente superpuestos.
- `backend` declara `@nestjs/platform-express` aunque la app corre sobre Fastify.
- El repo tiene un `package-lock.json` raíz sin paquete raíz asociado.

### Riesgo de actualización

- Bajo
  - Patch/minor de Nest 11
  - `axios`, `dompurify`, `mercadopago`, `imapflow`, `mailparser`

- Medio
  - `prisma` dentro de misma major
  - `next` dentro de `15.x`
  - `react-router-dom` a `6.30.3`
  - `styled-components` patch/minor

- Alto
  - `nodemailer` mayor
  - `bullmq` mayor
  - `eslint`/`@typescript-eslint` major
  - `jspdf` mayor
  - `next` a `16.x`

## 7. Roadmap propuesto

### Acciones inmediatas

- Rotar y retirar secretos versionados.
- Corregir persistencia de tokens en navegador.
- Arreglar `env.schema.json` + `.env.example` + `make env-check`.
- Cerrar compatibilidad de despliegue local: Docker runtime sano, puertos libres o parametrizados, cifrado consistente.
- Lograr baseline: `backend lint`, `frontend lint`, `frontend test`, `ecommerce lint`.
- Actualizar dependencias con fix de seguridad de bajo riesgo.

### Corto plazo

- Reducir superficie del storefront a rutas reales.
- Eliminar o apagar fallbacks demo por defecto fuera de dev.
- Configurar lint real para `ecommerce`.
- Limpiar dependencias no usadas y artefactos huérfanos.
- Unificar documentación de despliegue real.

### Mediano plazo

- Refactor de auth admin/storefront hacia cookie-only.
- Revisión estructural de módulos grandes del admin (ventas/productos).
- Consolidación del shared code entre admin/storefront.
- Estrategia real de colas Redis, email y observabilidad.
- Definición de una estrategia formal de storefront resiliente:
  - modo dinámico con backend vivo,
  - modo degradado con snapshots controlados,
  - evaluación de modo estático/exportable para clientes o membresías sin backend activo.
- Estrategia futura de evolución funcional del storefront:
  - manejo de contenido estático mediante base de datos/CMS,
  - páginas, secciones y navbars configuradas dinámicamente desde backend,
  - configuración default para variante estática/exportable,
  - mejora progresiva del template, librerías e implementaciones base.

### Largo plazo

- SEO técnico profundo del storefront.
- SEO y posicionamiento de sitio y productos con datos estructurados.
- Optimización de performance y Core Web Vitals.
- CI/CD estable con gates de lint/test/build/audit.
- Paquetización más clara del monorepo o workspace real.

Nota de prioridad vigente:

- El SEO del storefront queda explícitamente relegado para una etapa posterior de mantenimiento.
- En la etapa actual solo se justifica tocar el storefront por seguridad, estabilidad, calidad base y limpieza de superficie funcional.

## 8. Plan de ejecución técnico

### Orden sugerido

1. Seguridad operativa y secretos.
2. Configuración/envs y reproducibilidad.
3. Compatibilidad de despliegue y Docker local.
4. Línea de calidad ejecutable.
5. Dependencias vulnerables de menor riesgo.
6. Limpieza estructural.
7. Storefront: recorte funcional y SEO técnico.

### Bloques lógicos de trabajo

#### Bloque A. Contención de riesgo inmediato

- Retirar secretos de `app.yaml` y ejemplos.
- Rotar credenciales comprometidas o predecibles.
- Desactivar persistencia de refresh/access tokens en browser.
- Forzar ausencia de defaults inseguros en prod/testing.

Dependencias: ninguna.

#### Bloque B. Onboarding y entorno

- Inventario único de variables.
- Armonizar `env.schema.json`, examples y código.
- Documentar servicios opcionales: Redis, SMTP/IMAP, Google, Mercado Pago.
- Simplificar ruta de arranque local.

Dependencias: Bloque A recomendado antes.

#### Bloque C. Compatibilidad de despliegue

- Alinear Dockerfiles con build args reales por aplicación.
- Confirmar URLs públicas vs internas del stack local.
- Verificar healthchecks y rutas efectivamente expuestas.
- Levantar stack Docker local y registrar bloqueos reales de runtime.
- Resolver desalineaciones entre secretos/configuración cifrada y la base local.

Dependencias: Bloque B.

#### Bloque D. Health baseline

- Corregir `backend lint`.
- Corregir `frontend lint`.
- Agregar `@testing-library/dom` y estabilizar `frontend test`.
- Configurar lint no interactivo para `ecommerce`.
- Mantener `ecommerce build` en verde sin ruido demo evitable.

Dependencias: Bloque B.

#### Bloque E. Dependencias

- Ola 1: patches/minors seguras.
- Ola 2: fixes de seguridad con impacto moderado.
- Ola 3: upgrades mayores con pruebas dirigidas.

Dependencias: Bloque D.

#### Bloque F. Limpieza de superficie pública

- Desactivar rutas demo del storefront.
- Revisar `app.yaml` vs Docker Compose.
- Eliminar código huérfano de raíz y dependencias sospechosas.

Dependencias: Bloques C y D.

#### Bloque G. SEO storefront

- Metadata por tenant.
- `robots.ts`, `sitemap.ts`, canonicals.
- Revisión headings, indexabilidad, enlazado interno, imágenes.
- Core Web Vitals y performance real.

Dependencias: Bloque E.

### Quick wins

- Eliminar `@nestjs/platform-express`.
- Corregir `react-router-dom` a `6.30.3`.
- Corregir `axios` en frontend/storefront.
- Agregar `@testing-library/dom` al admin.
- Crear config ESLint real del storefront.
- Parametrizar puertos del stack local o documentar puertos reservados.
- Alinear `CONFIG_ENCRYPTION_KEY` con el estado real de la base local.

### Tareas de alto impacto

- Migrar sesiones web a cookie-only.
- Rotación de secretos y rediseño de config sensible.
- Recorte de rutas Bonik demo.
- Definir la política de operación degradada/offline del storefront y la procedencia permitida de datos.
- Normalización completa de variables de entorno.

### Tareas de bajo riesgo ideales para arrancar

- Limpieza de `.DS_Store`.
- Borrar `package-lock.json` raíz si se confirma huérfano.
- Documentar estado real en estos archivos.
- Remover dependencias no usadas verificadas.

## 9. Propuesta de commits o bloques de trabajo

### Commit 1. `docs: capture current project status and execution roadmap`

- Objetivo: dejar memoria técnica base.
- Alcance: `PROJECT_STATUS.md`, `EXECUTION_ROADMAP.md`, ajustes mínimos de docs si se decide.
- Riesgo: bajo.
- Dependencias previas: ninguna.
- Validación: documentación consistente con repo actual.

### Commit 2. `security: remove versioned secrets and rotate insecure defaults`

- Objetivo: cortar exposición inmediata.
- Alcance: `app.yaml`, `.env.example`, validaciones de arranque para secretos.
- Riesgo: medio.
- Dependencias previas: commit 1.
- Validación: sin secretos funcionales en repo; arranque falla si faltan secretos en prod/testing.

### Commit 3. `auth: stop persisting browser tokens and align session strategy`

- Objetivo: reducir riesgo de robo de sesión.
- Alcance: admin/storefront auth storage, backend responses si aplica.
- Riesgo: alto.
- Dependencias previas: commit 2.
- Validación: login/logout/refresh funcionando en browser.

### Commit 4. `chore: reconcile environment schema and examples`

- Objetivo: volver reproducible el onboarding.
- Alcance: `env.schema.json`, `scripts/check-env.mjs`, `.env.example`, docs.
- Riesgo: medio.
- Dependencias previas: commit 2.
- Validación: `make env-check` pasa con examples completos.

### Commit 5. `test: restore local quality baseline across apps`

- Objetivo: que lint/test/build vuelvan a ser señales confiables.
- Alcance: backend/frontend/ecommerce tooling.
- Riesgo: medio.
- Dependencias previas: commit 4.
- Validación:
  - `backend npm run lint && npm test && npm run build`
  - `frontend npm run lint && npm test && npm run build`
  - `ecommerce npm run lint && npm run build`

### Commit 6. `deps: apply security patch wave 1`

- Objetivo: bajar vulnerabilidades sin cambios mayores.
- Alcance: patches/minors seguras en los tres módulos.
- Riesgo: medio.
- Dependencias previas: commit 5.
- Validación: audit baja y builds/tests siguen verdes.

### Commit 7. `storefront: remove demo routes and disable unsafe fallbacks`

- Objetivo: reducir deuda pública del storefront.
- Alcance: rutas Bonik demo, fallbacks mock, snapshots internos.
- Riesgo: medio.
- Dependencias previas: commits 4 y 5.
- Validación: storefront expone solo rutas objetivo y no muestra contenido demo por error de backend.

### Commit 8. `seo: establish storefront metadata, robots, sitemap and canonicals`

- Objetivo: crear una base SEO técnica real.
- Alcance: metadata centralizada, `robots.ts`, `sitemap.ts`, canonicals, títulos/descripciones.
- Riesgo: medio.
- Dependencias previas: commit 7.
- Validación: build del storefront, revisión manual de HTML generado y rutas indexables.

## 10. Checklist operativa

### Instalación

#### Backend

```bash
cd backend
npm install
npm run prisma:generate
npm run prisma:migrate
npm run start:dev
```

#### Frontend admin

```bash
cd frontend
npm install
npm run dev
```

#### Storefront

```bash
cd ecommerce
npm install
npm run dev
```

#### Stack Docker

```bash
make env-check
make dev-up
```

### Variables de entorno detectadas/esperadas

#### Backend claves principales

- Base: `NODE_ENV`, `PORT`, `DATABASE_URL`, `CLIENT_SLUG`
- Auth: `JWT_SECRET`, `COOKIE_SECRET`, `SESSION_TTL_HOURS`
- Storefront auth: `STOREFRONT_COOKIE_*`, `STOREFRONT_BASE_URL`
- Seguridad cliente: `RECAPTCHA_*`, `GOOGLE_*`
- Seed: `SEED_SUPERADMIN_*`, `DEFAULT_USER_TEMP_PASSWORD`, `STOREFRONT_GENERIC_CUSTOMER_PASSWORD`
- Pagos: `PAYMENTS_PROVIDER`, `MP_*`
- Config sensible: `CONFIG_ENCRYPTION_KEY`
- Email/Inbox: `EMAIL_*`, `INBOX_EMAIL_*`
- Colas opcionales no bien documentadas: `REDIS_URL`, `QUEUE_REDIS_URL`, `EMAIL_QUEUE_*`, `NOTIFS_QUEUE_*`
- Timeouts/limits no bien documentados: `RATE_LIMIT_*`, `REQUEST_TIMEOUT_MS`, `PRISMA_QUERY_TIMEOUT_MS`, `PARAMETRIC_IMPORT_TIMEOUT_MS`

#### Frontend claves principales

- `VITE_APP_NAME`
- `VITE_API_URL`
- `VITE_CLIENT_SLUG`
- `VITE_STATE_SIGNATURE_KEY`
- `VITE_RECAPTCHA_*`
- `VITE_PARAMETRIC_IMPORT_TIMEOUT_MS`

#### Storefront claves principales

- `CLIENT_SLUG`, `NEXT_PUBLIC_CLIENT_SLUG`
- `STOREFRONT_API_URL`, `NEXT_PUBLIC_STOREFRONT_API_URL`
- `NEXT_PUBLIC_SITE_URL`
- `NEXT_PUBLIC_STOREFRONT_HOME_PATH`
- `NEXT_PUBLIC_GOOGLE_BUTTON_ENABLED`
- `NEXT_PUBLIC_ENABLE_STOREFRONT_MOCKS`
- `NEXT_PUBLIC_ENABLE_STOREFRONT_FALLBACKS`
- `NEXT_PUBLIC_ENABLE_SNAPSHOT_FALLBACKS`
- `NEXT_PUBLIC_STOREFRONT_FAIL_FAST`
- `NEXT_PUBLIC_STORE_LOCALE`
- `NEXT_PUBLIC_MP_*`
- `SNAPSHOT_ACCESS_TOKEN`

### Comandos útiles actuales

- Root
  - `make env-check`
  - `make dev-up`
  - `make dev-down`
  - `make dev-logs`

- Backend
  - `npm run lint`
  - `npm test`
  - `npm run build`
  - `npm run prisma:generate`
  - `npm run prisma:migrate`

- Frontend
  - `npm run dev`
  - `npm run lint`
  - `npm test`
  - `npm run build`

- Ecommerce
  - `npm run dev`
  - `npm run lint`
  - `npm run build`

### Dependencias externas o servicios requeridos

- PostgreSQL: requerido para backend real.
- Redis: opcional hoy, pero necesario si se usan colas reales de email/notificaciones.
- Google OAuth/reCAPTCHA: opcional según feature flags.
- Mercado Pago: requerido para pagos reales.
- SMTP/IMAP: requerido para email productivo y bandeja.

### Puntos de falla al levantar local

- `make env-check` ya pasa.
- `backend` requiere DB funcional.
- Docker local puede fallar si el host ya ocupa `3000` o `5432`.
- El backend local puede arrancar con errores funcionales si `CONFIG_ENCRYPTION_KEY` no coincide con la configuración cifrada ya persistida.
- Verificación puntual ya realizada sobre la base local:
  - la tabla `SecureConfig` contiene 4 claves activas,
  - `email.provider.config`,
  - `inbox.email.config`,
  - `integrations.google`,
  - `payments.mercadopago`,
  - las 4 fallan al desencriptar con la clave local actual `local-dev-config-encryption-key-change-me`,
  - las 4 desencriptan correctamente con una clave histórica encontrada en el historial del repo,
  - por lo tanto el problema no es la base sino el drift entre la clave local placeholder y la clave usada para cifrar esos registros.
  - Validación runtime adicional ya realizada con override temporal no persistido:
  - `docker compose -f deploy/docker-compose.dev.yml -f /tmp/react-admin-dashboard.secure-config.override.yml up -d`,
  - backend `Up`,
  - frontend `Up`,
  - storefront `Up (healthy)`,
  - `GET http://127.0.0.1:4000/api/health` respondió `{"status":"ok","db":true,...}`,
  - `GET http://127.0.0.1:3000/api/health` respondió `{"status":"ok"}`,
  - `HEAD http://127.0.0.1:8080` respondió `200 OK`,
  - desaparecieron los errores de decrypt en backend cuando se usó la clave histórica compatible.
  - Se aplicó además una variante local temporal de opción A sin reintroducir la clave en archivos versionados:
    - `deploy/docker-compose.dev.yml` ahora admite `deploy/env/.env.backend.dev.local` como override local ignorado,
    - `backend/.env` local quedó alineado con la clave histórica compatible para desarrollo no containerizado.
- `frontend test` ya pasa.
- `frontend lint` ya pasa sin errores; quedan warnings no bloqueantes.
- `frontend build` ya pasa, con warnings de CSS (`@screen`) y chunks grandes.
- `ecommerce lint` ya es utilizable de forma no interactiva y ahora pasa sin warnings.
- `ecommerce build` ya pasa, pero sigue generando ruido por rutas demo y recuperación de snapshots/fallbacks durante SSG.

## 11. Comandos y verificaciones sugeridas

### Seguros de ejecutar directamente

```bash
make env-check
cd backend && npm run lint && npm test && npm run build
cd frontend && npm run lint && npm test && npm run build
cd ecommerce && npm run lint && npm run build
cd backend && npm audit --json --package-lock-only
cd frontend && npm audit --json --package-lock-only
cd ecommerce && npm audit --json --package-lock-only
cd backend && npm outdated --json
cd frontend && npm outdated --json
cd ecommerce && npm outdated --json
```

### Requieren revisión previa

```bash
cd backend && npx prisma migrate deploy
cd backend && npx prisma db seed
docker compose -f deploy/docker-compose.dev.yml up --build
docker compose -f deploy/docker-compose.dev.yml down --volumes --remove-orphans
```

### Verificaciones SEO storefront sugeridas

```bash
cd ecommerce && npm run build
rg -n "generateMetadata|metadata =|canonical|robots|sitemap" ecommerce/src/app ecommerce/src/lib
find ecommerce/src/app -maxdepth 3 -type f | sort
```

## 12. SEO storefront

### Diagnóstico actual

- Metadata global todavía usa branding Bonik genérico.
- No hay `robots.ts`.
- No hay `sitemap.ts`.
- No hay canonicals observables.
- Hay múltiples rutas demo/indexables heredadas del template.
- Algunas páginas del árbol `/(storefront)` siguen en estado placeholder/TODO.
- Existen fallbacks a contenido mock/template ante error de backend.
- `next build` ya pasa, pero el proceso sigue revelando ruido operativo y de superficie pública por rutas demo, dashboards vendor y snapshots de configuración cacheados.
- No existe todavía una política formal entre:
  - storefront dinámico conectado al backend,
  - storefront degradado con información limitada,
  - storefront estático/exportado para escenarios sin backend.

### Problemas encontrados

- Riesgo de indexación de páginas demo/no deseadas.
- Riesgo de contenido duplicado y señales de marca incorrectas.
- Riesgo de que Google indexe contenido fallback/mock.
- Falta de control explícito sobre rastreo e indexabilidad.
- Allowlist de imágenes demasiado abierta.

### Quick wins SEO

- Crear `robots.ts`.
- Crear `sitemap.ts`.
- Reemplazar metadata Bonik por metadata real/tenant-aware.
- Despublicar rutas demo.
- Forzar fallbacks mock a `false` fuera de desarrollo.

### Mejoras estructurales

- `generateMetadata` por tipo de página.
- Canonicals consistentes.
- Titles/descriptions basados en config real del storefront.
- Estructura de headings revisada.
- Schema markup para producto, breadcrumb y organización.
- Revisión de imágenes remotas y `next/image`.
- Política explícita de fuentes de datos:
  - datos vivos del backend,
  - snapshots firmados/controlados,
  - nunca mocks heredados sin trazabilidad en entornos no dev.

### Prioridad sugerida

Estado acordado para este foco:

- No prioritario en esta etapa.
- Queda diferido para próximos mantenimientos.
- Solo deberían abordarse tareas SEO si se solapan con correcciones de estabilidad o limpieza estructural del storefront.

Cuando se retome:

1. Corregir build.
2. Limitar rutas públicas.
3. Metadata/robots/sitemap/canonicals.
4. Datos estructurados.
5. Performance y Core Web Vitals.

## 13. Próximos pasos accionables

1. Rotar en infraestructura los secretos que fueron saneados en repo y confirmar que no quedan credenciales históricas activas.
2. Cerrar compatibilidad Docker runtime: puertos del host, acceso interno entre servicios y consistencia de `CONFIG_ENCRYPTION_KEY` con la base local.
3. Restaurar baseline de `backend lint`, `frontend lint`, `frontend test` y `ecommerce lint`.
4. Aplicar la primera ola de actualizaciones de seguridad.
5. Ejecutar la pasada dedicada de refactor/mantenibilidad.
6. Diseñar la estrategia de resiliencia del storefront:
   - qué mostrar cuando el backend falla,
   - de dónde puede salir esa información,
   - cómo exponer procedencia y vigencia.
7. Evaluar pros/contras de un modo estático/exportable de Next.js para clientes o planes sin backend activo.
8. Diseñar la estrategia futura de contenido administrable del storefront:
   - CMS basado en base de datos,
   - contenido estático gobernado desde backend,
   - relación entre contenido editable y snapshot/export estático.
9. Diseñar la estrategia futura de configurabilidad del storefront:
   - páginas, secciones y navbars configuradas dinámicamente,
   - defaults para modo estático/exportable,
   - límites entre configuración por tenant y piezas reutilizables del template.
10. Definir el set oficial de rutas públicas del storefront.
11. Despublicar rutas demo sin borrar código reutilizable.
12. Apagar fallbacks mock/inseguros por defecto.
13. Separar explícitamente código activo vs reutilizable en la documentación técnica.

## Bitácora de continuidad

### Objetivos acordados

- Mantener este documento como memoria técnica base del proyecto.
- Priorizar seguridad, mantenibilidad y evolución incremental.
- Tratar README como apoyo, no como fuente única de verdad.

### Etapas definidas

- Etapa 1: diagnóstico técnico, seguridad y salud general.
- Etapa 2: mejoras e implementaciones incrementales.
- Etapa 3: SEO técnico del storefront.

### Decisiones posteriores

- El SEO técnico del storefront no es prioridad de la etapa actual y queda relegado a mantenimientos posteriores.
- En el storefront, el foco inmediato pasa a ser limpieza funcional, seguridad, estabilidad y control de superficie pública.
- Se toma como referencia operativa vigente el spec actual de DigitalOcean App Platform provisto durante la sesión:
  - despliega `frontend` y `backend`,
  - no despliega todavía el `storefront`,
  - usa `CLIENT_SLUG=urucortinas` y `VITE_CLIENT_SLUG=urucortinas`,
  - enruta `/` al frontend y `/api` al backend con `preserve_path_prefix`,
  - mantiene PostgreSQL gestionado por DigitalOcean.
- Los valores locales de `DEFAULT_ALLOWED_ORIGINS` y `ALLOWED_ORIGINS` se consideran válidos como recordatorio operativo para desarrollo y Docker local; no deben interpretarse como whitelist suficiente para testing/producción, donde las URLs reales deben declararse explícitamente por entorno.
- Los valores precargados de login que existieron en la UI deben tratarse, si se usan, como conveniencia exclusiva de desarrollo local y nunca como configuración válida de testing o producción.
- La estrategia acordada para el storefront es conservadora:
  - no eliminar por ahora layouts, variants o piezas heredadas potencialmente reutilizables,
  - sí quitar esas rutas del acceso público efectivo,
  - sí apagar fallbacks inseguros o mock por defecto,
  - sí preservar el código reutilizable para una futura capa de alta customización.
- Se agrega un nuevo criterio de arquitectura para el storefront:
  - el sitio debe poder degradarse de forma controlada cuando falle el backend,
  - no debe mostrar información mock de origen incierto en entornos no dev,
  - debe quedar claro el origen de los datos mostrados,
  - se evaluará una estrategia de snapshots controlados y también la viabilidad de un modo estático/exportable.
- Se incorporan además líneas futuras de evolución funcional del storefront, sin prioridad inmediata de implementación:
  - manejo de contenido estático mediante BD/CMS:
    - todo contenido que hoy no proviene de base de datos pasa a ser candidato a configuración desde CMS,
    - el CMS no será externo: deberá relevarse, diseñarse e implementarse dentro del propio backend,
    - debería cubrir banners, textos, bloques, páginas informativas, contacto y metadata de base,
    - con trazabilidad clara de origen y publicación;
  - configurabilidad dinámica del template:
    - inicialmente las variantes surgirán del contenido ya existente del template, por ejemplo `footer-1`, `footer-2`, `market-1`, `market-2`,
    - el usuario podrá elegir entre esas variantes existentes,
    - los cambios serán globales para todos los tenants en esta etapa inicial,
    - con una configuración default clara para fallback o export estático;
  - versión estática/exportable del storefront:
    - pensada para clientes o planes sin backend activo permanente,
    - el sitio debería seguir siendo funcional al menos con página principal, página de productos/servicios y página de contacto,
    - el contenido estático podría provenir de `csv` o `json` con estructura esperada,
    - sin dinamismo: cualquier cambio requerirá modificar la fuente y recompilar,
    - la tecnología concreta todavía no está cerrada y queda recomendación pendiente;
  - mejora progresiva del template:
    - revisar librerías heredadas, componentes demo, patrones repetidos y deuda técnica de Bonik,
    - priorizar las mejoras que aumenten mantenibilidad, customización y calidad de build;
  - SEO y posicionamiento:
    - no es prioridad actual,
    - pero queda registrado como frente futuro tanto para contenido institucional como para categorías y productos,
    - incluyendo metadata real, canonicals, `robots`, `sitemap` y datos estructurados.

### Información ya definida para esas líneas futuras

- CMS / contenido administrable
  - alcance base: todo contenido no proveniente hoy de base de datos.
  - implementación prevista: dentro del backend actual.
  - operación esperada: administrable desde panel por un nuevo rol tipo `editor`.
  - no requiere versionado, historial ni flujo formal de draft/publish en la primera etapa.
- Configurabilidad del template
  - objetivo inicial: elegir variantes existentes, no composición libre total de páginas.
  - alcance inicial: global para todos los tenants.
  - visión futura: sitio altamente configurable, pero fuera del corto plazo por complejidad y prioridad real.
- Modo estático/exportable
  - mínimo funcional esperado sin backend:
    - home,
    - productos/servicios,
    - contacto;
  - fuente de datos aceptable:
    - `csv`,
    - `json`,
    - o snapshot equivalente estructurado;
  - característica explícita:
    - sin dinamismo,
    - cambios vía recompilación.
  - publicación esperada:
    - para servicios sin backend, idealmente por pipeline y en el peor caso manual,
    - para casos con backend, desde el panel.
- SEO futuro
  - foco esperado: tanto institucional como de categorías/productos.
  - proyección esperada: soporte SaaS con multi-dominio y SEO por tenant.

### Información todavía abierta o insuficiente

- CMS / backend
  - estructura concreta del CMS dentro del backend,
  - qué contenidos/campos entrarán primero en la implementación inicial.
- Rol editor
  - implementación detallada de permisos y menú cuando llegue esa etapa.
- Modo estático/exportable
  - recomendación técnica pendiente entre:
    - `next export`,
    - SSG con snapshots,
    - variante híbrida;
  - detalle operativo de regeneración/publicación por tipo de servicio.
- Configurabilidad del template
  - qué partes exactas entran primero:
    - solo homepage/nav/footer,
    - o también landings, categorías y páginas internas.
- SEO futuro
  - modelo técnico exacto de multi-dominio y metadatos por tenant,
  - ownership de generación de contenido SEO para productos/categorías.
- La evaluación de storefront resiliente/offline no se considera equivalente al problema operativo actual de `CONFIG_ENCRYPTION_KEY`:
  - `CONFIG_ENCRYPTION_KEY` afecta consistencia de configuración segura del backend,
  - la estrategia offline/degradada del storefront es una decisión de producto/arquitectura y de procedencia de datos.
- Orden acordado de ejecución:
  1. retirar/rotar secretos y corregir sesiones en browser,
  2. reconciliar envs y dejar `env-check` en verde,
  3. asegurar compatibilidad de despliegue y Docker local,
  4. restaurar baseline de `lint`/`test`/`build`,
  5. aplicar la primera ola de updates de seguridad,
  6. recién después trabajar sobre la superficie pública del storefront.
- El análisis de mejora/refactor del código sí forma parte del relevamiento inicial, pero en esta primera auditoría quedó tratado principalmente desde el ángulo de mantenibilidad, deuda estructural, limpieza, reutilización y capacidad de evolución.
- Aun así, no se considera cerrada una revisión profunda de refactor a nivel módulo/componente/servicio; esa pasada quedará como bloque específico posterior a la estabilización de la etapa 1.
- Criterio acordado:
  - primero estabilizar seguridad, sesiones, entornos, baseline y dependencias críticas,
  - luego ejecutar una revisión dedicada de refactor y mantenibilidad,
  - priorizando código limpio, entendible, reusable y mantenible por sobre micro-optimizaciones de eficiencia.
- Regla operativa adicional:
  - cada iteración relevante debe preservar el despliegue local por Docker como mecanismo mínimo de validación end-to-end,
  - porque ya hubo diferencias entre entorno local y despliegue productivo derivadas de resolución de módulos, accesos a paths o empaquetado.
- Cuando se aborde el storefront se seguirá este criterio:
  - definir un set oficial de rutas públicas,
  - despublicar sin borrar,
  - apagar fallbacks inseguros por defecto,
  - separar reusable vs activo,
  - no abrir un frente SEO dedicado en esta etapa.
- Antes de ejecutar esa fase del storefront, conviene producir un inventario de `ecommerce/src/app` en tres grupos:
  - rutas públicas reales a conservar,
  - rutas demo a despublicar ahora,
  - rutas reutilizables a preservar pero dejar fuera del flujo público.

### Historial de cambios de criterio

### Registro de avance

- 2026-03-20
  - Etapa 1 iniciada y parcialmente ejecutada.
  - Secretos versionados neutralizados en `app.yaml`, examples y manifests auxiliares; queda pendiente la rotación efectiva en proveedor.
  - Admin: `auth` salió de `redux-persist`; la sesión queda en memoria y ya no se rehidrata desde storage.
  - Storefront: se eliminó la persistencia en `localStorage`, el bootstrap de sesión pasa por `/auth/session` y el backend dejó de devolver `refreshToken` al cliente.
  - `make env-check` quedó en verde tras reconciliar `.env`, `.env.example` y `deploy/env/*`.
- Se deja asentado que:
    - `DEFAULT_ALLOWED_ORIGINS` y `ALLOWED_ORIGINS` con hosts locales cumplen una función válida en desarrollo/Docker local,
    - los prefill de credenciales en UI, si se reintroducen, deben quedar restringidos a desarrollo local y nunca persistir hacia testing/producción,
    - el deploy Docker local debe mantenerse operativo como gate mínimo en cada iteración importante,
    - no hace falta correr Docker por cada microcambio,
    - sí debe correrse al cierre de cada bloque relevante y al cierre de cualquier cambio en `package.json`, Dockerfiles, compose, envs, imports compartidos o runtime server/client.
  - Se incorpora como contexto operativo el spec actual de DigitalOcean compartido por el usuario, con estos impactos:
    - el deploy activo sigue siendo solo `frontend` + `backend`,
    - la variante actualmente desplegada es `urucortinas`,
    - el `storefront` sigue fuera del despliegue App Platform actual,
    - el spec compartido todavía contiene credenciales/valores sensibles históricos que deben tratarse como candidatos obligatorios a rotación.
  - Revisión inicial de Docker:
    - `docker compose -f deploy/docker-compose.dev.yml config` resuelve sin errores sintácticos,
    - `docker compose -f deploy/docker-compose.dev.yml build backend frontend storefront` quedó en verde,
    - se corrigieron build args y la URL pública del storefront en Docker dev,
    - los bloqueos de runtime por puertos ocupados quedaron descartados una vez liberado el host,
    - el runtime volvió a quedar sano usando un override temporal con la clave histórica compatible,
    - el problema real identificado fue la desalineación entre `CONFIG_ENCRYPTION_KEY` local y la configuración cifrada ya persistida en la base local.
  - Verificación directa sobre `SecureConfig`:
    - existen 4 registros en la tabla,
    - `email.provider.config`,
    - `inbox.email.config`,
    - `integrations.google`,
    - `payments.mercadopago`,
    - los 4 fallan al desencriptar con la clave local actual,
    - los 4 desencriptan con una clave histórica encontrada en `git`, lo que confirma drift de entorno y no corrupción de datos.
  - Validaciones corridas:
    - `backend npm run build`: verde.
    - `frontend npm run build`: verde.
  - `ecommerce npm run build`: verde, con ruido de rutas demo/vendor y snapshots de recuperación durante SSG.
  - Primera ola de seguridad ejecutada y verificada:
    - `backend` actualizó núcleo Nest/Fastify/Prisma y dependencias operativas (`mercadopago`, `imapflow`, `mailparser`, `class-validator`, `ioredis`);
    - `frontend` actualizó dependencias expuestas de uso real (`axios`, `dayjs`, `dompurify`, `formik`, `html-react-parser`, `lodash`, `react-router-dom`, `jspdf`);
    - `ecommerce` actualizó `next` a `15.5.14`, `eslint-config-next`, `axios`, `dayjs`, `formik` y `lodash`;
    - `ecommerce/next.config.ts` quedó endurecido con `outputFileTracingRoot` explícito y allowlist concreta para `images.remotePatterns`.
  - Estado verificado después de la primera ola:
    - `backend npm audit --package-lock-only --json`: 68 vulnerabilidades.
    - `frontend npm audit --package-lock-only --json`: 18 vulnerabilidades.
    - `ecommerce npm audit --package-lock-only --json`: 1 vulnerabilidad moderada.
    - `backend npm run lint`: verde.
    - `backend npm test`: verde.
    - `backend npm run build`: verde.
    - `frontend npm run lint`: verde, con 31 warnings no bloqueantes.
    - `frontend npm test`: verde (`19` tests).
    - `frontend npm run build`: verde.
    - `ecommerce npm run lint`: verde y sin warnings.
    - `ecommerce npm run build`: verde.
  - Limpieza adicional del storefront ejecutada en paralelo:
    - se eliminaron warnings de hooks, exports anónimos y componentes con `<img>` sin optimizar;
    - `Section4` dejó de ser `async client component`;
    - el ruido que sigue durante `next build` ya no es de ESLint, sino de prerender sobre rutas demo/heredadas y del modo degradado controlado cuando el backend no está disponible.
  - Correcciones aplicadas para recuperar baseline:
    - `frontend`
    - se corrigió el flujo de autocompletado de pricing en `PricingFields` para no marcar edición manual en cambios programáticos,
    - se corrigieron tests de `PricingFields`,
    - se eliminó el `return` temprano previo a hooks en `ParametricConfigurator`,
    - se corrigieron regex con `no-useless-escape`.
    - `ecommerce`
    - se eliminaron bloqueos de hooks condicionales en `ProductIntro` y `useMoneyFormatter`,
    - se corrigieron errores de `displayName`, `module`, `jsx-key` y textos con `react/no-unescaped-entities`,
    - el lint del storefront dejó de fallar y quedó usable como gate real.
  - Pendiente inmediato:
    - rotación real de secretos,
    - decidir si la base local seguirá usando una clave histórica compatible de forma temporal o si se regenerará/re-cifrará `SecureConfig`,
    - cleanup de warnings/build noise en `frontend`,
    - reducción del ruido de build del storefront y de la superficie demo aún expuesta,
    - segunda ola de updates de seguridad.
  - 2026-03-21
    - Segunda ola de seguridad ejecutada parcialmente:
      - `backend`
      - actualización de `nodemailer` a `8.0.3`,
      - eliminación de `@types/nodemailer`,
      - actualización de `vitest` a `4.1.0`,
      - `npm audit --package-lock-only --json` bajó a `46` vulnerabilidades (`38` altas, `7` moderadas, `1` baja).
      - `frontend`
      - actualización de `@typescript-eslint/*` a `8.57.1`,
      - actualización de `vite` a `7.3.1`,
      - actualización de `vitest` a `4.1.0`,
      - eliminación de `rollup-plugin-polyfill-node` y `rollup-plugin-postcss` no usados,
      - incorporación de `baseline-browser-mapping`,
      - `npm audit --package-lock-only --json` bajó a `8` vulnerabilidades (`3` altas, `4` moderadas, `1` baja).
    - Cleanup de build noise en `frontend`:
      - `_dialog.css` dejó de usar `@screen` y pasó a `@media`,
      - `vite.config.ts` incorporó `manualChunks` para aislar `charts`, `pdf`, `editor` y `calendar`,
      - el warning de browserslist quedó eliminado,
      - el ruido remanente del build ya se concentra en chunks todavía grandes (`vendor-pdf`, `vendor-charts`, bundle principal).
    - Subbloque adicional de calidad/seguridad:
      - `frontend`
      - limpieza de warnings triviales por imports duplicados, variables no usadas y catches sin binding en componentes/servicios del admin,
      - `frontend npm run lint` bajó de `78` a `55` warnings,
      - `vite.config.ts` se granularizó más para separar `react`, `state`, `forms`, `motion`, `icons`, `content`, `maps`, `utils` e `interactions`,
      - el bundle principal del admin bajó de `~942 kB` a `~491 kB`,
      - el warning de chunk size queda ahora concentrado solo en `vendor-pdf` y `vendor-charts`.
      - `backend`
      - se endureció el parseo de planillas `xlsx` en `ParametricPricingService`,
      - los imports paramétricos ahora limitan tamaño de archivo (`5 MB`), cantidad de hojas (`5`) y cantidad de filas (`5000`) antes de parsear,
      - esto reduce superficie de abuso en una librería que sigue pendiente de reemplazo/actualización segura.
    - Endurecimiento del storefront:
      - se creó `ecommerce/src/lib/public-route-policy.ts` con inventario explícito de rutas `official`, `demo` y `preserveOnly`,
      - las rutas demo ahora quedan despublicadas sin borrar código:
        - `/login` redirige a `/account/login`,
        - `/signup` redirige a `/account/register`,
        - `/checkout-alternative` redirige a `/checkout`,
        - `/market-1` redirige a `/`,
        - `/shop`, `/shops` y `/vendor/*` devuelven `404`,
      - se quitaron links internos hacia rutas demo desde navegación y pantallas auth,
      - `api/internal/snapshots` quedó fail-closed cuando falta `SNAPSHOT_ACCESS_TOKEN`,
      - `NEXT_PUBLIC_ENABLE_STOREFRONT_FALLBACKS`, `ENABLE_STOREFRONT_FALLBACKS` y `NEXT_PUBLIC_ENABLE_SNAPSHOT_FALLBACKS` quedan ahora en `false` por defecto en Docker dev y examples.
    - Docker local validado al cierre del bloque:
      - `docker compose -f deploy/docker-compose.dev.yml build storefront` y `up -d` quedaron en verde,
      - se corrigió `ecommerce/Dockerfile` para arrancar el standalone real con `node app/server.js`,
      - `docker ps -a` dejó `backend`, `frontend` y `storefront` `Up`, con `storefront` en `healthy`,
      - validación HTTP local del storefront:
        - `/` devuelve `200`,
        - `/api/health` devuelve `200`,
        - `/assets/images/logo.svg` devuelve `200`,
        - `/_next/static/chunks/webpack-61b5686a05ce43a6.js` devuelve `200`,
        - `/login` y `/signup` devuelven `307`,
        - `/checkout-alternative` devuelve `307` hacia `/checkout`,
        - `/market-1` devuelve `307` hacia `/`,
        - `/shop`, `/shops` y `/vendor/dashboard` devuelven `404`.
        - el problema reportado originalmente en navegador sobre `localhost:3000` no era ausencia de conexión a base de datos, sino empaquetado incorrecto del standalone:
        - `public` y `._next/static` se copiaban fuera del directorio real usado por `app/server.js`,
        - eso generaba `404` de chunks y assets aunque el servicio estuviera `healthy`,
        - el runtime Docker quedó corregido copiando esos artefactos junto al standalone real.
      - Ajuste posterior sobre navegación pública y sesión anónima:
        - `/shop` volvió a declararse como ruta pública oficial en `ecommerce/src/lib/public-route-policy.ts`,
        - `/product/search/[slug]` volvió a resolver hacia el catálogo público sin `404`,
        - `GET /api/storefront/auth/session` ahora devuelve `200 null` cuando no hay sesión válida, en lugar de `401`,
        - `StorefrontSessionProvider` y `auth/complete` quedaron adaptados para tratar la ausencia de sesión como estado normal en páginas públicas,
        - validación Docker/HTTP posterior:
          - `/shop` devuelve `200`,
          - `/product/search/cortinas` devuelve `307` hacia `/shop?query=cortinas`,
          - `/api/storefront/auth/session` anónimo devuelve `200` con body `null`.
    - Estado actual de baseline después de este bloque:
      - `backend npm run lint`: verde,
      - `backend npm test`: verde,
      - `backend npm run build`: verde,
      - `frontend npm run lint`: verde, con `55` warnings no bloqueantes,
      - `frontend npm test`: verde,
      - `frontend npm run build`: verde; el chunk principal ya quedó por debajo del umbral y el warning restante se concentra en `vendor-pdf` y `vendor-charts`,
      - `ecommerce npm run lint`: verde,
      - `ecommerce npm run build`: verde; el prerender bajó de `50` a `35` páginas estáticas al marcar rutas demo despublicadas como `force-dynamic`.
    - Docker local validado nuevamente para cierre del subbloque:
      - `docker compose -f deploy/docker-compose.dev.yml build backend frontend`: verde,
      - `docker compose -f deploy/docker-compose.dev.yml up -d backend frontend`: verde,
      - `/api/health` responde `200`,
      - `http://127.0.0.1:8080` responde `200`.
    - Subbloque adicional de warnings + seguridad remanente:
      - `frontend`
      - limpieza dirigida sobre `calendar/crm` y `sales`,
      - `frontend npm run lint` bajó de `55` a `21` warnings,
      - los warnings eliminados se concentraban en `Activities`, `ActivitiesDetail`, `ActivityAttachments`, `ActivityComments`, `crm/Calendar`, `crm/Calendar/EventDialog`, `OrderDetails`, `OrdersTableTools`, `ProductionOrders` y `ProductTable`,
      - `frontend npm run build` sigue verde; el warning de tamaño quedó únicamente en `vendor-charts` (`~545 kB`) y `vendor-pdf` (`~745 kB`).
      - decisión tomada sobre chunks pesados:
      - `vendor-pdf` se acepta como chunk pesado aislado porque ya es route-scoped y se carga por `import()` en `InvoiceContent`,
      - `vendor-charts` se acepta como chunk pesado aislado porque agrupa `apexcharts`/`react-apexcharts` y ya no contamina el bundle principal,
      - no se parte más por ahora; solo se reconsidera si aparece impacto real en UX o navegación.
      - `backend`
      - `EmailTemplateService` ahora rechaza `mj-include` y limita el tamaño de markup MJML antes de compilar/renderizar,
      - esto reduce exposición práctica del advisory de directory traversal en el uso real del proyecto,
      - `backend/package.json` incorporó overrides conservadores para transitive deps (`diff`, `js-yaml`, `brace-expansion`, `glob/minimatch`) y se eliminó `@nestjs/schematics` como dependencia directa innecesaria,
      - `npm audit` del backend bajó de `46` a `41` vulnerabilidades,
      - el remanente quedó concentrado principalmente en `mjml`, `xlsx`, `prisma/@prisma-config` y parte del toolchain Nest vía `@nestjs/cli`.
    - Docker local validado nuevamente al cierre del bloque:
      - `docker compose -f deploy/docker-compose.dev.yml build backend frontend`: verde,
      - `docker compose -f deploy/docker-compose.dev.yml up -d backend frontend`: verde,
      - `docker compose -f deploy/docker-compose.dev.yml ps backend frontend`: ambos `Up`,
      - `http://127.0.0.1:4000/api/health`: `200`,
      - `http://127.0.0.1:8080`: `200`.
    - Incidencia cerrada en admin frontend:
      - el build productivo servido en `localhost:8080` estaba rompiendo en runtime con `Cannot set properties of undefined (setting 'Children')`,
      - la causa observada terminó siendo una circularidad de chunks entre `vendor-react` y `vendor-charts` generada por el `manualChunks` agresivo del admin,
      - además se eliminó el uso runtime directo de `react-apexcharts` en el wrapper compartido:
        - `frontend/src/components/shared/Chart.tsx` ahora renderiza con `apexcharts` directo,
        - `ProductionOrdersStats` dejó de importar `react-apexcharts` directo,
      - para estabilizar el build productivo se simplificó `frontend/vite.config.ts` hasta remover por completo `manualChunks`,
      - se agregó `no-cache` al fallback SPA de nginx para `GET /` y rutas cliente resueltas a `index.html`, evitando que el navegador reutilice HTML viejo que referencia chunks inexistentes,
      - resultado esperado:
        - el build nuevo ya no genera `vendor-react-*`, `vendor-charts-*` ni `vendor-interactions-*`,
        - el error debería desaparecer al dejar de existir esa circularidad de inicialización y al invalidarse el HTML cacheado de la SPA.
    - Sesión del admin restaurada sin reintroducir persistencia insegura:
      - al endurecer `redux-persist` se dejó de guardar `auth` en browser, pero el admin no tenía bootstrap equivalente desde la cookie `access_token`,
      - eso provocaba que, tras un refresh, el estado Redux quedara vacío y `ProtectedRoute` redirigiera a `/sign-in` aunque la cookie HTTP-only siguiera siendo válida,
      - se agregó `GET /auth/session` en backend para reconstruir la sesión admin desde la cookie y devolver `null` cuando no exista sesión válida,
      - el frontend ahora ejecuta ese bootstrap al iniciar, repuebla `auth.session` y `auth.user`, y espera a que la verificación termine antes de resolver `ProtectedRoute` o `PublicRoute`,
      - se mantiene el criterio de seguridad: no vuelve la persistencia de `auth` a `localStorage`/`sessionStorage`; la continuidad de sesión depende de la cookie HTTP-only del backend.
    - Subbloque actual cerrado: seguridad residual de backend + warnings de frontend:
      - `frontend npm run lint`: verde, ya sin warnings,
      - el remanente del admin quedó resuelto en `ProductForm/ParametricConfigurator` y `ProductForm/VariantConfigurator`,
      - `frontend npm run build`: verde; persiste solo el warning de chunks grandes (`Chart` e `index`) como ruido de bundle no bloqueante,
      - `backend/package.json` agregó overrides para `ajv` y `effect`, eliminando del audit productivo el remanente moderado y el frente ligado a `prisma/@prisma-config`,
      - `backend/src/pricing/parametric-pricing.service.ts` ahora sanea recursivamente objetos parseados desde `xlsx` y rechaza claves peligrosas como `__proto__`, `prototype` y `constructor`,
      - `backend/src/email/email-template.service.ts` endureció aún más MJML: además de bloquear `mj-include`, ahora rechaza `mj-raw`, `<script>`, handlers inline y URLs `javascript:`,
      - `backend npm audit --omit=dev --json` queda reducido a `32` vulnerabilidades altas, todas concentradas en `mjml` y `xlsx`,
      - validación local final del bloque:
        - `backend npm run lint`: verde,
        - `backend npm run build`: verde,
        - `frontend npm run lint`: verde,
        - `frontend npm run build`: verde,
        - `docker compose -f deploy/docker-compose.dev.yml build backend frontend`: verde,
        - `docker compose -f deploy/docker-compose.dev.yml up -d backend frontend`: verde,
        - `docker compose -f deploy/docker-compose.dev.yml ps backend frontend`: ambos `Up`,
        - `http://127.0.0.1:4000/api/health`: `200`,
        - `http://127.0.0.1:8080`: `200`.
    - Cierre estructural del frente `xlsx` + `mjml`:
      - `backend`
      - se removió `xlsx` del backend y de la importación paramétrica; el flujo ahora acepta únicamente CSV y exporta CSV,
      - `backend/src/pricing/parametric-pricing.service.ts` pasó a parsear con `csv-parse/sync`, con límites explícitos de tamaño y filas, detección de delimitador y saneamiento de claves peligrosas,
      - `backend/src/pricing/pricing.controller.ts` expone export/import paramétrico como `text/csv`,
      - `backend/package.json` ya no depende de `xlsx` ni `mjml`,
      - se incorporó `@react-email/components` + `@react-email/render` como base nueva de emails,
      - `backend/src/email/templates/shared.tsx` ahora envuelve contenido con una shell React Email,
      - `backend/src/email/email-template.service.ts` ya no compila con `mjml` ni acepta markup legado; valida y renderiza HTML como único formato permitido,
      - `backend/src/email/templates/definitions.ts` fue reescrito a HTML y subió versiones para forzar un corte limpio,
      - la sincronización de `EmailTemplate` ahora elimina registros legacy/obsoletos y deja solo el set nuevo soportado,
      - validación del bloque:
        - `backend npm install`: verde,
        - `backend npm audit --omit=dev --json`: 0 vulnerabilidades,
        - `backend npm run lint`: verde,
        - `backend npm test`: verde,
        - `backend npm run build`: verde,
        - `frontend npm run lint`: verde,
        - `frontend npm test`: verde,
        - `frontend npm run build`: verde,
        - `docker compose -f deploy/docker-compose.dev.yml build backend frontend`: verde,
        - `docker compose -f deploy/docker-compose.dev.yml up -d --force-recreate backend frontend`: verde,
        - `docker compose -f deploy/docker-compose.dev.yml ps backend frontend`: ambos `Up`,
        - `http://127.0.0.1:4000/api/health`: `200`,
        - `http://127.0.0.1:8080`: `200`,
        - logs de backend: `EmailTemplateService` carga 12 templates sin errores de runtime,
        - verificación SQL local: `EmailTemplate` queda con `0` rows legacy y `12` templates activos (`versiones 2 y 6`).
  - Nuevo foco arquitectónico registrado para etapas posteriores:
    - definir cómo debe operar el storefront cuando no haya backend disponible,
    - establecer reglas claras sobre uso de snapshots,
    - evaluar si conviene soportar un modo estático/exportable para clientes o membresías con menor nivel de dinamismo.

- Se difiere el frente SEO para una fase posterior; no forma parte del bloque inmediato de ejecución.
- El diseño técnico de `CMS + configurabilidad + modo estático` queda relegado para el final del proyecto, después de cambios funcionales y nuevas implementaciones.
- Para el storefront no se hará una limpieza destructiva del template en esta etapa; se aplicará una estrategia mínima de despublicación y hardening.

### Features implementadas

- Pendiente de completar.

### Problemas detectados

- Documentados en la sección de hallazgos priorizados.

### Riesgos pendientes

- Rotación operativa de secretos ya expuestos históricamente.
- Cookie-only auth aún no completada al 100% en admin/storefront.
- Política definitiva para `CONFIG_ENCRYPTION_KEY` local y `SecureConfig`.
- Ruido de build todavía abierto en `frontend` por chunks grandes y durante el prerender del `ecommerce`.
- Storefront con superficie demo y estrategia de degradación aún por consolidar.
- La navegación de categorías sigue resolviendo hoy a `/shop?query=<slug>`; funcionalmente ya no rompe, pero conviene revisar más adelante si debe migrarse a un filtro explícito por categoría.
- `react-apexcharts` queda como dependencia heredada candidata a remoción completa si no reaparece uso real fuera de documentación legacy.

### Próximos focos de trabajo

- Seguridad operativa.
- Cierre de seguridad operativa remanente fuera de `xlsx`/`mjml`.
- Cleanup de build noise con foco en chunks grandes del admin y prerender/rutas demo del storefront.
- Actualización de dependencias.
- Pasada dedicada de refactor/mantenibilidad después de estabilizar la etapa 1.
- Definición controlada de superficie pública del storefront.
- Storefront real, limpieza funcional y estabilidad.
- Diseño futuro de CMS/configurabilidad/export estático del storefront, relegado para el final del proyecto.

- 2026-03-21
  - Retoma operativa del entorno local:
    - la base PostgreSQL local quedó disponible mediante el contenedor `postgres-local`,
    - el stack Docker dev volvió a quedar operativo con `backend`, `frontend` y `storefront` en `Up`,
    - el backend se validó nuevamente contra la base local y volvió a exponer `/api/health`,
    - el `storefront` dejó de depender de snapshots/config cacheada del template durante runtime normal.
  - Limpieza adicional del storefront enfocada en procedencia de datos:
    - `shop`, `product/[slug]` y la navegación dejaron de usar categorías/productos demo heredados como fallback implícito,
    - `ecommerce/src/utils/__api__/market-1.ts` fue recortado para consumir solo API real o devolver datasets vacíos controlados,
    - las colecciones demo de `market-1` ya no reinyectan productos/categorías/marcas mock desde datasets locales,
    - `ecommerce/src/lib/storefront-config.ts` ahora usa una configuración mínima del producto real cuando falla la API,
    - esa configuración mínima elimina enlaces Bonik como `/blog`, `/about`, `/faq` y desactiva `snapshotFallbackEnabled` por defecto.
  - Validación del bloque:
    - `ecommerce npm run lint`: verde,
    - `ecommerce npm run build`: verde,
    - `docker compose -f deploy/docker-compose.dev.yml up -d --force-recreate storefront`: verde,
    - logs de runtime ya muestran requests `200` a `/api/storefront/config`, `/api/storefront/categories` y `/api/storefront/products`,
    - el ruido residual de build del storefront baja de “snapshot/template cacheado” a “fallback mínimo controlado”.
  - Recorte adicional de superficie demo:
    - `ecommerce/src/app/shops/page.tsx` ya no usa snapshots ni mocks locales; si la API de shops falla, devuelve lista vacía controlada,
    - `ecommerce/src/app/(storefront)/mobile-category-nav/page.tsx` deja de cargar el árbol demo en el flujo normal y solo lo importa desde `page.demo.tsx` si los demo routes se habilitan explícitamente,
    - con esto, el código demo queda preservado para futura reutilización, pero separado del flujo público actual.
  - Validación de este subbloque:
    - `ecommerce npm run lint`: verde,
    - `ecommerce npm run build`: verde,
    - `docker compose -f deploy/docker-compose.dev.yml ps`: `storefront` vuelve a quedar `Up (healthy)`.
  - Ajuste funcional adicional en storefront:
    - el configurador paramétrico ya no registra warning técnico en consola cuando `/products/:id/parametric-config` responde `404`; ese caso ahora se trata como “producto sin configuración paramétrica disponible”,
    - el drawer de categorías disparado desde la navegación móvil ahora reutiliza `CategoryDropdown`, quedando alineado en apariencia y comportamiento con el menú de categorías del header.
  - Validación de este ajuste:
    - `ecommerce npm run lint`: verde,
    - `ecommerce npm run build`: verde,
    - `docker compose -f deploy/docker-compose.dev.yml up -d --force-recreate storefront`: verde.
  - Alineación del configurador paramétrico del storefront con admin/backend:
    - se relevó el contrato real expuesto por `backend/src/pricing/types.ts` y usado por el admin,
    - el storefront dejó de depender del shape legado `inputs.series/color/glass` con dimensiones en metros,
    - `ecommerce/src/types/storefront.ts` ahora tipa `ParametricConfigSnapshot`, `ParametricQuoteRequest` y `ParametricQuoteResult`,
    - `ecommerce/src/lib/api/storefront.ts` quedó alineado al contrato canónico de `/products/:id/parametric-config` y `/products/:id/parametric-quote`,
    - `ecommerce/src/components/products/ParametricConfigurator.tsx` ahora:
      - usa selectores reales (`families`, `series`, `materials`, `colors`, `glass`, `widths`, `heights`, `shutterMaterials`),
      - respeta compatibilidades reales (`glassBySeries`, `monoblockBySeries`, `sizeLimits`),
      - cotiza con payload canónico (`familyId`, `serie`, `material`, `color`, `vidrio`, `widthMm`, `heightMm`, `hasMosquitero`, `hasShutterMonoblock`, `shutterMaterial`),
      - elimina `monoblockColor` y breakdowns ficticios que no existen en el backend,
      - persiste en carrito la configuración canónica, no aliases legacy.
  - Validación de este subbloque:
    - `ecommerce npm run lint`: verde,
    - `ecommerce npm run build`: verde,
    - `docker compose -f deploy/docker-compose.dev.yml up -d storefront`: verde,
    - `curl http://127.0.0.1:3000/api/health`: `{"status":"ok"}`,
    - logs del contenedor `storefront`: arranque correcto y runtime listo en `:3000`.
  - Causa real y cierre del `404` paramétrico en storefront:
    - el `GET /api/storefront/products/2115/parametric-config` no fallaba por ausencia de matriz, sino porque el stack local estaba levantando con `CLIENT_SLUG=core`,
    - en `core`, `PARAMETRIC_PRODUCTS=false`, por lo que `ParametricPricingService.assertFeatureEnabled()` respondía `404`,
    - se alinearon los envs de desarrollo a `urucortinas` en:
      - `deploy/env/backend.dev.env`,
      - `deploy/env/frontend.dev.env`,
      - `deploy/env/storefront.dev.env`,
      - `backend/.env.example`,
      - `.env` locales de `backend`, `frontend` y `ecommerce`,
    - además, el backend storefront ahora resuelve internamente el `parametricProductId` base cuando el producto público es paramétrico pero no tiene filas propias en `dimensionPriceMatrix`.
  - Validación del cierre:
    - `backend npm run lint`: verde,
    - `backend npm run build`: verde,
    - `docker compose -f deploy/docker-compose.dev.yml build backend frontend storefront`: verde,
    - `docker compose -f deploy/docker-compose.dev.yml up -d backend frontend storefront`: verde,
    - logs de backend muestran `GET /api/storefront/products/2115/parametric-config` con `200`,
    - logs de backend muestran `POST /api/storefront/products/2115/parametric-quote` con `201`,
    - stack Docker queda con `backend`, `frontend` y `storefront` en `Up`, y `storefront` en `healthy`.
  - Ajuste adicional de UX móvil en storefront:
    - el menú general abierto desde la barra inferior móvil ya no usa un árbol textual plano,
    - ahora reutiliza la misma gramática visual del drawer de categorías: filas uniformes, chevron, jerarquía por niveles y navegación lateral consistente,
    - se implementó en `ecommerce/src/components/header/MobileNavigationMenu.tsx` y se integró en `ecommerce/src/components/header/Header.tsx`.
  - Validación:
    - `ecommerce npm run lint`: verde,
    - `ecommerce npm run build`: verde,
    - `docker compose -f deploy/docker-compose.dev.yml build storefront`: verde,
    - `docker compose -f deploy/docker-compose.dev.yml up -d storefront`: verde,
    - `curl http://127.0.0.1:3000/api/health`: `{"status":"ok"}`.
- Alineación de modos de desarrollo del backend:
  - `deploy/docker-compose.dev.yml` mantiene su propio camino de variables para Docker dev y sigue usando `deploy/env/backend.dev.env` + `deploy/env/.env.backend.dev.local`,
  - `backend/.env` se restauró para uso fuera de Docker apuntando a `127.0.0.1:5432`,
  - `backend/.env.example` quedó alineado con ese mismo criterio host-local,
  - `backend/README.md` documenta explícitamente la separación entre modo Docker y modo `npm run start:dev` / `npm start`,
  - validación observada:
    - Docker dev sigue funcionando con `backend`, `frontend` y `storefront` en `Up`,
    - conexión directa a PostgreSQL host-local validada con `psql postgresql://postgres:postgres@127.0.0.1:5432/react_admin_dashboard`,
    - el arranque de Nest fuera de Docker desde esta herramienta siguió devolviendo `Prisma P1001` pese a que la conectividad SQL directa respondió bien; debe tratarse como validación parcial y conviene confirmar manualmente en terminal interactiva del usuario antes de considerar cerrado ese punto al 100%.
  - Ajuste fino de categorías reales en storefront:
    - el menú general móvil quedó alineado al vocabulario y flujo real del storefront:
      - el nodo superior vuelve a mostrarse como `Products`,
      - queda desplegado por defecto,
      - conserva el estilo del drawer de categorías y permite navegar a categorías reales,
    - la navegación por categorías ya no deriva slugs reales hacia búsquedas de texto:
      - `CategoryDropdown` y `useStorefrontNavigation` construyen enlaces a `/shop?category=<slug>`,
      - `shop` deja de aplicar un segundo filtro cliente por categoría sobre resultados ya filtrados por backend,
      - `/product/search/[slug]` limpia slugs legacy con sufijo `-id` y redirige a `category=<slug-limpio>`, manteniendo `query=<texto>` para términos libres,
    - verificación contra datos y runtime:
      - la tabla `ProductCategory` confirma categorías reales como `Aberturas` y `20`, sin colisiones de slug limpio en el dataset actual,
      - el dataset actual tampoco tiene colisiones de slug limpio para productos físicos publicados,
      - `ecommerce npm run lint`: verde,
      - `ecommerce npm run build`: verde,
      - `backend npm run lint`: verde,
      - `backend npm run build`: verde,
      - `docker compose -f deploy/docker-compose.dev.yml build storefront`: verde,
      - `docker compose -f deploy/docker-compose.dev.yml build backend storefront`: verde,
      - `docker compose -f deploy/docker-compose.dev.yml up -d --force-recreate backend storefront`: verde,
      - `npm run build` del storefront ya muestra `slug "urucortinas"` y no `core`,
      - `GET /api/storefront/categories` devuelve slugs limpios como `aberturas`, `cortinas`, `paneles-tradicionales`,
      - `GET /api/storefront/products/cortinas-roller` devuelve `slug: "cortinas-roller"`,
      - `curl -I http://127.0.0.1:3000/shop?category=aberturas`: `200`,
      - `curl -I http://127.0.0.1:3000/product/cortinas-roller`: `200`.
  - Consistencia adicional entre drawers móviles:
    - el drawer móvil de categorías pasa a comportamiento acordeón:
      - si una categoría tiene hijos, el click despliega el subnivel y no navega directamente,
      - la navegación directa queda para categorías hoja,
    - el drawer móvil de categorías adopta la misma jerarquía visual del menú general móvil:
      - más aire entre opciones raíz,
      - tipografía diferenciada por nivel,
      - chevrons y despliegue por niveles consistentes,
    - el click principal ahora cae sobre toda la fila del ítem, no solo sobre el chevron,
    - se aplicó además un refactor de reutilización:
      - se extrajo `ecommerce/src/components/mobile-navigation/AccordionMenu.tsx`,
      - tanto el menú general móvil como el drawer móvil de categorías consumen ahora el mismo renderer de árbol acordeón,
      - esto reduce duplicación de lógica de expansión, jerarquía visual y comportamiento de navegación,
    - desktop mantiene el menú de categorías basado en hover; el cambio queda acotado al flujo móvil.
  - Refinamiento visual/táctil del árbol móvil:
    - `AccordionMenu` deja de depender de `components/categories/styles.tsx` y pasa a usar `ecommerce/src/components/mobile-navigation/styles.tsx`,
    - con eso el árbol móvil queda desacoplado del estilo desktop/hover y se corrige la desalineación introducida entre iconos izquierdos y texto,
    - se añadió estado activo y rama activa en función de `pathname + query`, incluyendo `shop?category=...`,
    - se reforzaron los estados de interacción táctil:
      - `hover` y `press` más visibles,
      - feedback de toque con fondo, borde interno y microescala,
    - se endureció la apertura inicial del árbol para mantener expandida la rama activa y los nodos raíz con hijos en móvil.
  - Flujo Google auth + navegación/fallbacks:
    - el warning de consola `Unable to detach Google auth popup listener` se analizó como un problema de cleanup sobre un popup cross-origin, no como una falla funcional del login,
    - de todos modos se corrigió el flujo en `ecommerce/src/state/session-context.tsx`:
      - se eliminó el intento de adjuntar/desadjuntar listeners DOM sobre la ventana de Google,
      - la detección de cierre prematuro del popup pasa a resolverse vía `popup.closed` durante el polling de sesión,
      - con esto se evita el `SecurityError` sin relajar validaciones del flujo OAuth,
    - se introdujo un mapper compartido en `ecommerce/src/lib/storefront/menu-nodes.ts`:
      - centraliza `StorefrontNavigationNode`,
      - centraliza `AccordionMenuNode`,
      - centraliza el mapping de navegación general y categorías hacia el árbol móvil compartido,
      - elimina duplicación entre `useStorefrontNavigation.ts`, `MobileNavigationMenu.tsx` y `CategoryDropdown.tsx`,
    - se recortó superficie residual de fallback/snapshots:
      - `api/public/snapshots` y `api/internal/snapshots` ahora responden `404` cuando la capa de snapshot fallbacks está desactivada,
      - esto evita exponer recovery data en runtime cuando ese modo no forma parte del contrato activo.
  - Verificación adicional de flags/slug en el admin:
    - el entorno efectivo del admin en `docker compose` quedó revisado,
    - backend ya venía corriendo con `CLIENT_SLUG=urucortinas`,
    - frontend tenía una deriva importante:
      - en runtime exponía `VITE_CLIENT_SLUG=urucortinas`,
      - pero en `build.args` seguía resolviendo `VITE_CLIENT_SLUG=core`,
      - al ser Vite, eso implicaba compilar el admin con la variante equivocada aunque el contenedor arrancara con el env correcto,
    - impacto observable:
      - el menú `Aberturas` no aparecía aunque `urucortinas` y `PARAMETRIC_PRODUCTS=true` sí estaban definidos en la configuración del cliente,
    - corrección aplicada:
      - `deploy/docker-compose.dev.yml` ahora centraliza el stack Docker local en una sola variable `CLIENT_SLUG`,
      - desde esa única fuente deriva:
        - `CLIENT_SLUG` para backend,
        - `VITE_CLIENT_SLUG` para frontend,
        - `CLIENT_SLUG` + `NEXT_PUBLIC_CLIENT_SLUG` para storefront,
      - `frontend` y `storefront` quedaron reconstruidos y recreados,
    - validación:
      - `docker compose ... config | rg 'CLIENT_SLUG|VITE_CLIENT_SLUG'` ya devuelve `urucortinas` en build args y environment,
      - `curl -I http://127.0.0.1:8080`: `200`.
  - Recorte adicional de superficie demo del storefront:
    - se removió una filtración demo visible en el flujo real del detalle de producto:
      - `ecommerce/src/components/products/ProductIntro.tsx` ya no enlaza a `/shops/scarlett-beauty`,
      - en su lugar, si hay marca disponible, muestra una línea neutra basada en `brand`,
    - se alinearon los flujos de reautenticación del customer dashboard al login oficial del storefront:
      - `ecommerce/src/app/(layout-3)/(customer-dashboard)/account/orders/OrdersClient.tsx`
      - `ecommerce/src/app/(layout-3)/(customer-dashboard)/account/orders/[uuid]/OrderDetailClient.tsx`
      - ambos dejaron de apuntar a `/login` legacy y pasan a `/account/login`,
    - el loader de snapshots también quedó más estricto:
      - `ecommerce/src/lib/snapshots/loaders.ts` retorna `null` inmediatamente si los snapshot fallbacks están desactivados, sin intentar pedir `/api/public/snapshots`.
  - Validación:
    - `ecommerce npm run lint`: verde,
    - `ecommerce npm run build`: verde,
    - `docker compose -f deploy/docker-compose.dev.yml build storefront`: verde,
    - `docker compose -f deploy/docker-compose.dev.yml up -d --force-recreate storefront`: verde,
    - `curl http://127.0.0.1:3000/api/health`: `{"status":"ok"}`,
    - la comprobación puntual de `/api/public/snapshots` y `/api/internal/snapshots` quedó pendiente de revalidación manual en terminal/navegador tras el recreate, porque desde esta herramienta los `curl` a esas rutas devolvieron una señal local inconsistente pese a que el healthcheck quedó en verde.
  - Análisis de pendientes de navegación/UX para tratar ahora o diferir:
    - `Unificar shape de datos de navegación/categorías en un mapper compartido`
      - Estado actual:
        - resuelto en este bloque con `ecommerce/src/lib/storefront/menu-nodes.ts`,
        - `useStorefrontNavigation.ts` pasa a consumir `StorefrontNavigationNode` desde ese módulo,
        - `MobileNavigationMenu.tsx` y `CategoryDropdown.tsx` comparten ahora el mismo mapping hacia `AccordionMenuNode`,
        - `Navbar.tsx` y `Navbar2.tsx` siguen usando renderers propios, pero sobre el mismo tipo compartido,
      - Riesgo actual:
        - bajo respecto al estado previo; la duplicación más evidente ya quedó removida del flujo móvil,
      - Prioridad:
        - `cerrado`,
      - Recomendación:
        - mantener futuras extensiones de navegación/categorías dentro de `menu-nodes.ts` para no reintroducir mapeos paralelos.
    - `Separar estilos móviles del árbol jerárquico en un bloque propio`
      - Estado actual:
        - resuelto en este bloque con `ecommerce/src/components/mobile-navigation/styles.tsx`,
        - `components/categories/styles.tsx` vuelve a quedar reservado para el comportamiento desktop/hover,
      - Riesgo actual:
        - baja respecto al estado previo; ya no hay acople directo de estilos entre mobile accordion y desktop hover,
      - Prioridad:
        - `cerrado`,
      - Recomendación:
        - mantener cualquier ajuste fino futuro del árbol móvil dentro de `mobile-navigation/styles.tsx`.
    - `Revisar si desktop y mobile pueden compartir parte del modelado`
      - Estado actual:
        - desktop y mobile ya comparten parcialmente la fuente de datos (`useStorefrontNavigation`),
        - pero `Navbar.tsx` y `Navbar2.tsx` mantienen renderers propios y parcialmente duplicados,
      - Riesgo actual:
        - medio; la deuda existe, pero no justifica forzar una unificación apresurada de interacción,
      - Prioridad:
        - `mediano plazo`,
      - Recomendación:
        - compartir modelado y utilidades, no necesariamente renderer;
        - evitar intentar unificar interacción desktop hover con móvil acordeón en el mismo componente.
    - `Estado activo del ítem/subítem actual`
      - Impacto:
        - alto en UX,
        - bajo riesgo técnico,
      - Prioridad:
        - `cerrado`,
      - Recomendación:
        - mantener el resaltado actual en base a `pathname + query` y revisar después solo si aparecen nuevos patrones de ruta.
    - `CTA secundaria "ver todo" en categorías con hijos`
      - Impacto:
        - medio-alto,
        - depende de decisión UX/copy,
      - Prioridad:
        - `pendiente a futuro`,
      - Recomendación:
        - agregar una acción explícita de “Ver todo” para categorías con hijos, separada del click principal de expandir.
    - `Feedback visual de toque más marcado`
      - Impacto:
        - medio,
        - bajo riesgo,
      - Prioridad:
        - `cerrado`,
      - Recomendación:
        - conservar la mejora de `hover/active/press` en la capa móvil desacoplada y retocar solo si en QA visual sigue habiendo inconsistencias.
- 2026-03-21
  - Nuevo bloque ejecutado sobre storefront activo:
    - se implementó `/contact` como página pública real en:
      - `ecommerce/src/app/(storefront)/contact/page.tsx`
      - `ecommerce/src/app/(storefront)/contact/ContactPageClient.tsx`
    - la página consume `storefrontConfig` y, cuando faltan datos, usa dummy controlado en vez de template heredado o mocks inciertos,
    - se agregaron componentes reutilizables para contenido estático público:
      - `ecommerce/src/components/i18n/TranslatedText.tsx`
      - `ecommerce/src/components/storefront/InfoPage.tsx`
    - `/categories` y `/account/forgot-password` quedaron alineadas a ese patrón y dejaron de exponer copy placeholder sin traducción,
    - `/products` y `/search` quedaron definitivamente recortadas al flujo oficial vía redirect a `/shop`.
  - Revisión exhaustiva de textos estáticos visibles:
    - se auditaron y corrigieron textos activos del storefront en header, topbar, footer, cart, related products, panel de destacados y páginas informativas,
    - quedaron cubiertas en `es/en` las cadenas activas del flujo público revisado, incluyendo ejemplos explícitos del usuario:
      - `Brand:`
      - `Store brand`
      - `Rated:`
      - `In stock`
      - `Add to Cart`
      - `Description`
      - `Specifications`
    - además se tradujeron y/o reemplazaron textos activos adicionales:
      - topbar (`FAQ`, `Need Help?`, `Select currency`),
      - cart y checkout summary,
      - `Related Products`,
      - mensajes de error reutilizables (`ErrorState`),
      - featured products del home,
      - copy informativo de `contact`.
  - Limpieza de residuos activos de template/fallback:
    - `topbar` deja de mostrar `support@ui-lib.com` y `+88012 3456 7894` cuando no hay datos reales,
    - `footer` deja de depender del copy/link social de `UILib`,
    - el panel de productos destacados deja de enlazar a `/products?sort=newest` y pasa a `/shop?sort=newest`,
    - se centralizó metadata pública del storefront en `ecommerce/src/lib/page-metadata.ts`,
    - se removió metadata activa residual de `Bonik/UI-LIB/Storefront` en:
      - `ecommerce/src/app/layout.tsx`
      - `ecommerce/src/app/(storefront)/page.tsx`
      - `ecommerce/src/app/(storefront)/categories/page.tsx`
      - `ecommerce/src/app/(storefront)/contact/page.tsx`
      - `ecommerce/src/app/(storefront)/account/forgot-password/page.tsx`
      - `ecommerce/src/app/(storefront)/account/register/page.tsx`
      - `ecommerce/src/app/(storefront)/(checkout)/cart/page.tsx`
      - `ecommerce/src/app/(storefront)/(checkout)/checkout/page.tsx`
      - `ecommerce/src/app/(storefront)/(checkout)/review/page.tsx`
      - `ecommerce/src/app/(storefront)/(checkout)/payment/page.tsx`
      - `ecommerce/src/app/(storefront)/market-1/page.tsx`
  - Validación cerrada:
    - `ecommerce npm run lint`: verde,
    - `ecommerce npm run build`: verde,
    - `docker compose -f deploy/docker-compose.dev.yml up -d --build --force-recreate storefront`: verde,
    - `docker compose -f deploy/docker-compose.dev.yml ps backend storefront`: stack arriba,
    - runtime verificado en contenedor:
      - `/contact` sirve metadata limpia: `Contacto · UruCortinas`,
      - `/cart` sirve metadata limpia: `Carrito · UruCortinas`,
      - `/products` redirige `307` a `/shop`.
  - Riesgos/pendientes que quedan explícitos:
    - durante `next build` siguen apareciendo rutas demo/heredadas en el árbol compilado; no rompen el build pero siguen marcando superficie pública a terminar de recortar,
    - cuando el build del storefront no logra llegar al backend en tiempo de build, sigue cayendo al fallback mínimo para algunas páginas estáticas,
    - ese fallback ya no contiene `UI-LIB/Bonik/Storefront` en metadata activa, pero todavía conserva copy/layout data heredada en módulos internos del home y otras estructuras no oficiales.
- 2026-03-21
  - Bloque adicional ejecutado sobre storefront activo:
    - se reforzó el uso de `companyProfile` del backend/admin en `Logo`, `Topbar`, `Footer1` y `/contact`,
    - el storefront ya toma logo, nombre comercial y datos de contacto desde `storefront/config`, con fallback controlado solo cuando faltan datos reales.
  - Idioma e i18n:
    - se consolidó la prioridad efectiva:
      - preferencia del usuario autenticado desde base de datos,
      - preferencia persistida en navegador,
      - idioma del navegador,
      - fallback final a `es`,
    - la detección de navegador ahora usa `navigator.languages`,
    - cuando el usuario autenticado cambia idioma en el storefront, esa preferencia se persiste también en backend vía `account/profile`.
  - Home del storefront:
    - se corrigió la causa más probable de la intermitencia del home:
      - el menú de categorías cargaba por fetch cliente,
      - mientras que categorías destacadas, productos destacados y novedades seguían dependiendo de fetches server-side que ante error devolvían arrays vacíos,
    - se movieron a flujo cliente con cache/control de refresh:
      - `page-sections/market-1/Section10.tsx`,
      - `page-sections/market-1/Section2.tsx`,
      - `page-sections/market-1/Section5.tsx`,
      - `components/category/CategoryProductShelf.tsx`,
      - `hooks/useStorefrontCategories.ts`.
  - Búsqueda:
    - `SearchInputWithCategory` quedó reimplementado para:
      - buscar productos y categorías en el mismo campo,
      - respetar la categoría seleccionada como scope,
      - navegar siempre al catálogo aunque no haya coincidencias exactas,
      - resolver coincidencias exactas de categoría hacia `/shop?category=<slug>`,
      - mostrar feedback útil cuando no hay match exacto,
    - `shop` y `SaleProducts` muestran ahora feedback contextual para búsquedas vacías o sin resultados.
  - Traducciones:
    - se amplió la revisión de textos estáticos visibles en flujo público activo:
      - búsqueda,
      - feedback de resultados vacíos,
      - header móvil,
      - paneles del home,
      - categorías y catálogo.
  - Observación abierta:
    - el build del storefront sigue pudiendo loguear `Using minimal fallback configuration for slug "urucortinas"` durante `next build` si el backend/config responde `500/503` en prerender;
    - el runtime quedó sano y el impacto sobre la home baja porque las secciones críticas ya no dependen de ese render server-side inicial,
    - pero la estabilización final del config/fallback de build sigue siendo un pendiente técnico posterior.
  - Validación:
    - `ecommerce npm run lint`: verde,
    - `ecommerce npm run build`: verde,
    - `docker compose -f deploy/docker-compose.dev.yml build storefront`: verde,
    - `docker compose -f deploy/docker-compose.dev.yml up -d --force-recreate storefront`: verde,
    - `curl http://127.0.0.1:3000/api/health`: `{"status":"ok"}`.
  - Recorte adicional y consolidación de fallback sobre storefront:
    - se eliminó del home activo el hero demo heredado de `market-1` y el carrusel de marcas demo que seguía apareciendo en el artefacto servido;
    - `ecommerce/src/data/market1Defaults.ts` dejó de contener `apple-watch-0`, textos genéricos y un `href` hardcodeado a `http://localhost:3000/account/register`;
    - la sección de servicios del home quedó con contenido mínimo controlado y rutas relativas reales (`/shop`, `/contact`);
    - `ecommerce/src/lib/public-route-policy.ts` ahora incluye `/contact` dentro del set oficial de rutas públicas;
    - el fallback mínimo de `ecommerce/src/lib/storefront-config.ts` mantiene branding derivado del tenant real y ya no cae en logo demo cuando falta configuración remota.
  - Validación de cierre del bloque:
    - `cd ecommerce && npm run lint`: verde;
    - `docker compose -f deploy/docker-compose.dev.yml build --no-cache storefront`: verde;
    - `docker compose -f deploy/docker-compose.dev.yml up -d --force-recreate storefront`: verde;
    - inspección del HTML servido del home desde el contenedor:
      - ya no aparecen `/assets/images/brands/alibaba.png`, `levis.png`, `lotto.png`, `raymond.png`, `samsung.png`,
      - el hero servido ahora responde con el contenido real `Explora el catálogo activo de UruCortinas.`;
    - verificación de rutas demo preservadas pero fuera de flujo público:
      - `/login` redirige a `/account/login`,
      - `/signup` redirige a `/account/register`,
      - `/market-1` redirige a `/`,
      - `/checkout-alternative` redirige a `/checkout`,
      - `/shops` devuelve `404`,
      - `/mobile-category-nav` devuelve `404`.
  - Observación de arquitectura:
    - `next build` sigue listando varias rutas demo/heredadas porque el código se preserva para reutilización futura;
    - el recorte aplicado en esta fase es de superficie pública y fallback, no de borrado destructivo del template.
  - Ajuste adicional sobre configuración pública serializada:
    - la normalización de navegación dejó de ser específica de `urucortinas` y pasó a ser global para `core` y todas las variantes declaradas en `ecommerce/src/clients/*/config.ts`;
    - se agregó `ecommerce/src/lib/storefront/public-navigation.ts` como base pública compartida:
      - `Inicio`, `Tienda`, `Categorías`, `Contacto`,
      - secundarios `Account` y `Order tracking`,
      - footer reducido al set oficial,
      - `socials: []`,
      - help links controlados (`FAQ`, `Need Help?`);
    - `ecommerce/src/clients/core/config.ts`, `ecommerce/src/clients/retail/config.ts` y `ecommerce/src/clients/urucortinas/config.ts` consumen ahora la misma base pública, y `urucortinas` conserva solo sus overrides reales de branding/SEO/announcement;
    - `ecommerce/src/lib/storefront-config.ts` ahora reemplaza colecciones de navegación por completo cuando el backend o la variante proveen arrays, en vez de mezclarlas por índice con defaults heredados;
    - `ecommerce/src/app/(storefront)/layout.tsx` dejó de serializar `layouts` y `policies` completos hacia el cliente, porque esa información no se usa en la UI activa y estaba filtrando rutas/template demo en el HTML renderizado.
  - Reincorporación controlada del carousel del home:
    - `ecommerce/src/page-sections/market-1/Section1.tsx` volvió a usar `Carousel`, pero ya no con assets/demo data del template;
    - `ecommerce/src/data/market1Defaults.ts` ahora define slides parametrizadas y copy real de storefront en lugar de `apple-watch`, textos genéricos o links absolutos a `localhost`;
    - `ecommerce/src/components/carousel-cards/CarouselCard1.tsx` quedó adaptado para:
      - CTA navegable,
      - copy traducible,
      - imagen opcional tomada del `companyProfile.logo`,
      - fallback visual con branding real cuando no hay logo cargado.
  - Recorte adicional de superficie demo preservada:
    - `shops`, `vendor` y `checkout-demo` ya no solo responden fuera del flujo público; además dejaron de cargar layouts y secciones demo pesadas por import estático cuando `ENABLE_DEMO_ROUTES=false`;
    - `ecommerce/src/app/shops/layout.tsx` ahora corta antes de montar `layout-3` y solo importa ese layout si las demo routes están habilitadas;
    - `ecommerce/src/app/(layout-3)/vendor/layout.tsx` y `ecommerce/src/app/(layout-3)/checkout-demo/layout.tsx` pasaron al mismo patrón: guard clause + import diferido;
    - las páginas demo de `checkout-demo` se separaron en `page.demo.tsx`, manteniendo el código reutilizable pero fuera del entrypoint activo;
    - varias páginas de `vendor/*` pasaron a cargar sus secciones internas de forma diferida, para que el flujo normal del storefront no arrastre módulos demo innecesarios.
  - Validación adicional:
    - `cd ecommerce && npm run lint`: verde;
    - `cd ecommerce && npm run build`: verde;
    - `docker compose -f deploy/docker-compose.dev.yml build storefront`: verde;
    - `docker compose -f deploy/docker-compose.dev.yml up -d --force-recreate storefront`: verde;
    - inspección del HTML renderizado de `/contact` desde el contenedor:
      - ya no aparecen `/about`, `/faq`, `/policies/*`, `nav-services` ni `/services/measurement`,
      - sí permanecen solo enlaces oficiales como `/shop`, `/categories`, `/contact` y `/account/orders`.
    - `docker compose -f deploy/docker-compose.dev.yml ps storefront`: contenedor `healthy` luego de reconstrucción del artefacto con la base pública global.
  - Observación vigente:
    - `next build` sigue listando rutas preservadas como `shops`, `vendor/*` y `checkout-demo/*` porque el código continúa en el repositorio para reutilización futura;
    - el recorte aplicado en esta etapa evita su exposición y su carga innecesaria en runtime público, pero no borra esas rutas del árbol de compilación.
- 2026-03-21
  - Explicación funcional asentada sobre `storefront-config.ts`:
    - el problema original del merge era que `lodash.merge` mezcla arrays por índice;
    - si el fallback/base traía, por ejemplo, 4 items en `navigation.primary` y la variante activa solo definía 2, el merge podía dejar vivos los 2 items heredados restantes;
    - `applyNavigationArrayOverrides()` corta ese comportamiento:
      - toma el resultado base del merge para objetos simples,
      - pero cuando encuentra colecciones como `primary`, `secondary`, `footer`, `socials` o `helpLinks`, las reemplaza completas,
      - primero respeta arrays reales venidos de `config` backend,
      - luego aplica arrays reales venidos de `configOverrides` del cliente,
      - con eso, una variante que define su navegación pública deja de “mezclarse” con restos del fallback.
  - Nuevo recorte sobre superficie demo preservada:
    - `shops`, `vendor` y `checkout-demo` quedaron reforzados con guard clauses previas al import de sus layouts/secciones;
    - aunque esas rutas sigan existiendo en el árbol de compilación por preservación del template, ya no cargan módulos demo pesados cuando `ENABLE_DEMO_ROUTES=false`;
    - `checkout-demo/cart-demo`, `checkout-demo/checkout-demo` y `checkout-demo/payment` se separaron en `page.demo.tsx`;
    - `vendor/*` dejó de depender solo del `layout` para cortar el flujo y ahora también protege sus páginas antes de cargar secciones internas.
  - Nuevo bloque general del roadmap ya retomado:
    - se revisó el remanente de `npm audit` del admin,
    - `frontend` salió de:
      - `lodash-es@4.17.21` vulnerable,
      - `mdast-util-to-hast@13.2.0` vulnerable,
      - a:
      - `lodash-es@4.17.23`,
      - `mdast-util-to-hast@13.2.1`,
      - `react-quill-new@3.8.3`.
    - resultado actual de `frontend npm audit --omit=dev`:
      - solo queda `quill@2.0.3` con 2 vulnerabilidades bajas heredadas por `react-quill-new`,
      - backend productivo permanece en `0` vulnerabilidades.
  - Validación de cierre:
    - `cd ecommerce && npm run lint`: verde,
    - `cd ecommerce && npm run build`: verde,
    - `docker compose -f deploy/docker-compose.dev.yml build storefront`: verde,
    - `docker compose -f deploy/docker-compose.dev.yml up -d --force-recreate storefront`: verde,
    - `docker compose -f deploy/docker-compose.dev.yml ps storefront`: `healthy`,
    - verificación de política demo en runtime:
      - `/shops` -> `404`,
      - `/mobile-category-nav` -> `404`,
      - `/market-1` -> `307`,
      - `/checkout-alternative` -> `307`,
      - `/login` -> `307`,
      - `/signup` -> `307`.
    - `cd frontend && npm run lint`: verde,
    - `cd frontend && npm test`: verde,
    - `cd frontend && npm run build`: verde,
    - `docker compose -f deploy/docker-compose.dev.yml build frontend`: verde,
    - `docker compose -f deploy/docker-compose.dev.yml up -d --force-recreate frontend`: verde,
    - `curl -I http://127.0.0.1:8080`: `200 OK`.
- 2026-03-21
  - Ajuste puntual de header desktop en storefront:
    - el trigger de categorías del header fijo quedó contraído para replicar el patrón visual usado en `fashion-3`/`Navbar`,
    - el alcance se mantuvo deliberadamente acotado a ese ajuste, sin rediseñar topbar ni dropdown desktop.
  - Implementación:
    - `ecommerce/src/components/header/Header.tsx` reemplaza el trigger compacto previo por el botón contraído con icono, label y chevron consistente con el patrón ya existente,
    - `ecommerce/src/components/header/styles.ts` agrega el espaciado estable para ese bloque dentro del header fijo.
  - Validación:
    - `cd ecommerce && npm run lint`: verde,
    - `cd ecommerce && npm run build`: verde,
    - `docker compose -f deploy/docker-compose.dev.yml build storefront`: verde,
    - `docker compose -f deploy/docker-compose.dev.yml up -d --force-recreate storefront`: verde,
    - `curl http://127.0.0.1:3000/api/health`: `{"status":"ok"}`.
- 2026-03-21
  - Decisión operativa sobre `quill` en admin:
    - el riesgo residual de `quill@2.0.3` queda aceptado temporalmente,
    - el uso actual está acotado al panel administrativo (`RichTextEditor`) y no forma parte de la superficie pública del sistema,
    - no se abre reemplazo inmediato del editor; queda como mejora futura si el costo/beneficio cambia.
  - Ajuste funcional sobre catálogo y home del storefront:
    - `shop` incorpora la barra superior de resultados con contexto actual, contador, ordenamiento y tipo de visualización,
    - el sort ya no es solo visual: consume valores soportados por backend (`newest`, `price-asc`, `price-desc`) y preserva el resto de filtros/querystring,
    - la sección de categorías con imágenes del home dejó de usar un fetch/cache aislado y pasó a reutilizar la misma fuente de categorías compartida por navegación y shop,
    - además, el home ahora prioriza categorías raíz con presencia real de catálogo en el árbol, para evitar divergencia con el catálogo navegable.
- 2026-03-21
  - Mitigación operativa para la recurrencia de `storefront` desfasado en local:
    - el problema repetido no era solo caché del navegador; el stack dev dependía de rebuilds productivos lentos del `ecommerce`, y cuando esos builds no cerraban rápido Docker seguía sirviendo el artefacto anterior,
    - el servicio `storefront` de `deploy/docker-compose.dev.yml` pasa a ejecutarse en `next dev` dentro de Docker para desarrollo local,
    - se montan `../ecommerce` y `../src` como volúmenes y se persisten `node_modules` + `.next` en volúmenes Docker dedicados,
    - esto aplica solo al stack local; no modifica el Docker/runtime productivo ni el despliegue en DigitalOcean.
  - Ajustes funcionales del mismo bloque:
    - `/shop` deja de tratar `All` como categoría activa, por lo que ya no muestra `Explorando "All"` al entrar sin filtros,
    - el buscador limpia/cierra mejor al navegar a resultados,
    - el selector de categoría del buscador recupera prioridad de click sobre el input adyacente.
  - Validación:
    - `cd ecommerce && npm run lint`: verde,
    - `docker compose -f deploy/docker-compose.dev.yml config`: verde,
    - `docker compose -f deploy/docker-compose.dev.yml up -d --build --force-recreate storefront`: verde,
    - `docker compose -f deploy/docker-compose.dev.yml ps storefront`: `healthy`,
    - `curl http://127.0.0.1:3000/api/health`: `{"status":"ok"}`,
    - inspección del HTML servido por `/shop`: ya no contiene el bloque `Explora nuestro catálogo` / `Encuentra productos y servicios disponibles para tu proyecto`.
- 2026-03-21
  - Ajuste fino adicional sobre `shop` y el buscador del storefront:
    - el selector de categoría del buscador volvió a quedar desplegable; la causa era que el popover del menú quedaba recortado por `overflow: hidden` en la barra,
    - `/shop` directo ya no muestra el contador de resultados cuando no hay búsqueda, categoría ni filtros activos.
  - Implementación:
    - `ecommerce/src/components/search-box/styled.ts` cambia el contenedor del buscador a `overflow: visible` y mantiene el segmento de categoría integrado visualmente,
    - `ecommerce/src/app/shop/components/ShopResultsToolbar.tsx` ahora muestra el contador solo cuando hay contexto real de resultados (búsqueda/categoría/filtros/sort no default).
  - Validación:
    - `cd ecommerce && npm run lint`: verde.
- 2026-03-21
  - Unificación del selector de categorías del buscador con el patrón desktop:
    - el selector del buscador ahora reutiliza la misma fila visual base que el dropdown de categorías desktop,
    - se extrajo un bloque compartido (`CategoryDropdownRow`) para evitar dos implementaciones divergentes del mismo patrón,
    - además el selector del buscador se sincroniza con `?category=` para reflejar la categoría activa real en la URL.
  - Implementación:
    - `ecommerce/src/components/categories/styles.tsx` expone `CategoryDropdownRow`,
    - `ecommerce/src/components/categories/CategoryMenuItem.tsx` pasa a reutilizar ese bloque compartido,
    - `ecommerce/src/components/search-box/SearchInputWithCategory.tsx` usa el mismo patrón de fila y sincroniza `selectedCategory` con la URL.
  - Validación:
    - `cd ecommerce && npm run lint`: verde,
    - `curl http://127.0.0.1:3000/api/health`: `{"status":"ok"}`.
- 2026-03-21
  - Unificación de lógica de coincidencias entre la barra de búsqueda y `/shop`:
    - se extrajo una utilidad compartida para normalización y matching de categorías del storefront,
    - `SearchInputWithCategory` y `shop/page.tsx` ya usan la misma lógica para detectar coincidencias por categoría,
    - con esto `Ver todos los resultados` deja de perder coincidencias que sí se veían en el dropdown del buscador.
  - Implementación:
    - `ecommerce/src/lib/storefront/search-utils.ts` centraliza normalización + matching de categorías,
    - `ecommerce/src/components/search-box/SearchInputWithCategory.tsx` reutiliza esa utilidad,
    - `ecommerce/src/app/shop/page.tsx` combina resultados de búsqueda textual con productos de categorías coincidentes cuando no hay `category` explícita en la URL.
  - Validación:
    - `cd ecommerce && npm run lint`: verde,
    - inspección runtime de `/shop?query=abert`: muestra `Buscando "abert"` con resultados en lugar de `0 resultados encontrados`.
- 2026-03-21
  - Ajuste de navegación del buscador:
    - al hacer click en un resultado de producto dentro del dropdown del buscador, el flujo ya no navega directo a la ficha,
    - ahora reutiliza el mismo comportamiento de `Ver todos los resultados` y lleva a `/shop` con la query actual para mostrar coincidencias en listado.
  - Implementación:
    - `ecommerce/src/components/search-box/SearchInputWithCategory.tsx`.
  - Validación:
    - `cd ecommerce && npm run lint`: verde,
    - `curl http://127.0.0.1:3000/api/health`: `{"status":"ok"}`,
    - `docker compose -f deploy/docker-compose.dev.yml ps storefront`: `healthy`.
- 2026-03-21
  - Ajuste de interacción del selector de categorías del buscador:
    - al seleccionar una categoría desde la barra, la selección se mantiene,
    - el dropdown del selector se cierra inmediatamente después del click,
    - el cierre se implementó de forma opt-in en `Menu`, para no cambiar el comportamiento de otros menús del storefront.
  - Implementación:
    - `ecommerce/src/components/menu/Menu.tsx`,
    - `ecommerce/src/components/search-box/SearchInputWithCategory.tsx`.
  - Validación:
    - `cd ecommerce && npm run lint`: verde,
    - `curl http://127.0.0.1:3000/api/health`: `{"status":"ok"}`.
- 2026-03-21
  - Refactor adicional del dropdown del buscador:
    - la fila visual usada en el nav de categorías desktop pasa a un componente compartido reutilizable,
    - el dropdown del buscador deja de tener una implementación paralela para categorías y productos,
    - categorías y productos ahora se diferencian por jerarquía tipográfica sobre el mismo bloque base:
      - categoría con contexto/eyebrow de tipo,
      - producto con contexto de categoría y precio como trailing.
  - Ajuste posterior del selector de categorías del buscador:
    - en desktop deja de usar la lista plana y pasa a reutilizar el árbol real de categorías con el mismo patrón visual del nav de categorías,
    - en mobile pasa a usar acordeón reutilizable con estado activo completo, en lugar de dejar solo una marca fina para la categoría seleccionada,
    - esto alinea tipografía, chevrons, despliegue y fondo activo con el patrón desktop de referencia.
  - Implementación:
    - `ecommerce/src/components/categories/CategoryNavigationRow.tsx`,
    - `ecommerce/src/components/categories/CategoryMenuItem.tsx`,
    - `ecommerce/src/components/categories/styles.tsx`,
    - `ecommerce/src/components/search-box/SearchInputWithCategory.tsx`,
    - `ecommerce/src/components/mobile-navigation/AccordionMenu.tsx`,
    - `ecommerce/src/components/mobile-navigation/styles.tsx`,
    - `ecommerce/src/lib/storefront/search-utils.ts`,
    - `ecommerce/src/translations/en.ts`,
    - `ecommerce/src/translations/es.ts`.
  - Validación:
    - `cd ecommerce && npm run lint`: verde,
    - `docker compose -f deploy/docker-compose.dev.yml ps storefront`: `healthy`,
    - `curl http://127.0.0.1:3000/api/health`: `{"status":"ok"}`.
