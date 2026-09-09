# Auditoría de capacidades del AI Harness

Fecha de corte: 2026-09-08

Referencias inspeccionadas:

- LACNIC `ai-harness`, commit
  `610b7d1655bfdcf88b9f4b01ba4bfdfedc896648`;
- ATI `harness-academico`, commit
  `abb0f39a4092fcacfd959a98b474e3a2e6dbfc06`;
- harness local `0.2.0` previo a `HAR-001`.

## Veredicto

El harness local previo a esta tarea **no tenía al menos las mismas capacidades
generales que el harness LACNIC**. Había adaptado correctamente sus principios
centrales —router, backlog, decisiones, checkpoint, verificación por producto y
versionado—, pero varias capacidades solo existían como reglas manuales o no
existían.

El número de archivos no se usa como medida de paridad. Una capacidad se
considera implementada solo cuando tiene mecanismo ejecutable, validación,
prueba y evidencia local. El estado estructurado vigente está en
`ai-harness-local/control/capabilities.json`.

## Comparación funcional

| Capacidad general | Referencia LACNIC | Estado local tras HAR-001 | Brecha principal |
| --- | --- | --- | --- |
| Router progresivo | `AGENTS.md`, project context | Implementada | Falta cápsula generada para handoffs extensos. |
| Configuración por consumidor | manifiestos y doctor | Implementada | Ownership nominal pendiente. |
| Intake y slicing | story intake, work plan, skills | Parcial | Sin comando/schema ni prueba de fidelidad. |
| Backlog y estado de tarea | feature list y checks | Implementada y ampliada | Faltan transiciones atómicas. |
| Start/preclose/close | scripts con guards y recibos | Parcial/manual | No existen comandos de lifecycle. |
| Preflight Git y write-set | `git-preflight` | Parcial | No fija baseline/write-set ni emite diff receipt. |
| Context capsule y handoff | `agent context/handoff` | Planificada/parcial | Sin schemas, fingerprints ni lifecycle. |
| Verificación por nivel | verification workflows | Parcial | Sin recibos de ejecución ni release certificado. |
| Testing gobernado | sesiones, DSL, catálogo, baseline | Parcial | Solo existe catálogo y comandos por workspace. |
| Revisión independiente | reglas, candidato y cierre | Planificada | Sin fingerprint completo ni recibo semántico. |
| Doctor/runtime | doctor y runtime local | Parcial | Falta lifecycle y health real de servicios. |
| Bugfix productivo | workflow especializado | Planificada | Sin circuito de incidente/reproducción/release. |
| Skills por trabajo | catálogo y validación de skills | Planificada | No hay skills locales del proyecto. |
| Versionado del framework | versión, health y upgrades | Parcial | Falta migración/compatibilidad automatizada. |
| Auditor de control | no es el foco principal | Implementada en HAR-001 | Juicio semántico sigue siendo humano. |

## Exclusiones justificadas

No son requisitos de paridad local:

- Java, Maven y guards de `pom.xml`;
- Zoho Sprints y procesos organizacionales LACNIC;
- Ghost Inspector como proveedor específico;
- evaluación/onboarding de integrantes LACNIC;
- sincronización con un repositorio central del framework, porque esta versión
  debe ser propia e independiente.

Playwright, CI, proveedores de seguimiento o servicios externos no se descartan
para siempre: se incorporan cuando una necesidad local los justifica, con
contrato, secretos, fallback y prueba de recuperación propios.

## Capacidad incorporada en HAR-001

El perfil `harness-control` toma del harness académico la separación entre:

- hechos calculados desde Git y fuentes versionadas;
- discrepancias y alertas;
- decisiones que siguen siendo humanas;
- recomendaciones derivadas sin autoridad.

El comando `npm run --silent harness:control -- --json` reconstruye en vivo:

- HEAD, branch y cambios locales;
- versión y matriz de capacidades;
- cantidades y estado del backlog;
- cobertura de los requerimientos iniciales;
- coherencia entre backlog, decisiones, feature list y checkpoint;
- cumplimiento de dependencias estratégicas de separación, campañas e IA;
- única próxima tarea elegible y prompt derivado.

También deriva vistas por producto desde la cola única y detecta tareas
`blocked` con dependencias terminadas y sin decisiones pendientes. En ese caso
señala una promoción explícita según el orden de gobierno, sin modificar las
fuentes ni iniciar el trabajo.

Falla cerrado si falta una autoridad, una referencia no existe o el estado es
inconsistente. El chat auditor usa ese reporte; no conserva estado alternativo.

## Camino hacia paridad general

1. **HAR-002 — Lifecycle y preflight:** start/preclose/close, baseline,
   write-set, commit local aislado, recovery Git y recibos.
2. **HAR-003/HAR-004 — Intake y contexto:** fidelidad de requerimientos,
   slicing, cápsulas y handoffs con fingerprints.
3. **HAR-005 — Revisión independiente:** manifiesto de candidato y recibo
   semántico.
4. **HAR-006/HAR-007 — Testing y runtime:** definiciones, ejecuciones,
   baselines, health y recuperación adaptados a
   Node/TypeScript/PostgreSQL/Redis/Qdrant.
5. **HAR-008 — Workflows especializados:** skills de incidente productivo,
   refactor, review, testing y extracción.
6. **HAR-009 — Gate de paridad:** ninguna capacidad aplicable queda `PLANNED`; las
   `PARTIAL` tienen límites aceptados y evidencia suficiente o se completan.

Hasta satisfacer ese gate, el harness no debe describirse como equivalente al
de LACNIC. Sí puede describirse como independiente, adaptado, gobernado y con
una ruta explícita hacia esa equivalencia.
