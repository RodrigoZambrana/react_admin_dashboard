# Sistema Administrativo – Infraestructura y Automatización

Este repositorio contiene todo lo necesario para desarrollar, construir y desplegar la aplicación compuesta por un frontend en React (Vite + TypeScript), un backend en NestJS/Fastify y PostgreSQL como base de datos. La infraestructura se orquesta con Docker Compose y los despliegues se automatizan mediante GitHub Actions: la rama **develop** se valida con CI y se ejecuta localmente mediante Docker, mientras que los ambientes de **testing/prod** se publican sobre un Droplet de DigitalOcean mediante SSH.

## Estructura del repositorio

```
root/
├── frontend/                 # Aplicación React + Vite + TS
│   ├── Dockerfile            # Build multi-stage (Node -> Nginx)
│   └── nginx/default.conf.template
├── ecommerce/              # Storefront (Next.js + styled-components) consumiendo la API /storefront
├── backend/                  # API NestJS + Fastify
│   ├── Dockerfile            # Build multi-stage
│   ├── prisma/schema.prisma  # Modelo de datos (incluye User)
│   └── .env.example          # Variables de ejemplo
├── deploy/
│   ├── docker-compose.dev.yml
│   ├── docker-compose.testing.yml
│   ├── docker-compose.prod.yml
│   └── env/                  # Archivos de entorno (no versionados)
├── .github/workflows/        # CI/CD (FE, BE, despliegues testing/prod)
├── Makefile                  # Comandos de conveniencia
├── SECURITY.md               # Buenas prácticas y manejo de secretos
└── README.md
```

## Ramas y ambientes

| Rama Git | GitHub Environment | Archivo compose | Dominio esperado |
|----------|-------------------|-----------------|------------------|
| `develop` | Manual (local)     | `deploy/docker-compose.dev.yml`      | `APP_DOMINIO_DEV` |
| `testing` | `testing`          | `deploy/docker-compose.testing.yml`  | `APP_DOMINIO_TESTING` |
| `main`    | `prod`             | `deploy/docker-compose.prod.yml`     | `APP_DOMINIO_PROD` |

