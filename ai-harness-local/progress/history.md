# Historial del harness

## 2026-09-08 — Fundación

- Se incorporó un harness independiente y específico del repositorio.
- Se estableció un baseline ejecutable de tests, builds y seguridad.
- Se documentó la arquitectura objetivo y el plan de separación gradual.
- Próxima prioridad: seguridad y cierre operativo de ecommerce.

## 2026-09-08 — Auditoría integral y backlog gobernado

- Se preservó el estado previo en el commit `1407e5e2` antes del discovery.
- Se auditaron plataforma, ecommerce, métricas e IA/canales sin implementar
  funcionalidades.
- Se registraron necesidades y decisiones pendientes sin inferir respuestas de
  negocio.
- Se consolidó y validó un backlog de 121 tareas: 12 `ready`, 83 `blocked` y 26
  `proposed`.
- La próxima selección recomendada es `PF-001`; la remediación técnica de
  seguridad continúa bloqueada hasta cerrar threat models, gates y alcance.

## 2026-09-08 — Paridad y Chat de Auditoría y Control

- Se comprobó que el harness 0.2.0 no tenía paridad general con LACNIC y se
  registraron capacidades implementadas, parciales, planificadas y excluidas.
- Se incorporó `harness-control` 0.3.0 para reconstruir backlog, requerimientos,
  decisiones, capacidades, Git y alineamiento sin modificar producto.
- El control falla cerrado ante fuentes ausentes o guardrails estratégicos
  rotos y produce una única recomendación derivada.
- Se creó la tarea Codex `Auditoría y Control — Growth Platform` con perfil
  read-only y prompt durable.
- Próxima tarea recomendada por el control: `HAR-002`; `PF-001` permanece como
  primer paso de producto después del programa de paridad del harness.

## 2026-09-08 — Reapertura correctiva de HAR-001

- Se detectó que el cierre declaraba creada la tarea auditora mientras su
  registro seguía en `setup_pending` con un identificador provisional.
- Se reabrió `HAR-001` y se bloqueó temporalmente `HAR-002` para evitar una
  recomendación basada en evidencia incompleta.
- La corrección queda limitada a verificar la tarea real, formalizar y validar
  el formato obligatorio de seis secciones y reconstruir el cierre.

## 2026-09-08 — Cierre corregido de HAR-001

- Se confirmó la tarea Codex `Auditoría y Control — Growth Platform` mediante
  `codex.read_thread` y se registró su `threadId` real.
- Se agregó un contrato versionado, una plantilla y un generador validado para
  las seis secciones obligatorias del informe.
- El control ahora falla cerrado ante `setup_pending`, identidad incompleta o
  una plantilla incompatible.
- La implementación y la auditoría consolidada quedaron registradas en el
  commit `46e382d57176d480c9711f411a2ccfa92f124238`.
- `HAR-001` vuelve a `done`; la próxima recomendación debe reconstruirse desde
  el control y no desde este historial.

## 2026-09-08 — Renovación del Chat de Auditoría y Control

- Se creó una nueva tarea local `Auditoría y Control — Growth Platform` con
  acceso directo al checkout canónico y perfil estrictamente read-only.
- La primera auditoría respetó las seis secciones del contrato y recomendó una
  única tarea a partir del control vigente.
- El nuevo `threadId` quedó registrado en `control/auditor-task.json`; la tarea
  anterior se conserva allí como sustituida para mantener trazabilidad.

## 2026-09-08 — Handoff ejecutable del auditor

- Se corrigió la sexta sección para indicar si corresponde `NEW_CHAT`,
  `CONTINUE_EXISTING_TASK` o `NONE`.
- Toda recomendación ejecutable incluye ahora el prompt gobernado completo y
  copiable; el auditor no lo ejecuta dentro de su propio chat.
- El validador comprueba que el destino corresponda a `START`/`CONTINUE` y que
  el prompt coincida exactamente con el reporte fuente.

## 2026-09-08 — HAR-002: Automatizar lifecycle y preflight Git

- Lifecycle atómico implementado con baseline, branch, write-set, evidencia Git, rollback y recovery verificados en repositorios temporales.
- Baseline: `8cfb3c43352a9df050e2141ad1082b84da26af23`; HEAD al cierre: `8cfb3c43352a9df050e2141ad1082b84da26af23`; branch: `feature/ai-conversational-platform-standalone`.
- Preclose validó 4 criterios, 1 verificaciones y 21 rutas del write-set.
- Recibo: `ai-harness-local/receipts/2026/2026-09-08/harness-lifecycle-git-20260908.json`.

## 2026-09-08 — PF-001: Definir modelo de producto, tenancy y primer piloto

- Modelo híbrido aprobado en ADR-009; UruCortinas queda como piloto dedicado con Rodrigo responsable, ownership de configuración y consecuencias por producto verificadas contra Prisma y Docker.
- Baseline: `93083f6fe616e4d9a0ea4f2ea795fb295b5de5a7`; HEAD al cierre: `93083f6fe616e4d9a0ea4f2ea795fb295b5de5a7`; branch: `feature/ai-conversational-platform-standalone`.
- Preclose validó 3 criterios, 1 verificaciones y 12 rutas del write-set.
- Recibo: `ai-harness-local/receipts/2026/2026-09-08/platform-tenancy-pilot-20260908.json`.

## 2026-09-08 — Corrección de promoción y avance dinámico del harness

- Se corrigieron los fragmentos fuente para conservar HAR-002 y PF-001 en
  `done` después de reensamblar el backlog.
- HAR-003 pasó de `blocked` a `ready` al verificar que HAR-002 está `done` y que
  no existen otras dependencias ni decisiones pendientes.
- `DEC-010` formalizó backlog único con vistas por producto, coordinación
  reproducible, promoción read-only y foco en cerrar resultados.
- El control detecta bloqueos obsoletos y recomienda una transición explícita
  sin mutar autoridades ni comenzar la tarea.

## 2026-09-08 — Autorización de commit local en close

- `DEC-011` autoriza al lifecycle a crear un commit local aislado con las rutas
  exactas validadas por preclose y los artefactos finales de cierre.
- Una tarea solo alcanza `done`/`idle` después de crear y verificar el commit.
- El journal recupera HEAD, index, working tree y autoridades ante fallo o
  interrupción; el control bloquea `START` mientras exista consolidación
  pendiente.
- La autorización excluye push, merge, cambio de branch y operaciones remotas.

## 2026-09-09 — HAR-003: Estructurar intake, trazabilidad y slicing

- Intake, slicing y promoción gobernada sobre el backlog canónico, con pruebas adversas de pérdida/mezcla y vistas general/por producto sin autoridad paralela.
- Baseline: `389d93911a0749f3d06dea476c2f52470ecb7096`; HEAD previo al commit de cierre: `389d93911a0749f3d06dea476c2f52470ecb7096`; branch: `feature/ai-conversational-platform-standalone`.
- Preclose validó 6 criterios, 1 verificaciones y 29 rutas del write-set.
- El cierre exige un commit local aislado con trailer `AI-Harness-Session: har-003-20260909122155`.
- Recibo: `ai-harness-local/receipts/2026/2026-09-09/har-003-20260909122155.json`.
