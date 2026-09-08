# Runtime y testing local

## Entradas conocidas

- Integridad: `npm run test:integrity`.
- Harness: `npm run harness:doctor` y `npm run harness:verify`.
- Commerce stack: `make postgres-up` y `make dev-up` según el README vigente.
- AI Platform: `docker compose -f ai-platform/docker-compose.yml up --build`.
- Adapter de canales: overlay `deploy/docker-compose.channel-adapter.yml`.

## URLs documentadas

- Admin: `http://localhost:8080`.
- Storefront: `http://localhost:3000`.
- Commerce API: `http://localhost:4000/api`.
- AI Platform API: `http://localhost:4110`.
- AI Platform frontend: `http://localhost:5179`.

Las URLs son referencias locales, no evidencia de disponibilidad. Una tarea de
runtime debe validar health, migraciones, seed, autenticación y recorrido
funcional. Credenciales solo en archivos ignorados bajo `testing/.env`.
