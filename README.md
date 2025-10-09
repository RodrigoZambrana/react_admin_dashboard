# React Admin Dashboard – Infraestructura y Automatización

Este repositorio contiene todo lo necesario para desarrollar, construir y desplegar la aplicación compuesta por un frontend en React (Vite + TypeScript), un backend en NestJS/Fastify y PostgreSQL como base de datos. La infraestructura se orquesta con Docker Compose y los despliegues se automatizan mediante GitHub Actions: el ambiente **dev** levanta el stack localmente en el runner y los ambientes de **staging/prod** se publican sobre un Droplet de DigitalOcean mediante SSH. .

## Estructura del repositorio

```
root/
├── frontend/                 # Aplicación React + Vite + TS
│   ├── Dockerfile            # Build multi-stage (Node -> Nginx)
│   └── nginx/default.conf.template
├── backend/                  # API NestJS + Fastify
│   ├── Dockerfile            # Build multi-stage
│   ├── prisma/schema.prisma  # Modelo de datos (incluye User)
│   └── .env.example          # Variables de ejemplo
├── deploy/
│   ├── docker-compose.dev.yml
│   ├── docker-compose.staging.yml
│   ├── docker-compose.prod.yml
│   ├── env/                  # Archivos de entorno (no versionados)
│   └── nginx/
│       ├── nginx.conf        # Reverse proxy / TLS opcional
│       └── dhparam.pem
├── .github/workflows/        # CI/CD (FE, BE, despliegues dev/staging/prod)
├── Makefile                  # Comandos de conveniencia
├── SECURITY.md               # Buenas prácticas y manejo de secretos
└── README.md
```

## Ramas y ambientes

| Rama Git | GitHub Environment | Archivo compose | Dominio esperado |
|----------|-------------------|-----------------|------------------|
| `develop` | `dev`              | `deploy/docker-compose.dev.yml`      | `APP_DOMINIO_DEV` |
| `staging` | `staging`          | `deploy/docker-compose.staging.yml`  | `APP_DOMINIO_STAGING` |
| `main`    | `prod`             | `deploy/docker-compose.prod.yml`     | `APP_DOMINIO_PROD` |

