# Auditoría transversal de plataforma

Fecha de corte: 2026-09-08

## Alcance

Gobernanza, estructura del repositorio, CI/CD, seguridad, calidad, contratos,
multi-tenancy, configuración, portabilidad y preparación para separar productos.
No incluye implementación funcional.

## Estado observado

### Repositorio y toolchain

- Hay seis lockfiles independientes: raíz, backend, frontend, ecommerce,
  AI Platform y Channel Adapter.
- El `package.json` raíz orquesta QA, pero no declara workspaces; AI Platform sí
  usa workspaces internos.
- El stack combina NestJS/Fastify/Prisma, React/Vite, Next.js, Jest, Vitest,
  Playwright, PostgreSQL, Redis y Qdrant.
- El backend principal tiene 36 migraciones y AI Platform 18; ambos poseen
  esquema y base propios.
- No se observaron imports relativos directos entre raíces de aplicaciones,
  pero admin y storefront importan código fuente desde `src/common` mediante
  alias. Esa carpeta raíz es un acoplamiento sin package/versionado explícito.

### Integración continua

- Solo existe un workflow GitHub Actions: `analytics-health.yml`.
- Ese workflow instala, migra, construye y prueba el health de analytics del
  backend en pushes a `main/master` y pull requests.
- No existe evidencia de CI equivalente para storefront, admin, AI Platform,
  Channel Adapter, E2E commerce o el harness.
- El README describe una automatización CI/CD más amplia que no está presente en
  `.github/workflows`; esa documentación no puede tratarse como estado actual.

### Calidad

- Tests encontrados: backend 54 archivos, frontend 7, ecommerce 61, AI Platform
  91 y Channel Adapter 7.
- Ninguna configuración observada define umbrales de cobertura.
- Admin y ambos componentes de AI Platform usan TypeScript `strict`.
- Backend habilita `strictNullChecks` pero no `strict`; storefront declara
  `strict: false`, `allowJs: true` y target ES5.
- Existen hotspots que impiden ownership claro: `knowledge.service.ts` supera
  11.000 líneas, `ConversationsV2.tsx` 7.500, `storefront.service.ts` 7.200,
  `chat-response-policy.service.ts` 5.400 y varios controladores/servicios
  superan 2.500–4.000 líneas.
- AI Platform versiona una gran cantidad de assets vendor y source maps; el
  storefront conserva datasets y templates legacy muy voluminosos.

### Seguridad

El 2026-09-08 se ejecutó `npm audit --json` sin modificar dependencias:

| Producto | Total | Critical | High | Moderate | Low |
| --- | ---: | ---: | ---: | ---: | ---: |
| Backend | 34 | 0 | 23 | 10 | 1 |
| Admin | 23 | 0 | 9 | 9 | 5 |
| Storefront | 16 | 1 | 10 | 5 | 0 |
| AI Platform | 24 | 0 | 12 | 10 | 2 |
| Channel Adapter | 6 | 2 | 3 | 1 | 0 |

Son hallazgos por dependencia reportados por npm, no una afirmación de
explotabilidad. Los critical directos incluyen Next.js en storefront y Baileys
en Channel Adapter; `protobufjs` aparece critical de forma transitiva.

El security loop actual solo conoce `frontend` y `backend`. Storefront,
AI Platform y Channel Adapter no forman parte de su gate, aunque contienen los
hallazgos más severos. Tampoco se observó un scanner de secretos/SAST integrado
en CI.

### Multi-tenancy y configuración

- AI Platform modela `tenantId` ampliamente y tiene pruebas de políticas de
  aislamiento.
- Analytics y SEO incluyen tenant scope en partes del esquema principal.
- El core commerce sigue resolviendo comportamiento mediante `CLIENT_SLUG` a
  nivel de proceso y contiene ramas específicas de `urucortinas`.
- No existe una definición única del modelo de tenancy para commerce completo.
  En su estado actual parece más cercano a despliegues configurados por cliente
  que a un SaaS multi-tenant compartido.
- Antes de generalizar o separar servicios debe decidirse el modelo SaaS,
  dedicado o híbrido.

### Contratos y separación

- No se encontró una especificación OpenAPI propia para las APIs principales.
- Hay contratos documentales de mensajería y normalización, pero no un registro
  transversal versionado para APIs/eventos entre productos.
- Commerce, CRM y analytics comparten el esquema Prisma principal.
- AI Platform posee datos propios pero aún coexiste con modelos conversacionales
  legacy en el backend principal.
- La topología Docker ya demuestra algunos runtimes separables, pero despliegue
  independiente no equivale todavía a producto independiente.

### Portabilidad y documentación

- Se detectaron 299 archivos de texto con rutas absolutas relacionadas con el
  entorno personal; muchas aparecen en documentación/reportes históricos.
- Hay 91 documentos en la raíz de `docs/`, además de documentación interna por
  producto.
- La documentación mezcla decisiones vigentes, planes, reportes generados y
  cierres históricos sin metadata uniforme.
- Existen backups binarios/SQL y `.bak` versionados. Deben clasificarse y
  migrarse a almacenamiento apropiado antes de eliminarlos del historial
  futuro.

## Necesidades transversales

1. Modelo de producto/tenancy decidido y registrado.
2. Catálogo de productos, bounded contexts, datos y dependencias.
3. Contratos API/eventos versionados y testeados.
4. CI mínimo para cada producto y un gate de integración del sistema.
5. Security loop que cubra todos los lockfiles y threat models por riesgo.
6. Estándares progresivos de TypeScript, lint, cobertura y complejidad.
7. Plan de descomposición de hotspots basado en responsabilidades y regresiones.
8. Política documental canonical/reference/archive y eliminación de rutas
   personales.