Los environments de testing y prod en GitHub Actions deben definir los secretos descritos en la sección de [CI/CD](#cicd).

## Variables de entorno

- `env.schema.json` centraliza la lista de claves requeridas para backend y frontend; mantenelo actualizado cuando se agreguen variables nuevas.
- Ejecutá `node scripts/check-env.mjs` para verificar que todos los archivos `.env` (locales y los de `deploy/env` en dev/testing/prod) incluyan esas claves antes de levantar contenedores o desplegar.
- En `deploy/env` encontrarás un `.env.example` por cada ambiente (dev, testing y prod) para ambos servicios. Copiá el correspondiente y completalo según corresponda.

## Desarrollo local con Docker Compose

1. Copia los archivos de entorno de ejemplo y ajusta valores según necesidad:
   ```bash
   cp backend/.env.example backend/.env
   cp frontend/.env.example frontend/.env
   cp deploy/env/backend.dev.env.example deploy/env/backend.dev.env
   cp deploy/env/frontend.dev.env.example deploy/env/frontend.dev.env
   ```
   Define al menos las variables de conexión (`DATABASE_URL`), secretos JWT/cookies y los orígenes permitidos en `deploy/env/backend.dev.env`; el archivo del frontend controla las variables `VITE_*` utilizadas por Vite.

   Ejecutá `node scripts/check-env.mjs` después de copiar y editar los archivos para validar que ningún `.env` quedó sin una variable obligatoria según `env.schema.json`. El script analiza los archivos locales y los de `deploy/env` (dev/testing/prod) e informa las claves faltantes antes de levantar los contenedores.

   > Si ya tenés PostgreSQL escuchando en `5432`, exportá `POSTGRES_HOST_PORT=0` antes de `make dev-up` para que Docker publique la base en un puerto aleatorio y evitar conflictos.

   Variables esperadas:

   - `deploy/env/backend.dev.env`
     - `NODE_ENV`: modo de ejecución del backend (normalmente `development`).
    - `PORT`: puerto donde expondrá NestJS (por defecto `4000`).
   - `DATABASE_URL`: cadena de conexión para PostgreSQL (ejemplo local `postgresql://postgres:postgres@host.docker.internal:5432/react_admin_dashboard?schema=public` para apuntar a una base externa al stack).
   - `JWT_SECRET`: clave para firmar tokens JWT.
   - `SESSION_TTL_HOURS`: duración de la sesión autenticada (JWT + cookie) en horas. Por defecto 168h (7 días).
   - `COOKIE_SECRET`: clave para firmar cookies de sesión.
   - `ALLOWED_ORIGINS`: lista separada por comas con orígenes permitidos para CORS.
   - `DEFAULT_ALLOWED_ORIGINS`: orígenes base admitidos incluso si `ALLOWED_ORIGINS` está vacío (útil para definir el host principal sin tocar la lista dinámica manejada por el UI).
   - `DEFAULT_USER_TEMP_PASSWORD`: contraseña provisional para usuarios creados desde la API.
   - `RECAPTCHA_SECRET_KEY`: clave secreta del backend para validar reCAPTCHA (opcional).
   - `RECAPTCHA_ENABLED`: activa/desactiva la validación de reCAPTCHA en el backend (`false` por defecto).
   - `SENTRY_DSN`: DSN del proyecto en Sentry (opcional).
   - `RUN_PRISMA_SEED_ON_BOOT`: si es `true`, ejecuta `prisma db seed` después de migraciones.
   - `ENABLE_DEMO_SEED`: habilita datos de ejemplo en el seed (por defecto deshabilitado).
   - `SEED_SUPERADMIN_EMAIL` / `SEED_SUPERADMIN_PASSWORD`: credenciales para crear un superadmin la primera vez que corre el seed (no se almacenan en texto plano una vez creado).
   - `SEED_SUPERADMIN_NAME`: nombre para el superadmin creado automáticamente.
   - `PAYMENTS_PROVIDER`: define el gateway activo; usar `mercadopago` para habilitar los pagos con tarjeta en la tienda.
   - `MP_PUBLIC_KEY` / `MP_ACCESS_TOKEN`: credenciales de Mercado Pago (modo test o producción) que permiten inicializar pagos. También podés gestionarlas desde **Configuración → Mercado Pago** en el panel admin; si existen en la base de datos tienen prioridad por sobre las variables de entorno.
   - `MP_COUNTRY`: código de país (por defecto `AR`) que se usa para regionalizar la experiencia del checkout.
   - `CONFIG_ENCRYPTION_KEY`: clave base64/hex de 32 bytes utilizada para cifrar los secretos persistidos en la tabla `SecureConfig`. Es obligatoria.
   - `GOOGLE_OAUTH_ENABLED`: habilita/deshabilita el flujo OAuth de Google en el backend (por defecto `true`).
   - `ADMIN_RECAPTCHA_ENABLED` / `ADMIN_RECAPTCHA_SITE_KEY`: controlan el uso de reCAPTCHA en el panel administrativo; alternativamente podés gestionarlos desde **Configuración → Google & reCAPTCHA**.
   - `STOREFRONT_RECAPTCHA_ENABLED` / `STOREFRONT_RECAPTCHA_SITE_KEY`: exponen la clave pública para el storefront cuando se requiera mostrar desafíos de reCAPTCHA.

> El backend ejecuta `migrate deploy` y, si `RUN_PRISMA_SEED_ON_BOOT=true`, también `prisma db seed` durante `make dev-up`. Definí `SKIP_PRISMA_MIGRATIONS=true` para omitir las migraciones automáticas. El seed solo crea el superadmin cuando las credenciales anteriores están definidas y omite datos demo salvo que `ENABLE_DEMO_SEED=true`.

   - `deploy/env/frontend.dev.env`
   - `VITE_APP_NAME`: nombre que muestra la aplicación en el frontend.
   - `VITE_API_URL`: URL base para la API desde el navegador (por defecto `http://localhost:4000/api` en Docker Compose; ajustalo al dominio del backend en testing/prod, p. ej. `https://api.example.com/api`).
   - `VITE_STATE_SIGNATURE_KEY`: clave utilizada para firmar estados en el frontend.
   - `VITE_RECAPTCHA_ENABLED`: activa/desactiva la carga del script de reCAPTCHA en el navegador.
   - `VITE_RECAPTCHA_SITE_KEY`: clave pública del sitio para reCAPTCHA (opcional).

2. Levanta el entorno completo (frontend servido por Nginx, backend en modo compilado y PostgreSQL) mediante:
   ```bash
   make dev-up
   ```

   La aplicación quedará disponible a través de `http://localhost:8080` (frontend) y la API responderá en `http://localhost:4000/api`. Como los servicios corren con la build compilada, cualquier cambio en el código requiere volver a construir las imágenes (`docker compose -f deploy/docker-compose.dev.yml build frontend backend`) antes de reiniciar los contenedores.

   #### Levantar la base sin seed y crear un superadmin temporal
   1. Edita `deploy/env/backend.dev.env` y asegúrate de que `RUN_PRISMA_SEED_ON_BOOT=false` para que el contenedor del backend no ejecute el seed automáticamente.
   2. Arranca el stack manualmente (incluye base de datos, backend y frontend):
      ```bash
      docker compose -f deploy/docker-compose.dev.yml up --build
      ```
      Agrega `-d` si querés dejar los contenedores en segundo plano.
   3. Con los servicios en marcha, crea únicamente el superadmin de desarrollo usando las credenciales definidas en `SEED_SUPERADMIN_*`:
      ```bash
      docker compose -f deploy/docker-compose.dev.yml exec backend npx --yes prisma db seed
      ```
      Asegurate de que el contenedor del backend muestre `Nest application successfully started` en los logs (`docker compose logs backend -f`) antes de ejecutar el seed para evitar que falten binarios.
      Si `ENABLE_DEMO_SEED=false`, el comando solo genera la cuenta superadmin y no agrega datos de ejemplo.
      También podés recrear (o forzar) el superadmin sin ejecutar el seed completo:
      ```bash
      docker compose -f deploy/docker-compose.dev.yml exec backend \
        env DEFAULT_ADMIN_EMAIL=admin@example.com \
            DEFAULT_ADMIN_PASSWORD=Admin@123! \
            DEFAULT_ADMIN_NAME="Admin Local" \
        node dist/scripts/reset-admin.js
      ```
   4. Para reiniciar el proceso desde cero (eliminando contenedores, volúmenes y volver a levantar todo), primero detén el stack y borra los recursos existentes:
      ```bash
      docker compose -f deploy/docker-compose.dev.yml down --volumes --remove-orphans
      docker volume rm admin-dashboard-dev_postgres_data_dev 2>/dev/null || true
      ```
      Luego vuelve a repetir los pasos 1 a 3.
   5. Para automatizar el teardown completo, recrear el stack, ejecutar el seed y seguir los logs en una sola secuencia (validando antes que los `.env` estén completos):
      ```bash
      make env-check && docker compose -f deploy/docker-compose.dev.yml down --volumes --remove-orphans && docker compose -f deploy/docker-compose.dev.yml up -d --build && docker compose -f deploy/docker-compose.dev.yml exec backend npx --yes prisma db seed && docker compose -f deploy/docker-compose.dev.yml logs -f
      ```
      Presioná `Ctrl+C` cuando quieras dejar de seguir los logs.
   6. Si necesitás inspeccionar o editar los datos con Prisma Studio:
      ```bash
      docker compose -f deploy/docker-compose.dev.yml exec backend npx prisma studio --host 0.0.0.0 --port 5555 --browser none
      ```
      La interfaz queda disponible en `http://localhost:5555`. Asegurate de tener publicado el puerto `5555` en el servicio `backend` (temporalmente, si es necesario) y presioná `Ctrl+C` para cerrarla cuando termines.

   > Las sesiones autenticadas expiran según el valor de `SESSION_TTL_HOURS`. Una vez alcanzado el límite, el backend invalida el token y el frontend vuelve a requerir credenciales automáticamente.

3. Para detener los servicios:
   ```bash
   make dev-down
   ```

4. Otros comandos útiles:
   ```bash
   make dev-logs      # Sigue logs de todos los servicios
   make testing-up   # Corre el stack de testing en local (requiere envs en deploy/env)
   make prod-up       # Corre el stack productivo en local (requiere envs)
   make backup ENV=dev POSTGRES_USER=postgres POSTGRES_DB=dashboard
   ```

   > Para iniciar la base de datos incluida en los archivos de testing/prod usa `COMPOSE_PROFILES=managed-db` al ejecutar `docker compose`. Con la pila productiva expuesta sin proxy, accedé al frontend en `http://localhost:8080` y a la API en `http://localhost:4000/api`.

## Base de datos y Prisma

- La cadena de conexión debe seguir el formato `postgresql://USER:PASSWORD@HOST:PORT/DB?schema=public`.
- Durante los despliegues se ejecuta `npx prisma migrate deploy` sólo si:
  - Cambió algún archivo dentro de `backend/prisma/**`, y
  - El secreto `PRISMA_APPLY_MIGRATIONS` está configurado en `true` para el environment objetivo.
- Usa `npm run prisma:migrate` (deploy) o `npm run prisma:migrate:dev` (si lo defines) para aplicar cambios manualmente.

### Acceso a la base de datos local

- Levantá únicamente el servicio de PostgreSQL con `docker compose -f backend/docker-compose.yml up -d db`. El contenedor crea automáticamente la base `react_admin_dashboard` usando el usuario `postgres` y la contraseña `postgres`.
- Si necesitás crear la base manualmente dentro del contenedor, ejecutá `docker compose -f backend/docker-compose.yml exec db psql -U postgres -c "CREATE DATABASE react_admin_dashboard;"`.
- Desde clientes como DBeaver configurá una conexión PostgreSQL apuntando a `localhost`, puerto `5432`, usuario `postgres`, contraseña `postgres`. Seleccioná la base `react_admin_dashboard` o ejecútala con el comando anterior si aún no existe.
> Nota: desde contenedores del stack (`backend`, `frontend`) accedé a la base local a través de `host.docker.internal` para resolver a tu máquina anfitriona.

## CI/CD

### Workflows de CI

- `.github/workflows/ci-fe.yml`: lint, test y build del frontend con Node 20.
- `.github/workflows/ci-be.yml`: lint (tsc), vitest y build del backend, incluyendo `npx prisma generate`.

Ambos se ejecutan en cada PR y en pushes a `develop`, `testing` y `main` cuando cambian archivos de su ámbito.

### Workflows de despliegue

- `deploy-testing.yml` → rama `testing`, environment `testing`.
- `deploy-prod.yml` → rama `main`, environment `prod`.

### DigitalOcean App Platform

- `app.yaml` describe la App con dos componentes Docker. Ajustá `github.repo` y `github.branch` al clonar la app desde tu organización y setea `ALLOWED_ORIGINS` con el dominio público que expondrá App Platform.
- El componente `frontend` compila `frontend/Dockerfile`, publica la ruta `/` y espera que definas las variables Vite indicadas (las marcadas como `type: SECRET` deben existir como secretos de App Platform con el mismo nombre).
- El componente `backend` usa `backend/Dockerfile`, expone el puerto `3000` y enruta bajo `/api` manteniendo el prefijo. Configurá los secretos (`DATABASE_URL`, `JWT_SECRET`, etc.) y valores generales (`PRISMA_APPLY_MIGRATIONS`, `RUN_PRISMA_SEED_ON_BOOT`, etc.) antes del primer despliegue.
- Ajustá `instance_size_slug`, `instance_count` o los `routes` según tus necesidades; podés duplicar el spec por ambiente (testing/prod) cambiando dominios y secretos.
- Si usás una base autogestionada, apuntá `DATABASE_URL` al servicio administrado y mantené `PRISMA_APPLY_MIGRATIONS=true` para ejecutar `prisma migrate deploy` automáticamente.

La rama `develop` no dispara despliegues automáticos. Para validar la pila completa:
- Ejecutá `make dev-up` (o `docker compose -f deploy/docker-compose.dev.yml up -d --build`) y navegá a `http://localhost:8080`.
- Cuando termines, `make dev-down` limpia los contenedores locales.
- Para depurar, `make dev-logs` (o `docker compose -f deploy/docker-compose.dev.yml logs -f backend frontend`) replica los logs del stack.

Los Dockerfiles multi-stage del frontend y backend generan artefactos compilados y, en testing/prod, los contenedores sirven esa build (`node dist/src/main.js` y Nginx) en lugar de exponer servidores `npm start`.

Flujo compartido por **testing/prod**:

1. Checkout del repositorio con historial para detectar cambios en Prisma.
2. Instalación, lint, test y build de frontend/backend.
3. Generación de `deploy/env/<env>.env` usando secretos (`ENV_FILE_FRONTEND`, `ENV_FILE_BACKEND`).
4. Empaquetado de `backend/`, `frontend/` y `deploy/` en `release.tar.gz`.
5. Conexión SSH (via `webfactory/ssh-agent`) al Droplet (`/opt/app`).
6. Sincronización del paquete (`rsync`) y despliegue con `docker compose up -d --build --remove-orphans`.
7. Ejecución condicional de `npx prisma migrate deploy`.
8. Health check (`curl`) al endpoint definido en `HEALTHCHECK_URL`.
9. Rollback automático si el health check falla (se restaura el symlink `current` al release previo y se relanza compose).

### Secretos requeridos por environment

El entorno local utiliza los `.env` versionados y no requiere secretos adicionales en GitHub.

**Testing/Prod (Droplet remoto):**

| Variable | Descripción |
|----------|-------------|
| `DO_HOST` | IP o dominio del Droplet |
| `DO_SSH_USER` | Usuario SSH para despliegues |
| `DO_SSH_PRIVATE_KEY` | Clave privada en formato PEM |
| `DO_SSH_PORT` | Puerto SSH (por defecto 22) |
| `ENV_FILE_BACKEND` | Contenido del archivo `deploy/env/backend.<env>.env` |
| `ENV_FILE_FRONTEND` | Contenido del archivo `deploy/env/frontend.<env>.env` |
| `HEALTHCHECK_URL` | URL pública del health check (`https://dominio/api/health`) |
| `PRISMA_APPLY_MIGRATIONS` | `true/false` según se permita aplicar migraciones |
| `DATABASE_URL`, `POSTGRES_PASSWORD`, etc. | Incluirlos dentro del archivo del backend o como variables adicionales en el Droplet |

> **Nota:** Los archivos generados a partir de `ENV_FILE_*` no se versionan; en testing/prod sólo viven en el Droplet dentro de `deploy/env/`.

## Estrategia de releases y rollback

En el Droplet los despliegues residen en `/opt/app/releases/<SHA>` y existe un symlink `current` apuntando al release activo (y `previous` al último release exitoso). El target `make rollback ENV=prod SSH_HOST=... SSH_USER=...` reestablece el release anterior y ejecuta `docker compose up -d` con el archivo correspondiente.

## Backups de base de datos

- Se puede lanzar manualmente un backup comprimido con `make backup ENV=prod POSTGRES_USER=postgres POSTGRES_DB=dashboard` (requiere `docker compose` y variables adecuadas).
- Para automatizarlo diariamente en el Droplet agrega una tarea cron que ejecute:
  ```bash
  0 2 * * * cd /opt/app/current/deploy && docker compose -f docker-compose.prod.yml exec -T db pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" | gzip > /var/backups/postgres/$(date +\%Y\%m\%d).sql.gz
  ```
  Opcionalmente sincroniza `/var/backups/postgres` con S3/Spaces.

## Seguridad y manejo de secretos

- Nunca subas llaves ni archivos `.env`; utiliza los ejemplos como guía.
- Configura firewall, fail2ban y acceso SSH por clave privada.
- Administrá certificados TLS (Let’s Encrypt, Caddy, etc.) desde la plataforma o el proxy externo que utilices para exponer la aplicación.
- Considera integrar Sentry u OpenTelemetry agregando variables en los archivos de entorno correspondientes.

## Comandos npm relevantes

### Frontend (`frontend/package.json`)
- `npm run dev`, `npm run build`, `npm run preview`, `npm run lint`, `npm run test`.

### Backend (`backend/package.json`)
- `npm run start:dev`, `npm run build`, `npm run start:prod`, `npm run lint`, `npm run test`, `npm run prisma:migrate`.

## Consideraciones adicionales

- Configurá TLS y dominios desde la plataforma donde despliegues (p. ej. DigitalOcean App Platform) o mediante el balanceador que utilices.
- Las imágenes pueden publicarse en GHCR cambiando las variables `FRONTEND_IMAGE` y `BACKEND_IMAGE` en los archivos compose.
- Para habilitar seeds (`prisma db seed`) añade el script correspondiente en `backend/package.json` y ejecútalo desde el Droplet con `docker compose exec`.

## Troubleshooting rápido

- **El health check falla** → revisa logs con `docker compose -f deploy/docker-compose.<env>.yml logs -f backend frontend` y ejecuta `make rollback`.
- **Migraciones no aplicadas** → valida que `PRISMA_APPLY_MIGRATIONS=true` y que `backend/prisma/**` cambió en el commit.
- **Sin acceso a la DB** → confirma `POSTGRES_PASSWORD` y `DATABASE_URL` en el archivo de entorno y que el puerto 5432 esté expuesto o accesible internamente.

¡Listo! La aplicación queda preparada para integrar nuevas funcionalidades sin preocuparte por la infraestructura base.
