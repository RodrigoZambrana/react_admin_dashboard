# Seguridad y Gestión de Secretos

## Acceso al servidor

- Deshabilita el acceso SSH por contraseña y utiliza la clave privada definida en `DO_SSH_PRIVATE_KEY`.
- Limita el acceso por IP utilizando el firewall del Droplet o herramientas como UFW.
- Habilita fail2ban para proteger contra ataques de fuerza bruta.
- Mantén el sistema actualizado (`apt update && apt upgrade`).

## Manejo de secretos

- Nunca subas archivos `.env` ni claves privadas al repositorio.
- Usa GitHub Environments para almacenar secretos sensibles por ambiente (`dev`, `staging`, `prod`).
- Los secretos `ENV_FILE_BACKEND` y `ENV_FILE_FRONTEND` deben contener el contenido completo de los archivos `.env` usados en despliegue.
- Rotar periódicamente contraseñas de base de datos, JWT y claves TLS.

## TLS

- El reverse proxy (`deploy/nginx/nginx.conf`) soporta TLS; coloca los certificados en `deploy/certs/` dentro del Droplet.
- Incluye `dhparam.pem` para mejorar el intercambio Diffie-Hellman.

## Auditoría y monitoreo

- Revisa periódicamente los logs (`docker compose logs proxy backend`).
- Configura alertas (Grafana, Healthchecks, PagerDuty, etc.) para notificar caídas.
- Integra herramientas de observabilidad como Sentry u OpenTelemetry cuando sea posible.

## Backups

- Configura cronjobs que ejecuten `pg_dump` y almacenen los archivos en `/var/backups/postgres`.
- Sincroniza los backups con un almacenamiento externo (DigitalOcean Spaces, Amazon S3) y cifra los artefactos si es necesario.

## Plan de respuesta ante incidentes

- Usa `make rollback` para retornar rápidamente al release previo.
- Documenta los pasos para revocar y regenerar credenciales comprometidas.
- Mantén un contacto de emergencia y procedimientos para notificar a los usuarios si ocurre una filtración de datos.
