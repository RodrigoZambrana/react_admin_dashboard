# AI Harness del producto

Marco de trabajo independiente para retomar y evolucionar este repositorio con
asistencia de IA. Está inspirado en las prácticas útiles del harness de origen,
pero no es una instalación, copia sincronizada ni enlace a otro repositorio.

## Qué conserva

- contexto progresivo y reglas por alcance;
- una tarea coherente por sesión;
- checkpoints reanudables;
- verificación proporcional y basada en evidencia;
- separación entre exploración, implementación y cierre.
- auditoría read-only de pendientes, requerimientos, decisiones y alineamiento.
- avance desde un backlog único con vistas por producto y promoción gobernada.

## Qué se adaptó

- TypeScript/JavaScript en lugar de Java/Maven;
- workspaces reales: NestJS/Fastify/Prisma, React/Vite, Next.js, Jest, Vitest,
  Playwright, Node Test Runner y Docker Compose;
- productos y fronteras propios del sistema;
- operación local sin Zoho, Ghost Inspector ni actualización desde un harness
  externo;
- separación gradual de productos mediante contratos, no por movimientos de
  carpetas prematuros.

## Entrada rápida

```bash
npm run harness:doctor
npm run harness:progress
npm run harness:control
npm run harness:audit
npm run harness:lifecycle -- recover
npm run --silent harness:control -- --json
npm run harness:verify -- --scope changed --level quick
```

El mapa ejecutable vive en `config/project.json`. El estado reanudable del
producto vive en `ai-harness-local/`.

Las aperturas y cierres gobernados usan `harness:lifecycle start`, `preclose` y
`close`. Estas transiciones fijan contexto Git y write-set, validan evidencia y
diff. `close` crea un commit local con un index aislado y solo publica
`done`/`idle` después de verificarlo; un fallo restaura archivos, HEAD e index.
No hace push, merge, cambio de branch ni operaciones remotas. El contrato
completo está en `docs/lifecycle.md`.

La matriz `ai-harness-local/control/capabilities.json` es explícita: este
harness todavía no declara paridad general con LACNIC. Las integraciones y
controles particulares excluidos están documentados; las brechas aplicables
permanecen como capacidades parciales o planificadas.

`npm run harness:audit` produce el informe humano del auditor con las seis
secciones obligatorias. El orden, unicidad, contenido mínimo y resultado único
se validan contra `ai-harness-local/control/response-contract.json`. Un auditor
en `setup_pending`, una plantilla inválida o una fuente inconsistente bloquean
la recomendación ejecutable.

La sexta sección incluye un handoff explícito: `NEW_CHAT`,
`CONTINUE_EXISTING_TASK` o `NONE`. Para una recomendación ejecutable también
incluye el prompt completo derivado por el control, listo para copiar en el
destino indicado y nunca para ejecutar dentro del chat auditor. Cuando una tarea
`blocked` ya satisface dependencias y decisiones, el control recomienda
`PROMOTE`/`NONE` sin mutar el backlog.
