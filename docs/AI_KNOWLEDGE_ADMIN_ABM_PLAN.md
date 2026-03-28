# AI Knowledge Admin ABM Plan

## Objetivo

Evolucionar `AI settings` desde una pantalla de resumen operativo hacia un ABM real de contenido y conocimiento, sin reescribir el módulo actual de knowledge ni crear un subsistema paralelo.

El objetivo no es mover lógica al frontend. El objetivo es:

- exponer mejor lo que ya existe en backend
- ordenar la operación por tipo de contenido y origen
- permitir búsqueda, filtros, orden y acciones reales
- separar `overview` de `gestión`

## Estado actual

Hoy [AiRuntimeSettings.tsx](/Users/rodrigo/git/personal/react_admin_dashboard/frontend/src/views/settings/AiRuntimeSettings/AiRuntimeSettings.tsx) concentra:

- runtime config
- overview de knowledge
- upload documental
- carga curada manual
- candidatos recientes
- observaciones recientes
- corridas recientes

Eso sirve como panel de control inicial, pero no como ABM real porque:

- muestra solo slices recientes
- no tiene búsqueda o filtros profundos
- no tiene ordenamiento configurable
- no expone vistas dedicadas por entidad
- mezcla configuración con operación cotidiana

## Principio de diseño

Mantener `IA` como módulo con home/hub propio, dejar `AI Runtime` como superficie técnica específica, y mover la operación de contenido a superficies dedicadas bajo el mismo módulo.

No agregar una taxonomía nueva si la actual ya alcanza. Primero derivar la vista administrativa desde los campos ya existentes:

- `sourceType`
- `scope`
- `status`
- `sourceFile`
- `observation`
- `feedback`

Si más adelante la derivación no alcanza, recién ahí promover un campo persistido nuevo.

## Referencia UX recomendada

La evolución visual del módulo de knowledge no debe inventar una interfaz nueva desde cero. Debe apoyarse en dos patrones complementarios:

- vista general tipo `help center`
- vista operativa tipo `training board`

La referencia visual puede tomar componentes, layout y patrones del template base de admin proveniente de:

- `/Users/rodrigo/Personal/Proyectos/react projects/Elstar - React Tailwind Admin Template`

Regla importante:

- esa referencia es visual y de layout
- no debe introducir dependencia runtime al proyecto externo
- la implementación sigue viviendo en el stack actual de `frontend`

## Modelo UX acordado

Las dos propuestas no compiten. Cubren dos necesidades distintas:

- entender qué sabe hoy el agente
- operar cómo entra, se valida y se incorpora ese conocimiento

Por eso, el módulo debe dividirse en dos superficies principales.

### 1. Vista general tipo Help Center

Ruta objetivo recomendada:

- `/app/settings/ai/knowledge/overview`
- `/app/settings/ai/knowledge/conversation-bundles`
- `/app/settings/ai/knowledge/negative-examples`

Objetivo:

- explicar visualmente el estado del conocimiento de forma clara para usuarios no técnicos

Patrón:

- categorías o dominios visibles
- contenido aprobado navegable como base de ayuda
- indicadores de madurez y cobertura
- resumen del entrenamiento actual del agente

Importante:

- el indicador visible en la home de IA no debe presentarse como “madurez del modelo”
- mide cobertura operativa del conocimiento, no calidad del LLM
- referencia:
  - documentos activos
  - intercambios pendientes
  - observaciones detectadas

Bloques clave:

- categorías principales:
  - ventas
  - soporte
  - productos
  - operaciones
- `estado del conocimiento`
  - sugerido
  - en revisión
  - aprobado
  - incorporado
- resumen automático del estado actual del agente
- acceso a artículos aprobados y su historial

Qué resuelve:

- reduce percepción de caja negra
- hace visible el conocimiento aprobado
- responde “qué sabe hoy el agente”

### 2. Vista operativa tipo Training Board

Ruta objetivo recomendada:

- `/app/settings/ai/knowledge/manage-articles`

Objetivo:

- operar el entrenamiento activo como flujo gobernado por humanos

Patrón:

- tablero por estados
- cards de candidatos/sugerencias
- acciones rápidas de validación
- trazabilidad del impacto operacional

