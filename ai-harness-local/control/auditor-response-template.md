## 1. Validez y frescura del control

- Informar `validation`, `freshness`, fecha de generación y si las fuentes son verificables.

## 2. Estado global y pendientes

- Informar versión y paridad del harness, backlog por estado, requerimientos y cursor operativo.

## 3. Alineamiento con acuerdos y planificación

- Informar el estado global y cada guardrail relevante con su evidencia.

## 4. Desvíos, evidencia faltante y sobredeclaraciones

- Separar alertas no bloqueantes de discrepancias que invalidan la recomendación.
- Si hay candidatos `blocked → ready`, informarlos como escritura pendiente del
  harness. No pedir que una persona confirme ese cálculo.

## 5. Decisiones humanas requeridas

- Enumerar decisiones abiertas e indicar cuáles bloquean específicamente la recomendación.
- Reservar a personas prioridad, alcance, excepciones y el arranque de trabajo.
- No listar la promoción mecánica como decisión humana.

## 6. Única próxima tarea recomendada

- Recomendar exactamente una tarea elegible con acción, propósito y motivo, o declarar la recomendación bloqueada.
- Indicar `NEW_CHAT`, `CONTINUE_EXISTING_TASK` o `NONE` como destino.
- Para `START`, indicar que se debe crear un chat de implementación nuevo.
- Para `CONTINUE`, identificar la sesión activa que debe retomarse.
- No emitir `PROMOTE` humano ni pedir aprobación de `blocked → ready`.
- Para `START` o `CONTINUE`, incluir íntegramente
  `recommendation.prompt.content` en un bloque `text` copiable. El auditor nunca
  ejecuta ese prompt dentro de su propio chat.
