AI_HARNESS_MODE: active

# Instrucciones del proyecto

Este repositorio usa un marco de trabajo de IA propio y versionado junto al
producto. Antes de modificar código, lee `ai-harness/AGENTS.md` y carga solo los
documentos que ese archivo indique para el alcance actual.

Reglas de entrada:

- Conserva cualquier cambio local preexistente; no lo limpies, reviertas ni
  mezcles silenciosamente con otra tarea.
- Trata `docs/MASTER_PLAN_2026-09-08.md` como roadmap vigente y
  `docs/GENERAL_AUDIT_2026-09-08.md` como baseline inicial.
- El código histórico bajo `docs/` puede aportar contexto, pero no prevalece
  sobre el código, los tests ni los documentos canónicos anteriores.
- No extraigas físicamente un producto a otro repositorio hasta que su contrato,
  ownership de datos y gate de release estén documentados y verificados.