Columnas mínimas:

- sugerido
- a la espera de aprobación
- aprobado
- incorporado

Cada card debe poder mostrar:

- mensaje original
- intención detectada
- sugerencia de respuesta
- confidence
- fuente
- tags
- estado actual

Qué resuelve:

- hace tangible el entrenamiento como pipeline real
- da control operativo sobre el conocimiento dinámico
- aclara qué todavía está en revisión y qué ya impacta respuestas

## Relación entre ambas superficies y el ABM actual

El corte ya implementado de `Knowledge Candidates` y `Knowledge Documents` no se contradice con este modelo. Al contrario: es la base administrativa necesaria para construir esas dos experiencias.

Además, este ABM necesita una tercera capa explícita de observabilidad del conocimiento vigente:

- `Knowledge Snapshot`

Ese snapshot no reemplaza `Documents`, `Candidates`, `Raw Events`, `Bundles` ni `Negative Examples`.
Los consolida para responder:

- qué interpreta hoy el sistema
- de qué fuentes sale cada afirmación
- qué guardrails negativos están activos
- qué conflictos o vacíos existen

Diseño técnico detallado:

- [AI_KNOWLEDGE_SNAPSHOT_PLAN.md](/Users/rodrigo/git/personal/react_admin_dashboard/docs/AI_KNOWLEDGE_SNAPSHOT_PLAN.md)
- [AI_CONVERSATION_TO_KNOWLEDGE_DRAFT_DESIGN.md](/Users/rodrigo/git/personal/react_admin_dashboard/docs/AI_CONVERSATION_TO_KNOWLEDGE_DRAFT_DESIGN.md)

Relación propuesta:

- `AI Runtime`
  - overview técnico y quick actions
- `Knowledge Overview`
  - help center + estado del conocimiento + resumen del agente
- `Knowledge Candidates`
  - revisión puntual y búsqueda fuerte
- `Knowledge Documents`
  - ABM real del contenido aprobado
- `Knowledge Manage Articles`
  - training board operativo
- `Knowledge Raw Events`
  - trazabilidad cruda
- `Knowledge Ingestion Runs`
  - control operacional
- `Knowledge Feedback`
  - calidad y reuse

En otras palabras:

- `Candidates/Documents` resuelven el ABM administrativo fino
- `Overview/Manage Articles` resuelven comprensión y operación de alto nivel

## Estructura objetivo del módulo

La estructura recomendada no es una sola pantalla larga de settings. Debe quedar dividida así:

- `AI Runtime`
  - overview operativo
  - métricas
  - quick actions
  - últimos eventos
- `Knowledge`
  - listas dedicadas
  - filtros
  - detalle
  - acciones reales de ABM

### Navegación sugerida

Ruta padre:

- `/app/settings/ai`

Entradas hijas sugeridas:

- `/app/settings/ai/runtime`
- `/app/settings/ai/knowledge/overview`
- `/app/settings/ai/knowledge/manage-articles`
- `/app/settings/ai/knowledge/documents`
- `/app/settings/ai/knowledge/candidates`
- `/app/settings/ai/knowledge/raw-events`
- `/app/settings/ai/knowledge/ingestion-runs`
- `/app/settings/ai/knowledge/feedback`

Esto permite separar:

- configuración del runtime
- lectura general del conocimiento
- operación del entrenamiento
- operación de contenido
- observabilidad
- gobierno HITL

### Patrón visual recomendado

Para todas las listas de knowledge:

- header con título, búsqueda y acciones principales
- filtros persistentes
- tabla/lista con ordenamiento
- panel lateral o detail route
- acciones rápidas por fila

No usar `AI Runtime` como lugar donde se haga review masiva o mantenimiento fino.

## Dimensiones administrativas recomendadas

Para evitar mezclar conceptos, la UI debe trabajar con tres dimensiones visibles:

### 1. Origen de ingreso

Cómo entró el contenido al sistema.

Ejemplos:

- documento subido
- carga manual desde AI settings
- sugerencia derivada de conversación
- dataset interno
- corrida automática de ingesta

### 2. Tipo de contenido

Qué clase de contenido representa.

Ejemplos:

- documento de texto
- texto plano
- respuesta sugerida de chat
- extracción multimodal
- snapshot tabular

