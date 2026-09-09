# Intake, slicing y promoción gobernada

`harness:intake` convierte un pedido en un documento validable antes de editar
producto. El pedido humano es la fuente inicial; el comando no inventa
respuestas ni crea una segunda cola de trabajo.

## Flujo

1. Estructurar el pedido en `need`, hechos, supuestos, preguntas y requisitos
   materiales.
2. Cortar slices verticales con un solo resultado terminable, producto dueño,
   alcance y gate.
3. Trazar cada slice a una tarea de `planning/backlog.json`.
4. Validar fidelidad y el diff semántico requisito→tarea.
5. Si hay un bloqueo obsoleto, el harness escribe `blocked → ready` cuando el
   cálculo es verdadero. Las personas no confirman ese DAG.

```bash
npm run harness:intake -- --file path/to/intake.json
npm run harness:intake -- promotions
npm run harness:intake -- apply-promotion --id HAR-004 --dry-run
npm run harness:intake -- apply-promotion --id HAR-004
```

El pedido extenso de verificación vive en
`harness/tests/fixtures/intake/long-commerce-metrics-request.md`.

`promotions` es read-only. `apply-promotion --dry-run` solo previsualiza.
`apply-promotion` escribe la transición `blocked → ready` en el backlog canónico
y el fragmento dueño, sin `--confirm` humano. No ejecuta `lifecycle start`.
`--start` está prohibido y falla cerrado.

## Clasificación

- `fact`: observado y anclado al pedido.
- `assumption`: explícito; no se trata como decisión aceptada.
- `question`: bloquea `ready` hasta `answeredBy: "human"`. Cualquier otra
  respuesta se rechaza como inferencia.

## Slices

Cada slice declara `result`, `scope.in`, `scope.out`, `product` y `gate`.
Requisitos de distinto producto o `cluster` no comparten slice salvo
`sharedTransaction: true`. El comando recomienda un solo próximo slice para
terminar un frente antes de abrir otro.

## Fidelidad

El pedido puede listar requisitos bajo `## Requisitos materiales`. Cada línea
debe conservarse en `requirements[]` y cada requisito material debe pertenecer
a un slice. `sourceSpan` tiene que aparecer en el cuerpo del pedido.

Un cambio de alcance se registra en `scopeChanges` como `decision` o
`supersession`. No se agrega trabajo “de yapa”.

## Autoridad

El intake no es un backlog. `alternateBacklog` y `tasks` paralelos fallan. Las
vistas general y por producto se reconstruyen desde la cola canónica. El schema
vive en `schemas/intake.schema.json`. `lifecycle` start/close sincroniza el
fragmento dueño cuando esa ruta está en el write-set. `close` aplica las
promociones elegibles al backlog y al fragmento dueño si está en el write-set.
El arranque sigue siendo `lifecycle start` o un chat nuevo.
