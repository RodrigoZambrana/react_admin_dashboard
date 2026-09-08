# Estado local del producto

Esta carpeta conserva el contexto específico de este producto sin depender de
una conversación ni del harness externo que sirvió como referencia.

Contenido versionado:

- `feature_list.json`: índice operativo pequeño; solo una tarea puede estar
  `in_progress`.
- `progress/current.json`: estado canónico legible por herramientas.
- `progress/current.md`: checkpoint humano detallado de la sesión.
- `progress/history.md`: cierres append-only.
- `decisions/index.json`: decisiones y acuerdos estables, con supersesión
  explícita en lugar de reescritura silenciosa.
- `custom-project-agent/`: reglas locales de arquitectura, producto, datos,
  seguridad y runtime.
- `testing/regression/catalog.json`: inventario de suites existentes.
- `control/`: matriz de capacidades, cobertura de requerimientos, guardrails,
  tarea confirmada y contrato durable de respuesta del auditor read-only.

Los secretos, handoffs, runs y evidencia voluminosa están ignorados por Git.
Una tarea nueva debe poder reconstruirse usando esta carpeta, el backlog y el
código, sin requerir el chat donde se originó.

El estado global se consulta con `npm run harness:control`; el informe humano de
seis secciones se genera con `npm run harness:audit`. Ambos resultados son una
proyección calculada y nunca sustituyen al backlog, decisiones o checkpoint.
