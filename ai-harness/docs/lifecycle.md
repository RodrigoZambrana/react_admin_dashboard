# Lifecycle gobernado

`harness:lifecycle` aplica cuatro operaciones sobre una única tarea:

1. `start` abre una tarea `ready`, fija HEAD, branch, worktree, alcance y
   write-set, clasifica los cambios preexistentes y cambia backlog, feature y
   checkpoint como una sola transacción.
2. `preclose` exige evidencia positiva para cada criterio de aceptación y cada
   verificación, comprueba branch/baseline y rechaza cambios nuevos fuera del
   write-set. Su diff receipt queda dentro del checkpoint.
3. `close` vuelve a calcular el candidato, rechaza cambios posteriores a
   preclose y actualiza backlog, feature, checkpoint, historia y ambos recibos
   como una sola transacción.
4. `recover` restaura los bytes anteriores cuando quedó un journal por una
   interrupción de proceso.

Si el candidato cambia deliberadamente después de preclose, se vuelve a
ejecutar `preclose` con evidencia actualizada antes de intentar `close`.

## Apertura

Cada ruta se declara con `--write-set`. Una ruta terminada en `/` cubre el
subárbol. El comando exige que el write-set incluya sus propias fuentes de
estado y rechaza cambios preexistentes que las solapen.

```bash
npm run harness:lifecycle -- start \
  --task HAR-002 \
  --expected-head 8cfb3c43352a9df050e2141ad1082b84da26af23 \
  --expected-branch feature/ai-conversational-platform-standalone \
  --expected-fingerprint cd4ad283385aa7b509dbb96ac0d4231ab568178b6efbd25f542d3c9e5f259e38 \
  --write-set ai-harness/ \
  --write-set ai-harness-local/ \
  --write-set planning/backlog.json \
  --write-set package.json
```

El fingerprint es opcional para uso local, pero debe pasarse cuando la apertura
proviene del handoff del auditor. En ese caso `start` reconstruye el control y
falla cerrado si la autoridad cambió.

## Evidencia de preclose

El archivo debe satisfacer
`schemas/preclose-evidence.schema.json`. `requirement` copia literalmente cada
entrada del backlog y no admite omisiones, duplicados ni estados distintos de
`passed`.

```json
{
  "schema": "ai-harness.preclose-evidence/v1",
  "taskId": "HAR-002",
  "acceptance": [
    {
      "requirement": "Criterio literal del backlog.",
      "status": "passed",
      "evidence": "Prueba o inspección que lo demuestra."
    }
  ],
  "verification": [
    {
      "requirement": "Verificación literal del backlog.",
      "status": "passed",
      "evidence": "Comando y resultado observado."
    }
  ]
}
```

```bash
npm run harness:lifecycle -- preclose --evidence /ruta/a/evidence.json
npm run harness:lifecycle -- close --summary "Resultado durable del cierre."
```

Ningún comando crea commits, cambia branch, usa stash, resuelve conflictos ni
contacta remotos.

## Atomicidad y recovery

Antes de escribir, la transición guarda un journal con los bytes originales en
el directorio Git específico del checkout o linked worktree. Cada archivo se
reemplaza por rename atómico. Un fallo controlado restaura todos los originales;
una interrupción abrupta conserva el journal y bloquea nuevas transiciones hasta
ejecutar:

```bash
npm run harness:lifecycle -- recover
```

Recovery solo toca las rutas exactas registradas en ese journal. Los recibos de
cierre viven bajo `ai-harness-local/receipts/<año>/<fecha>/` y
`ai-harness-local/features/done/<año>/`; `close` nunca sobrescribe uno existente.
