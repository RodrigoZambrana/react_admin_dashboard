# Lifecycle gobernado

`harness:lifecycle` aplica cuatro operaciones sobre una única tarea:

1. `start` abre una tarea `ready`, fija HEAD, branch, worktree, alcance y
   write-set, clasifica los cambios preexistentes y cambia backlog, feature y
   checkpoint como una sola transacción.
2. `preclose` exige evidencia positiva para cada criterio de aceptación y cada
   verificación, comprueba branch/baseline y rechaza cambios nuevos fuera del
   write-set. Su diff receipt queda dentro del checkpoint.
3. `close` vuelve a calcular el candidato, rechaza cambios posteriores a
   preclose, prepara backlog, feature, checkpoint, historia y ambos recibos, y
   crea un commit local aislado. Solo después del commit la tarea queda
   `done`/`idle`.
4. `recover` restaura archivos, HEAD e index cuando quedó un journal por una
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

`close` crea un único commit local autorizado por `DEC-011`. Usa un index
temporal construido desde el HEAD observado y agrega exclusivamente:

- las rutas del candidato comprobado por `preclose`;
- las fuentes de estado y recibos finales producidos por `close`.

Los cambios preexistentes fuera del write-set permanecen en su estado original,
incluido cualquier contenido que ya estuviera staged. El recibo v2 registra el
parent, mensaje, trailer de sesión, rutas y manifiesto SHA-256 del candidato; los
dos recibos se excluyen de su propio manifiesto para evitar autorreferencia, pero
sí forman parte de las rutas comprometidas.

El lifecycle no hace push, merge, cambio de branch, stash, resolución de
conflictos ni otra operación remota.

## Atomicidad y recovery

Antes de escribir, la transición guarda un journal con los bytes originales en
el directorio Git específico del checkout o linked worktree. Para `close`
conserva además el HEAD, la referencia de branch y el index real. Cada archivo se
reemplaza por rename atómico. Un fallo controlado restaura referencia, index y
archivos; una interrupción abrupta conserva el journal y bloquea nuevas
transiciones y recomendaciones `START` hasta ejecutar:

```bash
npm run harness:lifecycle -- recover
```

Recovery solo toca la referencia, el index y las rutas exactas registradas en
ese journal. Los recibos de cierre viven bajo
`ai-harness-local/receipts/<año>/<fecha>/` y
`ai-harness-local/features/done/<año>/`; `close` nunca sobrescribe uno existente.