### 3. Estado de lifecycle

Dónde está en el flujo de gobierno.

Ejemplos:

- draft
- pending review
- approved
- rejected
- archived

La recomendación es derivar estas dimensiones desde campos existentes antes de introducir más persistencia.

## Modelo operativo propuesto

### 1. Runtime overview

Ruta sugerida:

- `/app/settings/ai`

Debe quedar como tablero ejecutivo:

- estado del runtime
- consumo
- catálogo de acciones
- métricas de knowledge
- quick actions
- items recientes

No debe ser la pantalla principal para revisar cientos de documentos o candidatos.

### 2. Centro de conocimiento

Rutas sugeridas:

- `/app/settings/ai/knowledge/documents`
- `/app/settings/ai/knowledge/candidates`
- `/app/settings/ai/knowledge/raw-events`
- `/app/settings/ai/knowledge/ingestion-runs`
- `/app/settings/ai/knowledge/feedback`

Opcional:

- `/app/settings/ai/knowledge/overview`

## Entidades y superficies

### Documentos

Entidad backend base:

- `KnowledgeDocument`

Casos incluidos:

- documento subido
- carga curada manual
- documento aprobado derivado de conversación
- dataset interno indexado
- contenido web/docs ingerido

Columnas mínimas:

- título
- resumen
- `sourceType`
- origen visible derivado
- `scope`
- `status`
- tags
- embedding sí/no
- actualizado

Filtros mínimos:

- `scope`
- `status`
- `sourceType`
- `originCategory`
- `hasEmbedding`
- búsqueda por texto

Acciones mínimas:

- ver
- editar metadata
- editar contenido si es carga manual
- reemplazar archivo si aplica
- descargar/ver fuente
- reindexar
- archivar/eliminar según tipo

Vista de detalle mínima:

- metadata general
- origen de ingreso
- tipo de contenido
- contenido fuente o archivo
- estado de indexación
- historial básico de cambios
- referencias de uso si existen

### Candidatos

Entidad backend base:

- `KnowledgeCandidate`

Casos incluidos:

- sugerencia derivada de conversación
- candidato enriquecido con operator reply
- candidato ya aprobado o rechazado

Columnas mínimas:

- excerpt
- `detectedIntent`
- `confidence`
- `status`
- `sourceType`
- canal/origen
- feedback resumido
- actualizado

Filtros mínimos:

- `status`
- intención
- canal
- `scope`
- búsqueda por excerpt/respuesta
- con feedback / sin feedback

Acciones mínimas:

- abrir detalle
- aprobar
- aprobar y promover a documento
- editar respuesta antes de aprobar
- rechazar

Vista de detalle mínima:

- mensaje o contexto origen
- intención detectada
- respuesta sugerida
- confidence
- feedback histórico
- candidate relacionado o documento promovido
- diff entre sugerencia y versión aprobada cuando aplique

### Observaciones

Entidad backend base:

- `KnowledgeRawEvent`

Rol:

- fuente cruda estructurada
- no conocimiento aprobado
- material de revisión

Columnas mínimas:

- mensaje usuario
- reply operador / IA
- canal
- `sourceAuthorType`
- `status`
- intención detectada
- `confidence`
- candidate vinculado sí/no
- actualizado

Filtros mínimos:

- `status`
- canal
- `sourceAuthorType`
- conversación
- intención
- búsqueda libre

Acciones mínimas:

- abrir detalle
- ver trazabilidad multimodal
- crear candidato manual
- reintentar observación

Vista de detalle mínima:

- mensaje crudo
- elementos interpretados
- adjuntos asociados
- origen conversacional
- reply relacionado si existe
- candidate derivado si existe

### Corridas de ingesta

Entidad backend base:

- `KnowledgeIngestionRun`

Columnas mínimas:

- `sourceType`
- `triggerType`
- `status`
- procesados
- candidatos creados
- errores
- actor
- inicio / fin

Filtros mínimos:

- `status`
- `sourceType`
- actor
- fecha

Acciones mínimas:

- abrir detalle
- ver metadata
- reintentar corrida manual según tipo

Vista de detalle mínima:

- trigger
- actor
- filtros usados
- cantidad procesada
- errores
- candidates creados
- observaciones reutilizadas

