# Changelog

## 0.5.0 — 2026-09-08

- `close` crea y verifica un commit local aislado antes de publicar
  `done`/`idle`.
- El commit contiene solo el candidato de preclose y los artefactos finales;
  preserva cambios e index preexistentes fuera del write-set.
- El journal recupera archivos, HEAD e index ante fallo o interrupción del
  commit, también en linked worktrees.
- Los recibos v2 incluyen parent, mensaje, rutas y manifiesto verificable del
  candidato comprometido.
- El control falla cerrado si hay una consolidación lifecycle pendiente.

## 0.4.1 — 2026-09-08

- Detecta tareas `blocked` con dependencias terminadas y sin decisiones
  pendientes, y deriva una recomendación `PROMOTE` sin mutar autoridades.
- Agrega vistas del backlog por producto y conserva el orden de recomendación
  para promociones y tareas `ready`.
- Formaliza el avance dinámico gobernado, la coordinación reproducible y los
  límites de autoridad humana en `DEC-010`, REQ-007, REQ-009 y sus tareas.
- Promueve HAR-003 a `ready` después de verificar que HAR-002 está `done` y que
  no existe otro gate pendiente.

## 0.4.0 — 2026-09-08

- Agrega `harness:lifecycle start|preclose|close|recover` con transacciones
  multiarchivo y journal por checkout.
- Fija baseline, branch, worktree, cambios preexistentes y write-set, y rechaza
  drift Git o cambios fuera de alcance.
- Preclose exige evidencia completa y emite un diff receipt; close actualiza
  backlog, feature, checkpoint, historia y recibos o revierte todo.
- Incorpora schemas, documentación y pruebas con repositorios limpios, sucios,
  linked worktrees e inyección de fallos.

## 0.3.2 — 2026-09-08

- La recomendación auditora declara si el trabajo debe comenzar en un chat
  nuevo o continuar en una tarea de implementación existente.
- La sexta sección incluye el prompt gobernado completo en un bloque copiable.
- El validador compara el handoff y el prompt contra el reporte fuente y rechaza
  omisiones, alteraciones o ejecución dentro del chat auditor.

## 0.3.1 — 2026-09-08

- Corrige el cierre de `HAR-001` vinculándolo con una tarea Codex real y
  verificada.
- Agrega un contrato ejecutable para las seis secciones del Chat de Auditoría y
  Control.
- El control falla cerrado ante `setup_pending`, identidad inválida o plantilla
  incompatible y genera una respuesta humana validada.

## 0.3.0 — 2026-09-08

- Matriz verificable de capacidades y auditoría explícita de paridad LACNIC.
- Perfil read-only de auditoría y control con reporte estructurado.
- Cobertura trazable de requerimientos y guardrails de decisiones estratégicas.
- Recomendación única con prompt derivado y fingerprint de autoridades.
- Pruebas de reconstrucción, fuentes ausentes y desvío de dependencias.

## 0.2.0 — 2026-09-08

- Contrato y validador de backlog con dependencias y decisiones.
- Registro local de decisiones aceptadas y supersedidas.
- Feature list, checkpoint humano/máquina y reglas específicas del producto.
- Catálogo inicial de regresión y política de coordinación entre agentes.
- Ensamblado determinista del backlog canónico desde auditorías por producto.

## 0.1.0 — 2026-09-08

- Bootstrap independiente adaptado al monorepo TypeScript/JavaScript.
- Router de contexto, diagnóstico, progreso y verificación por producto.
- Auditoría general, arquitectura objetivo y plan maestro inicial.
