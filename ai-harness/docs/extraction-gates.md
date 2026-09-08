# Gates para separar productos

La separación física se hace producto por producto. Una carpeta no se convierte
en repositorio independiente solo por moverla.

## Requisitos previos obligatorios

1. Un owner único de datos y comportamiento.
2. Contrato versionado de entrada/salida y errores.
3. Ningún import directo desde otro producto.
4. Configuración y secretos propios.
5. Migraciones, backup, restore y rollback ensayados.
6. Observabilidad, healthcheck y runbook de operación.
7. Suite `release` verde y prueba de compatibilidad con consumidores.
8. Pipeline de despliegue independiente.

## Estrategia

1. **Frontera lógica:** aislar módulos dentro del monorepo.
2. **Contrato:** colocar un adapter delante de llamadas y datos compartidos.
3. **Runtime independiente:** ejecutar con proceso, configuración y healthcheck
   propios manteniendo el mismo repositorio.
4. **Datos independientes:** migrar ownership, usando sincronización temporal si
   es necesario.
5. **Extracción Git:** mover historial y CI solo después de estabilizar lo
   anterior.

## Criterio de no extracción

Si dos componentes requieren transacciones sobre la misma base o comparten
modelos Prisma internos, se mantienen juntos hasta reemplazar esa dependencia
por un contrato explícito. Duplicar tablas sin ownership no cuenta como
separación.