### Feedback de sugerencias

Base actual:

- `KnowledgeSuggestionFeedback`

Pantalla objetivo:

- ranking de reuse por candidato
- sugerencias más usadas
- sugerencias más editadas
- sugerencias más descartadas

Esto sirve para:

- curar mejor conocimiento aprobado
- detectar respuestas pobres
- medir valor real del módulo

Pantalla mínima:

- ranking por `used`
- ranking por `edited`
- ranking por `discarded`
- filtro por canal
- filtro por intención
- filtro por período
- acceso al candidato/documento relacionado

## Derivación de “origen visible”

No hace falta persistirlo primero. Puede derivarse así:

- `sourceType=DOCS` + `sourceFile != null` -> `Documento subido`
- `sourceType=ADMIN_CURATED` -> `Carga manual`
- `sourceType=CONVERSATION_DERIVED` + `status=pending` -> `Sugerencia desde conversación`
- `sourceType=CONVERSATION_DERIVED` + `status=approved` -> `Sugerencia aprobada`
- `sourceType=BACKEND_DATASET` -> `Dataset interno`

Y además una segunda dimensión visual:

- `document_file`
- `plain_text`
- `conversation_response`
- `dataset_snapshot`
- `multimodal_extract`

Esta segunda dimensión puede derivarse desde:

- `sourceFile`
- `content`
- `observation.messageElements`
- `metadata`

## Ordenamiento recomendado

### Documents

Default:

- `updatedAt desc`

Opciones:

- `title asc`
- `sourceType asc`
- `approvedAt desc`

### Candidates

Default:

- `updatedAt desc`

No `createdAt desc`.

Esto es importante porque un candidato puede enriquecerse después con:

- reply operador
- feedback
- aprobación

## Flujo ABM recomendado

### 1. Alta manual

Caso:

- operador crea contenido curado desde AI settings

Flujo:

- `Nuevo contenido`
- seleccionar tipo:
  - texto plano
  - documento
  - respuesta operativa
- completar:
  - título
  - scope
  - tags
  - contenido o archivo
- guardar como draft o aprobar

Resultado:

- genera `KnowledgeDocument` o candidato según política elegida

### 2. Ingreso por conversación

Caso:

- una interacción real genera una observación útil

Flujo:

- `KnowledgeRawEvent`
- candidato sugerido
- revisión humana
- aprobación/promoción

Resultado:

- el contenido aprobado deja de verse solo como evento y pasa a ser conocimiento reutilizable

### 3. Mantenimiento

Caso:

- revisar contenido existente

Flujo:

- buscar
- filtrar
- abrir detalle
- editar metadata
- archivar
- reindexar

### 4. Revisión HITL

Caso:

- revisar cola de candidatos

Flujo:

- lista filtrable
- búsqueda por excerpt/intención/canal
- abrir detalle
- aprobar / editar y aprobar / rechazar

## Estructura mínima de pantallas

### AI Runtime

Debe quedar solo con:

- overview
- métricas
- quick actions
- últimos candidatos
- últimos raw events
- últimas corridas
- acceso directo a pantallas dedicadas

### Knowledge Documents

Objetivo:

- ABM de contenido ya gobernado

Debe permitir:

- búsqueda
- filtros por origen y tipo
- orden por fecha, título, aprobación
- alta manual
- upload
- edición
- archive

### Knowledge Candidates

Objetivo:

- revisión puntual y masiva de sugerencias

Debe permitir:

- búsqueda fuerte
- filtros por estado, canal, intención, scope
- orden por `updatedAt`, `confidence`, feedback
- aprobar, editar y aprobar, rechazar

### Knowledge Raw Events

Objetivo:

- trazabilidad y diagnóstico de ingesta

Debe permitir:

- búsqueda
- filtros por canal, conversación, autor, intención
- orden por fecha
- crear candidato manual
- reintentar observación

### Knowledge Ingestion Runs

Objetivo:

- control operacional de backfill/manual/realtime

Debe permitir:

- filtrar por estado, actor, sourceType y fecha
- abrir detalle
- reintentar según tipo

### Knowledge Feedback

Objetivo:

- medir calidad real del conocimiento reutilizado

