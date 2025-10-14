# Operaciones y recomendaciones

## Despliegue
- El workflow `deploy-app-platform.yml` construye y publica imágenes en GHCR con las etiquetas `latest` y el `SHORT_SHA` del commit.
- Antes de actualizar la App se ejecuta `prisma migrate deploy` contra la base gestionada usando la imagen del backend.

## Rollback rápido
1. Edita `infra/app.yaml` y reemplaza `__TAG__` (o el valor renderizado) por el `SHORT_SHA` anterior.
2. Ejecuta manualmente el workflow con la opción **Run workflow** para volver a desplegar ese tag.
3. Verifica en App Platform que las versiones anteriores estén activas antes de borrar imágenes viejas.

## Migraciones Prisma
- Usa migraciones compatibles: primero agrega columnas/cambios no destructivos, despliega el backend y solo después elimina columnas.
- Para cambios complejos ejecuta `npx prisma migrate dev` en entornos locales y revisa los SQL generados.
- Mantén `PRISMA_APPLY_MIGRATIONS=false` en App Platform para evitar migraciones automáticas en arranque.

## Seeds de datos
- Ejecuta manualmente `docker run --rm -e DATABASE_URL=... ghcr.io/<owner>/mi-app-backend:<tag> npm run prisma:seed` cuando necesites poblar datos.
- Asegúrate de usar credenciales temporales o rotadas tras el seed.

## Healthchecks y rutas
- Backend: `GET /healthz` responde estado general y es usado por App Platform como healthcheck.
- Frontend: App Platform expone `/` como SPA y usa `catchall_document: index.html` para enrutamiento del cliente.
- Backend API disponible en `/api/*` gracias al enrutamiento definido en `app.yaml`.

## Pruebas locales con Docker
Puedes ensayar el pipeline end-to-end construyendo las mismas imágenes que publica el workflow y levantándolas con contenedores locales:

1. Construye las imágenes con la etiqueta corta del commit que quieras validar (usa el mismo tag para mantener coherencia con App Platform):
   ```bash
   SHORT_SHA=$(git rev-parse --short=7 HEAD)
   docker build -t ghcr.io/<owner>/mi-app-frontend:${SHORT_SHA} -f frontend/Dockerfile frontend
   docker build -t ghcr.io/<owner>/mi-app-backend:${SHORT_SHA} -f backend/Dockerfile backend
   ```
2. Levanta una base de datos temporal de Postgres 16 (o conecta tu base gestionada si prefieres probar con la real):
   ```bash
   docker run --name mi-app-db -e POSTGRES_PASSWORD=secret -e POSTGRES_DB=app -p 5432:5432 -d postgres:16-alpine
   export DATABASE_URL="postgresql://postgres:secret@localhost:5432/app?schema=public"
   ```
3. Ejecuta las migraciones usando la imagen recién construida para asegurarte de que Prisma funcione igual que en producción:
   ```bash
   docker run --rm --network host -e DATABASE_URL="$DATABASE_URL" ghcr.io/<owner>/mi-app-backend:${SHORT_SHA} \
     sh -lc 'npx prisma generate && npx prisma migrate deploy'
   ```
   > En macOS/Windows reemplaza `--network host` por `--add-host host.docker.internal:host-gateway` y ajusta la URL a `host.docker.internal`.
4. Lanza el backend usando la misma imagen, apuntando a la base local:
   ```bash
   docker run --rm --network host -e DATABASE_URL="$DATABASE_URL" ghcr.io/<owner>/mi-app-backend:${SHORT_SHA}
   ```
5. (Opcional) Sirve el frontend desde la imagen construida en el puerto 8080 para validar rutas y assets:
   ```bash
   docker run --rm -p 8080:80 ghcr.io/<owner>/mi-app-frontend:${SHORT_SHA}
   ```
6. Valida `http://localhost:3000/healthz` y `http://localhost:8080` para confirmar que el esquema funciona igual que en DigitalOcean.

## Monitoreo y observabilidad
- Configura alertas en DigitalOcean para tiempo de actividad y errores HTTP.
- Habilita logs estructurados en el backend para rastrear peticiones críticas.

## Escalado
- Ajusta `instance_size_slug` o `instance_count` en `infra/app.yaml` y redeploya para escalar horizontal/verticalmente.

## Seguridad
- Guarda `DO_API_TOKEN`, `DATABASE_URL_PROD` y `GHCR_PAT` como secrets de GitHub.
- Usa `sslmode=require` en la cadena de conexión de PostgreSQL gestionado.
