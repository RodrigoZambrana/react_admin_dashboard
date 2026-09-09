# Contrato de backlog

`planning/backlog.json` es la fuente ejecutable de tareas. Un documento de
roadmap explica dirección; el backlog decide qué puede comenzar.

El archivo canónico se ensambla de forma determinista desde los fragmentos por
producto en `planning/fragments/`. Los fragmentos permiten auditorías paralelas;
el resultado combinado sigue siendo una única cola gobernada.

El control deriva de esa misma cola los totales generales, las vistas por
`product`, el orden recomendado y las transiciones elegibles. Estas proyecciones
no son un segundo backlog y nunca escriben las autoridades.

`harness:intake apply-promotion --confirm` y `harness:lifecycle` start/close
actualizan el JSON canónico y, si el fragmento dueño está en el write-set o en
el alcance de la promoción, también ese fragmento. Así la vista general y la de
producto se reconstruyen sin una segunda autoridad.

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
`decisionsRequired`, el control y `harness:intake promotions` la exponen como
candidata a transición `blocked → ready`. Esa derivación es read-only: la fuente
canónica se cambia solo con `harness:intake apply-promotion --id <ID> --confirm`.
Esa escritura no inicia la tarea. El control nunca muta autoridades.

Un pedido se convierte en requisitos y slices con `harness:intake`. Los slices
se trazan a tareas del backlog canónico; no crean una cola paralela. Un cambio
de alcance queda como `decision` o `supersession`.

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