Cada environment en GitHub Actions debe definir los secretos descritos en la sección de [CI/CD](#cicd).

## Desarrollo local con Docker Compose

1. Copia los archivos de entorno de ejemplo y ajusta valores según necesidad:
   ```bash
   cp backend/.env.example backend/.env
   cp frontend/.env.example frontend/.env
   cp deploy/env/backend.dev.env.example deploy/env/backend.dev.env
   cp deploy/env/frontend.dev.env.example deploy/env/frontend.dev.env
   ```
   Define al menos las variables de conexión (`DATABASE_URL`), secretos JWT/cookies y los orígenes permitidos en `deploy/env/backend.dev.env`; el archivo del frontend controla las variables `VITE_*` utilizadas por Vite.

   Variables esperadas:

   - `deploy/env/backend.dev.env`
     - `NODE_ENV`: modo de ejecución del backend (normalmente `development`).
     - `PORT`: puerto donde expondrá NestJS (por defecto `3000`).
     - `DATABASE_URL`: cadena de conexión para PostgreSQL.
     - `JWT_SECRET`: clave para firmar tokens JWT.
     - `COOKIE_SECRET`: clave para firmar cookies de sesión.
     - `ALLOWED_ORIGINS`: lista separada por comas con orígenes permitidos para CORS.
     - `DEFAULT_USER_TEMP_PASSWORD`: contraseña provisional para usuarios creados desde la API.
     - `RECAPTCHA_SECRET_KEY`: clave secreta del backend para validar reCAPTCHA (opcional).
     - `SENTRY_DSN`: DSN del proyecto en Sentry (opcional).

   - `deploy/env/frontend.dev.env`
     - `VITE_APP_NAME`: nombre que muestra la aplicación en el frontend.
     - `VITE_API_URL`: URL base para la API desde el navegador (generalmente `http://localhost:8080/api`).
     - `VITE_STATE_SIGNATURE_KEY`: clave utilizada para firmar estados en el frontend.
     - `VITE_RECAPTCHA_SITE_KEY`: clave pública del sitio para reCAPTCHA (opcional).

2. Levanta el entorno completo (frontend con Vite, backend en modo watch y PostgreSQL) mediante:
   ```bash
   make dev-up
   ```

   La aplicación quedará disponible a través de `http://localhost:8080`, con el proxy Nginx dirigiendo `/api` al backend.

3. Para detener los servicios:
   ```bash
   make dev-down
   ```

4. Otros comandos útiles:
   ```bash
   make dev-logs      # Sigue logs de todos los servicios
   make staging-up    # Corre el stack de staging en local (requiere envs en deploy/env)
   make prod-up       # Corre el stack productivo en local (requiere certs/envs)
   make backup ENV=dev POSTGRES_USER=postgres POSTGRES_DB=dashboard
   ```

   > Para iniciar la base de datos incluida en los archivos de staging/prod usa `COMPOSE_PROFILES=managed-db` al ejecutar `docker compose`.

## Base de datos y Prisma

- La cadena de conexión debe seguir el formato `postgresql://USER:PASSWORD@HOST:PORT/DB?schema=public`.
- Durante los despliegues se ejecuta `npx prisma migrate deploy` sólo si:
  - Cambió algún archivo dentro de `backend/prisma/**`, y
  - El secreto `PRISMA_APPLY_MIGRATIONS` está configurado en `true` para el environment objetivo.
- Usa `npm run prisma:migrate` (deploy) o `npm run prisma:migrate:dev` (si lo defines) para aplicar cambios manualmente.

## CI/CD

### Workflows de CI

- `.github/workflows/ci-fe.yml`: lint, test y build del frontend con Node 20.
- `.github/workflows/ci-be.yml`: lint (tsc), vitest y build del backend, incluyendo `npx prisma generate`.

Ambos se ejecutan en cada PR y en pushes a `develop`, `staging` y `main` cuando cambian archivos de su ámbito.

### Workflows de despliegue

- `deploy-dev.yml` → rama `develop`, environment `dev`. Levanta `docker compose -f deploy/docker-compose.dev.yml` directamente en el runner de GitHub para validar el stack de forma local (sin conectarse al Droplet).
- `deploy-staging.yml` → rama `staging`, environment `staging`.
- `deploy-prod.yml` → rama `main`, environment `prod`.

Flujo del workflow **dev**:

1. Checkout con historial para detectar cambios en Prisma.
2. Instalación, lint, test y build de frontend/backend.
3. Renderizado opcional de `deploy/env/backend.dev.env` y `deploy/env/frontend.dev.env` a partir de los secretos.
4. Ejecución de `docker compose up -d` (stack dev) dentro del runner.
5. Migraciones condicionales vía `docker compose exec backend npx prisma migrate deploy` si así se configura.
6. Health check local contra `http://localhost:8080/api/health` y teardown con `docker compose down`.

Flujo compartido por **staging/prod**:

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

**Dev (runner local):**

| Variable | Descripción |
|----------|-------------|
| `ENV_FILE_BACKEND` | (Opcional) Contenido para `deploy/env/backend.dev.env` |
| `ENV_FILE_FRONTEND` | (Opcional) Contenido para `deploy/env/frontend.dev.env` |
| `PRISMA_APPLY_MIGRATIONS` | `true/false` para habilitar migraciones automáticas |

**Staging/Prod (Droplet remoto):**

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

> **Nota:** Los archivos generados a partir de `ENV_FILE_*` no se versionan; en staging/prod sólo viven en el Droplet dentro de `deploy/env/`.

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
- Renueva certificados TLS (Let’s Encrypt, Caddy, etc.) y ubica los artefactos en `deploy/certs/` (montados en `deploy/docker-compose.prod.yml`).
- Considera integrar Sentry u OpenTelemetry agregando variables en los archivos de entorno correspondientes.

## Comandos npm relevantes

### Frontend (`frontend/package.json`)
- `npm run dev`, `npm run build`, `npm run preview`, `npm run lint`, `npm run test`.

### Backend (`backend/package.json`)
- `npm run start:dev`, `npm run build`, `npm run start:prod`, `npm run lint`, `npm run test`, `npm run prisma:migrate`.

## Consideraciones adicionales

- Ajusta `deploy/nginx/nginx.conf` para habilitar TLS (descomenta secciones e incluye certificados en `deploy/certs`).
- Las imágenes pueden publicarse en GHCR cambiando las variables `FRONTEND_IMAGE` y `BACKEND_IMAGE` en los archivos compose.
- Para habilitar seeds (`prisma db seed`) añade el script correspondiente en `backend/package.json` y ejecútalo desde el Droplet con `docker compose exec`.

## Troubleshooting rápido

- **El health check falla** → revisa logs con `docker compose -f deploy/docker-compose.<env>.yml logs -f backend proxy` y ejecuta `make rollback`.
- **Migraciones no aplicadas** → valida que `PRISMA_APPLY_MIGRATIONS=true` y que `backend/prisma/**` cambió en el commit.
- **Sin acceso a la DB** → confirma `POSTGRES_PASSWORD` y `DATABASE_URL` en el archivo de entorno y que el puerto 5432 esté expuesto o accesible internamente.

¡Listo! La aplicación queda preparada para integrar nuevas funcionalidades sin preocuparte por la infraestructura base.
