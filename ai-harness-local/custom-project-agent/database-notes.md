# Datos y migraciones

- Backend principal: PostgreSQL/Prisma, 36 directorios de migración observados.
- AI Platform: PostgreSQL/Prisma independiente, 18 directorios de migración.
- Qdrant y Redis pertenecen al runtime conversacional; Redis también soporta
  colas analytics en el stack principal.
- Commerce, CRM y Analytics todavía comparten el schema principal.
- Toda separación de datos requiere owner, estrategia de backfill, dual-write o
  CDC temporal si aplica, reconciliación, cutover y rollback.
- Nunca se ejecuta reset o migración destructiva sobre datos no identificados
  como locales/descartables.
- Backups versionados son evidencia histórica a inventariar, no mecanismo
  canónico de recuperación.
