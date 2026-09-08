# Contexto estable del proyecto

Esta carpeta contiene decisiones y reglas propias de Growth Platform que no
pertenecen al framework reusable. Los agentes leen solo el archivo relacionado
con su tarea.

- `product-priorities.md`: visión y orden aprobado del portfolio.
- `architecture-boundaries.md`: ownership y restricciones de separación.
- `runtime-testing.md`: comandos y ambientes conocidos.
- `database-notes.md`: datos, schemas y reglas de migración.
- `security-policy.md`: gates de seguridad por superficie.

Una regla no confirmada debe marcarse como propuesta. Las decisiones aceptadas
se registran además en `../decisions/index.json` y se superseden explícitamente.
