# Contrato de backlog

`planning/backlog.json` es la fuente ejecutable de tareas. Un documento de
roadmap explica dirección; el backlog decide qué puede comenzar.

El archivo canónico se ensambla de forma determinista desde los fragmentos por
producto en `planning/fragments/`. Los fragmentos permiten auditorías paralelas;
el resultado combinado sigue siendo una única cola gobernada.

## Estados

- `proposed`: candidato todavía incompleto o pendiente de auditoría.
- `ready`: especificación completa, sin decisiones ni dependencias pendientes.
- `blocked`: especificación conocida pero impedida por una dependencia o
  decisión explícita.
- `in_progress`: única tarea activa de implementación.
- `done`: aceptación y verificación satisfechas.
- `deferred`: fuera del horizonte actual por una razón registrada.

## Campos obligatorios

Cada tarea define producto, tipo, prioridad, objetivo, justificación, alcance
incluido/excluido, dependencias, criterios de aceptación, verificación, riesgos,
decisiones pendientes y fuentes de evidencia.
`decisionRefs` enlaza cada tarea con acuerdos aceptados del registro local.

## Gates

Una tarea no puede estar `ready` si:

- requiere una decisión humana;
- depende de otra tarea no terminada;
- no tiene criterios de aceptación observables;
- no tiene comandos o evidencia de verificación;
- mezcla más de un resultado independiente.

Validación:

```bash
npm run harness:backlog:assemble
npm run harness:backlog
npm run harness:backlog -- --ready
npm run harness:backlog -- --id SEC-001
```