Debe permitir:

- ver reuse
- ver edición/descarte
- detectar candidatos pobres
- detectar conocimiento obsoleto o contradictorio

### Raw events

Default:

- `updatedAt desc`

### Ingestion runs

Default:

- `startedAt desc`

## Endpoints a extender

Sobre [knowledge.controller.ts](/Users/rodrigo/git/personal/react_admin_dashboard/backend/src/knowledge/knowledge.controller.ts) y [knowledge.service.ts](/Users/rodrigo/git/personal/react_admin_dashboard/backend/src/knowledge/knowledge.service.ts):

### Documents

- `GET /ai/knowledge/documents`
  - agregar:
    - `search`
    - `page`
    - `pageSize`
    - `orderBy`
    - `orderDir`
    - `originCategory`
    - `hasEmbedding`
- `PATCH /ai/knowledge/documents/:id`
  - metadata editable
- `POST /ai/knowledge/documents/:id/reindex`
- `POST /ai/knowledge/documents/:id/archive`

### Candidates

- `GET /ai/knowledge/candidates`
  - agregar:
    - `search`
    - `channel`
    - `detectedIntent`
    - `hasFeedback`
    - `orderBy`
    - `orderDir`
    - `page`
    - `pageSize`
- `GET /ai/knowledge/candidates/:id`

### Raw events

- `GET /ai/knowledge/raw-events`
  - agregar:
    - `search`
    - `channel`
    - `conversationId`
    - `detectedIntent`
    - `orderBy`
    - `orderDir`
    - `page`
    - `pageSize`
- `GET /ai/knowledge/raw-events/:id`

### Ingestion runs

- `GET /ai/knowledge/ingestion-runs`
  - agregar:
    - `sourceType`
    - `createdByUserId`
    - `from`
    - `to`
    - `page`
    - `pageSize`
- `GET /ai/knowledge/ingestion-runs/:id`

## Fases recomendadas

### Fase 1. Separar overview de ABM

- mantener `AI Runtime` actual
- crear pantallas de lista dedicadas
- sumar filtros básicos y paginación
- definir navegación y taxonomía visible de origen/tipo/estado

Estado:

- implementado para:
  - `Knowledge Overview`
  - `Knowledge Manage Articles`
  - `Knowledge Candidates`
  - `Knowledge Documents`
  - `Knowledge Raw Events`
  - `Knowledge Ingestion Runs`
- backend ya soporta:
  - `search`
  - `orderBy`
  - `orderDir`
  - `page`
  - `pageSize`
  - filtros derivados por origen/tipo/estado según entidad
- `AI Runtime` ya consume listas resumidas y expone accesos a las pantallas dedicadas

### Fase 2. Detalle y acciones reales

- detalle por documento/candidato/observación/corrida
- edición de metadata
- review más rica de candidatos
- reindex/retry/archive
- alta manual y edición real de contenido curado

### Fase 3. Feedback y operación avanzada

- pantalla de feedback
- ranking por adopción/edición/descarte
- insights de contradicción, duplicados y obsolescencia
- promoción controlada entre candidato aprobado y documento gobernado

## Estado implementado actual

- `Knowledge Documents` ya funciona como ABM real de contenido aprobado:
  - búsqueda, filtros, orden y paginación
  - alta manual curada y upload documental
  - apertura de fuente
  - edición real de:
    - `title`
    - `summary`
    - `content`
    - `tags`
    - `scope`
    - `status`
- `Knowledge Feedback` ya existe como superficie dedicada:
  - feedback `used / edited / discarded`
  - métricas agregadas de adopción
  - filtros por `scope`, `channel`, `candidate`, `conversation` y `search`
  - trazabilidad de mensaje objetivo, respuesta sugerida y respuesta final del operador
- `Knowledge Manage Articles` ya tiene acciones directas por columna:
  - crear candidato desde evento crudo
  - aprobar
  - aprobar e incorporar
  - rechazar
  - abrir candidato/documento/feedback según estado

## Unidad aprobable recomendada

La experiencia operativa y el modelo de knowledge no deben tratar una pregunta cruda del cliente como conocimiento aprobable por sí misma.

La unidad mínima recomendada es:

