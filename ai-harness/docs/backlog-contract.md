# Contrato de backlog

`planning/backlog.json` es la fuente ejecutable de tareas. Un documento de
roadmap explica dirección; el backlog decide qué puede comenzar.

El archivo canónico se ensambla de forma determinista desde los fragmentos por
producto en `planning/fragments/`. Los fragmentos permiten auditorías paralelas;
el resultado combinado sigue siendo una única cola gobernada.

El control deriva de esa misma cola los totales generales, las vistas por
`product`, el orden recomendado y las transiciones elegibles. Estas proyecciones
no son un segundo backlog y nunca escriben las autoridades.

## Estados

- `proposed`: candidato todavía incompleto o pendiente de auditoría.
- `ready`: especificación completa, sin decisiones ni dependencias pendientes.
- `blocked`: especificación conocida pero impedida por una dependencia o
  decisión explícita.
- `in_progress`: única tarea activa de implementación.
- `done`: aceptación y verificación satisfechas.
- `deferred`: fuera del horizonte actual por una razón registrada.

## Avance dinámico

El ciclo preferido es seleccionar una tarea elegible, ejecutarla, verificarla y
cerrarla antes de abrir otro frente. La concurrencia es deliberada: cada agente
declara su frontera y un único integrador conserva responsabilidad por el
resultado completo.

Cuando una tarea `blocked` ya tiene todas sus dependencias en `done` y no tiene
`decisionsRequired`, el control la expone como candidata a transición
`blocked → ready`. Esa derivación es read-only: la fuente canónica debe cambiarse
mediante una promoción explícita y validada antes de iniciar trabajo.

Las decisiones de producto, cambios de prioridad o alcance, excepciones,
operaciones destructivas o remotas y releases de alto riesgo no se derivan ni se
delegan: requieren autoridad humana explícita.

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