9. Estrategia de configuración, secretos, ambientes, observabilidad y recovery.
10. Gates automáticos de backlog para impedir implementación sin especificación.

## Candidatos de backlog transversal

### PF-001 — Cerrar decisiones de producto y tenancy

- Objetivo: resolver el modelo SaaS/dedicado/híbrido y el primer tenant piloto.
- Incluye: workshop/ADR, ownership de configuración y criterios de aislamiento.
- Excluye: migraciones o cambios de código.
- Dependencias: ninguna.
- Aceptación: decisión aprobada; implicancias por producto documentadas.
- Verificación: ADR enlazado desde arquitectura y backlog desbloqueado.

### ARC-001 — Inventario de bounded contexts y ownership de datos

- Objetivo: asignar cada módulo/tabla a un producto objetivo.
- Incluye: backend principal, AI Platform y dependencias compartidas.
- Excluye: mover carpetas/tablas.
- Dependencias: PF-001.
- Aceptación: ninguna tabla crítica tiene ownership ambiguo; duplicaciones
  legacy están marcadas con estrategia de retiro.
- Verificación: matriz validada contra ambos schemas Prisma.

### ARC-002 — Registro versionado de contratos

- Objetivo: definir el mecanismo canónico para APIs, eventos y schemas.
- Incluye: versionado, compatibilidad, generación/tests y owner.
- Excluye: diseñar todos los endpoints funcionales.
- Dependencias: ARC-001.
- Aceptación: convención aprobada y un contrato representativo validado.
- Verificación: consumer/contract test en CI.

### QA-001 — Matriz de calidad y release por producto

- Objetivo: definir gates quick/standard/release completos.
- Incluye: tipos, lint, unit, integration, E2E, cobertura y runtime.
- Excluye: corregir todos los fallos resultantes.
- Dependencias: ninguna.
- Aceptación: cada producto tiene comandos y owner; fallos conocidos generan
  backlog explícito.
- Verificación: harness ejecuta y reporta la matriz.

### CI-001 — CI mínimo para todos los productos

- Objetivo: ejecutar instalación reproducible y gates deterministas por cambio.
- Incluye: backend, admin, storefront, AI Platform, Channel Adapter y harness.
- Excluye: deployment productivo.
- Dependencias: QA-001.
- Aceptación: PRs reciben estado por producto; paths filters no omiten cambios
  compartidos.
- Verificación: workflow probado en PR de ensayo.

### SEC-001 — Baseline y triage de seguridad multi-workspace

- Objetivo: incorporar todos los lockfiles al security loop y clasificar
  exposición real.
- Incluye: inventario, runtime/dev, fix path, compensaciones y expiración.
- Excluye: actualizar dependencias.
- Dependencias: ninguna.
- Aceptación: 103 hallazgos actuales clasificados; ningún critical queda sin
  owner/acción.
- Verificación: reporte reproducible y gate que cubre cinco productos.

### SEC-002 — Threat model de superficies críticas

- Objetivo: modelar auth, pagos, uploads, webhooks, IA, canales y campañas.
- Incluye: activos, trust boundaries, abuso, controles y tests requeridos.
- Excluye: implementar mitigaciones.
- Dependencias: ARC-001.
- Aceptación: amenazas priorizadas por impacto/probabilidad y mapeadas a tareas.
- Verificación: revisión de seguridad documentada.

### MOD-001 — Baseline de hotspots y plan de descomposición

- Objetivo: dividir archivos de gran tamaño por responsabilidad sin cambiar
  comportamiento.
- Incluye: métricas, dependencias, seams y tests de caracterización.
- Excluye: refactor masivo en una sola tarea.
- Dependencias: QA-001, ARC-001.
- Aceptación: cada hotspot tiene secuencia pequeña y rollback claro.
- Verificación: tests de caracterización definidos antes de cada extracción.

### DOC-001 — Gobernanza y archivo documental

- Objetivo: clasificar documentos y eliminar contradicciones/rutas personales.
- Incluye: metadata, índice, link check y política de archivo.
- Excluye: borrar evidencia sin inventario.
- Dependencias: ninguna.
- Aceptación: todo documento tiene clase/owner; documentos canónicos no
  contradicen código verificado.
- Verificación: checker automático de links y rutas portables.

### CFG-001 — Contrato de configuración y secretos

- Objetivo: inventariar variables por producto/ambiente y su owner.
- Incluye: ejemplos, validación, rotación y clasificación secreto/no secreto.
- Excluye: copiar valores reales.
- Dependencias: ARC-001.
- Aceptación: cada variable tiene consumidor, ambiente, obligatoriedad y fuente.
- Verificación: validación automatizada sin exponer secretos.

### OPS-001 — Estándar de readiness operativo

- Objetivo: definir SLO, health, logs, métricas, alertas, backup, restore y
  rollback mínimos por producto.
- Incluye: plantilla y evidencia exigible.
- Excluye: implementar todos los controles.
- Dependencias: PF-001.
- Aceptación: checklist aprobado; ningún producto puede declararse operativo sin
  completar el estándar.
- Verificación: harness valida la presencia de recibos de release.

### CLN-001 — Inventario de artefactos y código legacy

- Objetivo: clasificar assets vendor, demos, backups, source maps y raíz `src/`.
- Incluye: uso real, tamaño, licencia, owner y destino.
- Excluye: eliminación automática.
- Dependencias: QA-001.
- Aceptación: cada candidato tiene mantener/migrar/retirar y prueba de no uso.
- Verificación: comparación de build/tests antes y después en tareas posteriores.

## Conclusión

La plataforma posee suficiente código para justificar productos separados, pero
no suficiente gobernanza para extraerlos de forma segura. Las primeras tareas
correctas son decisiones, inventarios, contratos y gates. Las remediaciones y
refactors quedan subordinados a esos resultados.