- `intercambio observado`
  - mensaje del usuario
  - respuesta humana o IA asociada
  - contexto básico del canal/scope/intención

Regla aplicada:

- un mensaje inbound sin respuesta asociada queda como `raw event`
- recién cuando existe respuesta útil asociada puede entrar al flujo de `candidate`

Motivo:

- evita aprobar preguntas aisladas sin valor reutilizable
- mantiene trazabilidad de qué disparó la respuesta
- deja listo el par `pregunta -> respuesta` para reuse y feedback

### Sobre aprobar una conversación completa

No se recomienda usar la conversación completa como unidad aprobable por defecto.

Motivos:

- mezcla múltiples intents y subtemas
- aumenta ruido, contradicción y PII incidental
- dificulta ranking, versionado y reuse puntual

Estrategia recomendada:

- operar hoy con `exchange-level approval`
- dejar `conversation bundle` como evolución futura para casos de playbooks multi-turno explícitos

## Criterio operativo actual para `Manage Articles`

La vista tipo `training board` ya cumple su objetivo principal cuando permite mover la operación con acciones directas claras por card.

La implementación actual queda alineada al patrón del template `project/scrum-board`:

- board horizontal
- cards clickeables
- cambio de estado por `drag-and-drop`
- detalle operativo por card

Regla actual:

- el flujo positivo principal se resuelve moviendo cards entre columnas
- la revisión fina y los descartes siguen disponibles en las vistas dedicadas
- no usar botones inline de aprobar/rechazar en el board principal

El objetivo del tablero no es parecerse a un scrum board por estética. Es dejar claro:

- qué entró
- qué está en revisión
- qué ya fue aprobado
- qué ya impacta al agente

## IA como módulo

La navegación del admin debe reflejar que `IA` ya no es solo un bloque dentro de `Settings`, sino un módulo con superficies propias.

Regla acordada:

- `/app/settings/ai`
  - home/hub del módulo
  - resumen del estado del runtime
  - resumen del estado del entrenamiento
  - accesos claros a cada superficie
- `/app/settings/ai/runtime`
  - configuración técnica/operativa del runtime
- `/app/settings/ai/knowledge/*`
  - superficies de gobierno y operación del conocimiento

Esto reduce el scroll confuso, hace visible el mapa del módulo y deja claro qué pantalla sirve para qué.

## Evoluciones futuras explícitas

Además del flujo actual por intercambio, quedan definidas dos superficies futuras:

- `conversation bundles`
  - superficie exploratoria para detectar fragmentos multi-turno donde el valor está en la secuencia completa
  - no reemplaza todavía el intercambio como unidad base
- `negative examples`
  - superficie explícita para respuestas rechazadas, obsoletas o inseguras
  - deben servir para ranking, guardrails y revisión, no como corpus aprobable reutilizable

Y queda aprobada para análisis una tercera línea de evolución:

- `knowledge elements`
  - unidades reutilizables derivadas de texto manual o documental
  - pueden salir de:
    - formularios de carga
    - documentos subidos
    - contenido curado
  - pueden representar:
    - reglas positivas
    - patrones de respuesta
    - guardrails negativos
  - no reemplazan el documento fuente
  - deben mantener trazabilidad completa:
    - fuente
    - fragmento
    - versión
    - revisión humana

## Criterio de cierre del ABM

Se considera cerrado este bloque cuando:

- `/app/settings/ai` funciona como hub claro del módulo
- `AI Runtime` queda como superficie técnica, no como home improvisada
- existe lista dedicada por entidad principal
- cada lista tiene búsqueda, filtros y orden
- cada entidad tiene detalle y acciones mínimas reales
- el operador puede distinguir claramente:
  - qué es documento aprobado
  - qué es candidato pendiente
  - qué es observación cruda
  - qué es corrida de ingesta

## Próximo slice recomendado

1. agregar versionado visible e historial de cambios en `Knowledge Documents`
2. enriquecer `Knowledge Overview` con categorías de negocio reales y métricas de feedback/reuse
3. sumar `Knowledge Feedback` como fuente para decisiones de obsolescencia, contradicción y promoción/revisión
4. reevaluar `drag-and-drop` en `Knowledge Manage Articles` solo después de observar uso operativo real
