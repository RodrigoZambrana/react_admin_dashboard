# AI Implementation Plan

## 1. Propósito

Este documento consolida en una sola referencia:

- el estado operativo real de la IA
- los acuerdos de alcance ya definidos
- los no-objetivos explícitos
- el plan de implementación por fases y prioridad

Debe leerse junto con:

- [AI_OPERATING_MODEL.md](/Users/rodrigo/git/personal/react_admin_dashboard/docs/AI_OPERATING_MODEL.md)
- [AI_USER_CAPABILITIES_MODEL.md](/Users/rodrigo/git/personal/react_admin_dashboard/docs/AI_USER_CAPABILITIES_MODEL.md)
- [ai-role-matrix.md](/Users/rodrigo/git/personal/react_admin_dashboard/docs/ai-role-matrix.md)
- [ai-safe-operations-survey.md](/Users/rodrigo/git/personal/react_admin_dashboard/docs/ai-safe-operations-survey.md)
- [docs/knowledge/README.md](/Users/rodrigo/git/personal/react_admin_dashboard/docs/knowledge/README.md)

## 2. Estado consolidado

### 2.1 Qué ya existe y está bien encaminado

- arquitectura desacoplada entre:
  - backend
  - runtime IA
  - channel adapter
  - admin inbox
  - storefront/chat cliente
- separación entre:
  - comportamiento conversacional
  - autorización real backend
- memoria corta por rol y por tarea
- auditoría operativa visible en admin
- knowledge aprobada con flujo de gestión documental
- catálogo de acciones IA seguro sobre operativa core
- foundation implementada de `grupos + capacidades + permission envelope` sobre usuarios administrativos
  - modelo persistido en usuario
  - catálogo code-driven
  - ABM expuesto en admin
  - sesión/JWT proyectando envelope a backend e IA

### 2.2 Operativa core hoy cubierta por IA

- clientes:
  - buscar
  - crear
  - actualizar
- actividades:
  - buscar
  - crear
  - actualizar
  - eliminar
- productos:
  - buscar
  - crear
  - actualizar
  - archivar
  - publicar
  - ajustar stock
- categorías:
  - buscar
  - crear
  - actualizar
- pedidos:
  - buscar
  - crear
  - cambiar estado
  - actualizar comentario
  - actualizar estructura
- presupuestos:
  - buscar
  - crear
  - enviar
  - confirmar
  - cambiar estado
  - actualizar comentario
  - actualizar estructura
- pagos:
  - buscar
  - crear
  - actualizar estado
  - actualizar datos

### 2.3 Cobertura particular hoy válida para `urucortinas`

- grounding con documentos curados y playbooks
- parser determinístico de `aberturas`
- separación alta vs cotización
- payload estructurado para alta
- borrador estructurado para cotización

## 3. Acuerdos cerrados

### 3.1 Knowledge documental

La gestión documental para IA es transversal al sistema. No pertenece a un tenant puntual.

Todo tenant debe contar con:

- upload
- download
- delete
- reload/reindex
- clasificación por scope

`urucortinas` hoy es el caso más avanzado, no la excepción conceptual.

### 3.2 `Aberturas`

Para `aberturas`, el foco correcto es:

- intake de fuentes heterogéneas
- parseo robusto
- normalización
- validación
- scoring
- salida estándar auditable
- `insertPayload` limpio o borrador de cotización

No es objetivo operativo de IA:

- crear nuevas matrices paramétricas
- sostener un ABM IA de matrices múltiples
- sostener un CRUD IA del glosario como fin en sí mismo

### 3.3 Cobertura IA real

Una capacidad se considera realmente cubierta solo si tiene:

- endpoint o tool real
- validación
- confirmación cuando corresponde
- auditoría visible
- prueba relevante
- documentación activa

Si falta alguno de esos puntos, la capacidad se considera parcial o experimental.

### 3.4 Patrón transversal de respuesta operativa

Toda operación ABM confirmable debe converger a un ciclo común:

- detectar intención
- construir draft verificable
- pedir confirmación
- ejecutar
- verificar
- responder con resultado y trazabilidad

Reglas de salida por tipo de operación:

- `create`:
  - mensaje de éxito o error claro
  - enlace de comprobación solo si existe una ruta real útil de detalle/edición para la entidad
- `update`:
  - mensaje de éxito o error claro
  - enlace de comprobación cuando la entidad sigue existiendo y hay una ruta útil para verificar el cambio
- `delete`:
  - mensaje de éxito o error claro
  - no devolver enlace si la entidad deja de existir o el detalle deja de ser válido
- `single`:
  - resultado puntual por entidad
- `batch`:
  - totales y desglose por item:
    - ejecutados
    - fallidos
    - omitidos o pendientes

Durante desarrollo, el admin debe poder recibir un resumen técnico breve tipo `modo debug` con:

- etapa
- intent
- acción
- inputs relevantes
- tools ejecutadas o bloqueadas
- motivo de la decisión o del fallo

Estado actual del patrón:

- ya está bajado al runtime IA con draft persistido y ejecución confirmable para:
  - `aberturas.register`
  - `customers.create`
  - `customers.update`
  - `products.create`
  - `products.update`
  - `appointments.create`
  - `appointments.update`
  - `appointments.delete`
  - `orders.update_status`
  - `orders.update_comment`
  - `quotes.update_status`
  - `quotes.update_comment`
  - `quotes.send`
  - `quotes.confirm`
  - `payments.update_status`
  - `payments.update`
- los flujos anteriores ya devuelven respuesta determinística sin depender del modelo para el ciclo:
  - `draft`
  - `confirm`
  - `execute`
  - `verify`
  - `respond/debug`
- los enlaces de verificación se devuelven solo para `create/update` o confirmaciones que terminan en una entidad verificable
- `delete` y error no deben devolver enlaces muertos
- el soporte `batch` ya quedó activo para `aberturas.register` y debe reutilizarse en futuras operaciones masivas
 - el soporte `batch` también ya quedó activo para `products.create` cuando el origen es tabular (`csv/xlsx`) y puede derivar a múltiples altas confirmables

### 3.5 Procesamiento híbrido cuando el backend no entiende el input

No todo input operativo debe resolverse con parser backend puro.

Regla de arquitectura:

- primero intentar:
  - parser determinístico
  - validación backend
  - pre-búsqueda sobre entidades reales
- si el backend no logra interpretar con confianza suficiente:
  - derivar a una etapa de extracción asistida por IA
  - exigir una salida estructurada en formato canónico del sistema
  - volver a validar esa salida en backend antes de construir el draft

La IA no debe ejecutar directamente una mutación por “haber entendido” un texto ambiguo.

Debe actuar como:

- extractor semántico
- normalizador estructurado
- resumidor de faltantes, dudas o conflictos

Y el backend debe seguir siendo responsable de:

- validar schema
- normalizar tipos, unidades y enums
- resolver referencias internas
- decidir si existe confianza suficiente para:
  - `draft`
  - `confirm`
  - `execute`

Flujo recomendado:

- input libre
- parser backend
- si `confidence >= threshold`:
  - draft directo
- si `confidence < threshold` o formato no soportado:
  - extracción IA a JSON canónico
- validación backend del JSON
- draft verificable
- confirmación
- ejecución
- verificación
- respuesta/debug

Casos naturales para este patrón:

- `aberturas` desde texto ruidoso
- altas o updates de clientes con frases ambiguas
- pedidos o presupuestos redactados informalmente
- adjuntos cuyo contenido no sea interpretable de forma confiable con backend puro

Estado actual de esta capa híbrida:

- ya existe puente de Structured Outputs en el runtime IA
- ya existe refinamiento estructurado para drafts cuando el parser backend puro no alcanza
- hoy está bajado al menos a:
  - `customers.create/update`
  - `products.create/update`
  - `appointments.create/update`
- la salida estructurada vuelve a pasar por validación y construcción de draft en backend/runtime antes de cualquier ejecución real

### 3.6 Adjuntos y documentos operativos

Hoy el sistema ya:

- almacena y serializa adjuntos en inbox/mail
- los renderiza en conversaciones/admin
- permite descarga o visualización en los flujos donde corresponde
- expone un contrato canónico `ExtractedAsset` para ingestión operativa
- tiene endpoint interno de extracción controlada para IA
- resuelve extracción determinística o asistida según tipo de archivo

Estado realmente implementado en este slice:

- contrato `ExtractedAsset` con:
  - `assetType`
  - `rawText`
  - `normalizedText`
  - `structuredRows`
  - `warnings`
  - `confidence`
  - `source`
  - `stage`
  - `usableForContext`
- extracción determinística en backend para:
  - `csv`
  - `xlsx`
  - `pdf`
- extracción asistida o contextual para:
  - `image`
    - OCR/texto provisto
    - o extracción IA si hay configuración OpenAI
  - `audio`
    - transcripción provista
    - o transcripción IA si hay configuración OpenAI
- conexión del resultado al runtime IA para:
  - enriquecer contexto conversacional
  - intentar refinamiento estructurado antes de construir drafts
  - disparar `batch` operativo en `products.create` desde filas tabulares

Arquitectura objetivo que sigue vigente para adjuntos:

- recepción del archivo
- persistencia y metadata canónica
- clasificación por tipo:
  - documento
  - imagen
  - audio
  - planilla
- extracción primaria por backend o servicio especializado:
  - PDF/texto
  - OCR de imagen
  - transcripción de audio
  - lectura tabular de CSV/XLSX
- salida estándar de extracción:
  - `rawText`
  - `structuredRows`
  - `detectedEntities`
  - `warnings`
  - `confidence`
- recién después:
  - parser backend específico
  - o extracción IA estructurada si el parser no alcanza
- luego:
  - `draft -> confirm -> execute -> verify -> respond/debug`

Regla operativa:

- para admin, PDFs/Excels/imagenes/audios pueden ser origen de una acción operativa
- para customer, los adjuntos pueden alimentar contexto o soporte, pero nunca deben abrir acceso a lógica interna o mutaciones no permitidas

Principio:

- la IA no debería leer adjuntos “crudos” como único mecanismo de procesamiento
- primero debe existir una capa de ingestión y extracción controlada
- luego la IA puede ayudar a estructurar o explicar el resultado

Pendientes reales para considerar esta capacidad “cerrada”:

- ingesta operativa homogénea desde todos los canales, no solo soporte de runtime interno
- ampliar el puente estructurado a más workflows documentales:
  - `quotes`
  - `orders`
  - `payments`
  - `aberturas`
- especializar mejor OCR/transcripción si aparecen límites de calidad por proveedor
- exponer mejor en auditoría/admin qué adjunto alimentó cada draft o ejecución

Alcance práctico actual de APIs multimodales externas:

- `pdf`:
  - sí es viable como input de modelo y también para retrieval documental
  - útil para lectura semántica, resumen y extracción asistida
- `image`:
  - sí es viable como input visual
  - útil para OCR asistido, interpretación visual y clasificación
- `audio`:
  - sí es viable vía transcripción
  - luego el texto transcripto puede entrar al lifecycle operativo
- `csv/xlsx`:
  - no debe asumirse como input multimodal operativo equivalente a `pdf/image/audio`
  - el camino recomendado es parser backend/tabular primero
  - luego IA solo para estructuración o explicación adicional si hace falta

Conclusión técnica:

- `pdf/image/audio` sí están dentro del alcance razonable de una arquitectura apoyada en IA vía API
- `csv/xlsx` conviene tratarlos primariamente como problema programático/tabular del backend
- incluso cuando la API soporte lectura documental, la capa propietaria del sistema sigue siendo necesaria para:
  - validación
  - normalización
  - control de permisos
  - auditabilidad

### 3.7 Errores, debug y desarrollo

En desarrollo y QA no alcanza con un fallback genérico.

Para flujos operativos confirmables debe existir un `modo debug` entendible que deje claro:

- etapa del fallo:
  - parse
  - extraction
  - validation
  - draft
  - confirmation
  - execute
  - verify
- intent detectado
- inputs relevantes
- tool o acción intentada
- causa del bloqueo o fallo:
  - permisos
  - ambigüedad
  - provider IA
  - validación
  - falta de contexto
  - error backend

En producción, ese mismo patrón puede degradarse a un mensaje más humano y menos técnico.

Además, el runtime no debe colapsar toda falla del proveedor en `provider_quota_exceeded`.

Taxonomía mínima esperable en debug/auditoría:

- `provider_quota_exceeded`
- `provider_rate_limited`
- `provider_auth_failed`
- `provider_bad_request`
- `provider_context_limit`
- `provider_timeout`
- `provider_unavailable`
- `provider_error`

Esto permite distinguir entre:

- saldo/cuota agotada
- límite temporal de tasa
- credenciales inválidas
- request mal formada
- contexto/tokens excedidos
- timeout o indisponibilidad temporal

### 3.8 Marco global de inferencia y comportamiento

Estos puntos no dependen de un tenant puntual ni de la base documental cargada.

Deben tratarse como comportamiento global del sistema:

- inferencia de flujo a partir del input del usuario
  - ejemplo:
    - si el mensaje tiene estructura típica de alta operativa, debe inferirse el flujo de alta aunque el usuario no nombre explícitamente la entidad con lenguaje exacto del backend
- uso del contexto conversacional para desambiguar inputs no textuales
  - si entra un PDF, imagen, audio o planilla cuya interpretación aislada no alcanza, el sistema debe intentar leerlo en conjunto con el resto del hilo
  - si aun así no hay confianza suficiente, escalar a humano
- capacidad de referenciar mensajes concretos cuando haya múltiples mensajes recientes candidatos a respuesta
- separación entre:
  - marco global del agente
  - contenido dinámico de knowledge

Regla central:

- la knowledge dinámica puede aportar contenido y grounding
- no debe redefinir el comportamiento base del agente ni su política operativa

Estado actual de esta capa:

- ya existe un primer slice programático de inferencia contextual en runtime
- cuando el input actual es ambiguo o referencial, el sistema puede apoyarse en mensajes recientes del mismo hilo para:
  - inferir mejor la intención operativa
  - enriquecer el input de razonamiento
  - dejar trazabilidad de los mensajes referenciados en auditoría/debug
- este slice no reemplaza todavía un resolvedor completo de referencias; es la base inicial sobre la que debe crecer el resto del comportamiento global

### 3.8 Roles internos

El modelo actual por subrol es correcto para arrancar, pero no debe rigidizar la operación del MVP.

Evolución recomendada, con foco en no sobredimensionar:

- `group membership` o agrupación equivalente de capacidades
- `permission envelope`
- `active conversational role` solo cuando aporte valor real

Regla:

- un usuario puede pertenecer a varios grupos
- los permisos reales pueden ser la unión de grupos
- un usuario puede tener acceso amplio si la empresa así lo necesita
- el sistema no debe obligar a un operador a “elegir un rol” para poder trabajar
- el `active conversational role` debe ser opcional:
  - inferido automáticamente cuando alcance
  - seleccionable solo cuando el caso lo justifique
  - nunca un bloqueo artificial para usuarios con capacidad transversal

Conclusión práctica para MVP:

- primero resolver `permission envelope`
- luego evaluar si hace falta exponer `active conversational role`
- no tratarlo como prerequisito para dar acceso amplio a operadores

Estado actual de ese acuerdo:

- el primer slice de `grupos + capacidades` ya quedó implementado
- el envelope explícito reemplaza el fallback legacy cuando el usuario fue configurado
- `SUPERADMIN` conserva envelope total
- el rol conversacional activo sigue siendo opcional y no se impone al operador

## 4. Desviaciones a evitar

- usar prompts para resolver lógica de negocio que debe vivir en backend
- asumir cobertura IA por existencia de código de dominio
- abrir nuevos frentes no core antes de cerrar los actuales
- seguir creando documentos tácticos sin jerarquía
- mezclar múltiples tonos/roles internos en la misma sesión
- convertir `aberturas` en un proyecto de “ABM de matriz” cuando el foco real es parser + estandarización + ejecución segura

## 5. Target de producto

El target no es un chatbot aislado. Es un sistema operativo de atención y operación que:

- entiende el rol del interlocutor
- mantiene continuidad útil sin contaminar tareas
- ejecuta acciones reales cuando corresponde
- sabe cuándo bloquear, confirmar o derivar
- se audita y se mantiene como un módulo serio del stack

## 6. Plan de implementación por fases

## Fase 1 · Cerrar operación por subrol interno

Estado:

- completada el `2026-03-26`
- validada con regresiones E2E reales sobre operadores configurados por grupos/capacidades
- estabilizada corrigiendo la reconstrucción del `permission envelope` desde enums persistidos en BD/JWT

### Objetivo

Convertir la separación de roles actual en capacidad operativa validada de punta a punta.

### Entregables

- E2E específicos para:
  - `admin_support`
  - `admin_sales`
  - `admin_operations`
- validación de tools permitidas/bloqueadas por subrol
- validación de confirmación obligatoria por subrol
- validación de auditoría visible por subrol

### Criterio de cierre

- cada subrol tiene al menos un flujo E2E representativo
- no hay herramientas ejecutables fuera de política
- el comportamiento visible en admin coincide con el subrol efectivo

### Prioridad

Máxima.

## Fase 2 · Diferenciar UI y experiencia por subrol

### Objetivo

Que la separación por rol no quede solo en backend/runtime, sino que también afecte la experiencia operativa.

### Entregables

- acciones visibles filtradas por subrol
- señales visuales del rol activo
- estados de takeover/handoff alineados
- UI de auditoría más clara para:
  - blocked tools
  - executed tools
  - task summary
  - reset de tarea

### Criterio de cierre

- un usuario interno no ve acciones que no puede ejecutar
- la UI guía correctamente el uso según el rol activo

### Prioridad

Muy alta.

## Fase 3 · Introducir envelope de capacidades y dejar rol activo como capa opcional

### Objetivo

Permitir que un usuario opere en múltiples áreas sin limitar su capacidad real, manteniendo control conversacional cuando haga falta.

### Entregables

- modelo de `group membership` o agrupación equivalente
- resolución de `permission envelope`
- soporte a usuarios con acceso amplio por unión de capacidades
- evaluación técnica de:
  - `active conversational role` inferido
  - `active conversational role` manual
  - o mantenerlo fuera del MVP si no aporta valor real

### Criterio de cierre

- un usuario multi-área puede operar con permisos combinados
- el sistema no limita artificialmente a operadores con acceso amplio
- backend y runtime comparten la misma resolución base de capacidades
- si se introduce `active conversational role`, debe quedar justificado por un caso real

### Prioridad

Muy alta.

## Fase 4 · Llevar más lógica compleja a workflows/backend determinístico

### Objetivo

Reducir dependencia del LLM para orquestación y validación.

### Entregables

- capa más explícita de `intent -> workflow`
- workflows seguros para:
  - clientes
  - actividades
  - productos
  - pedidos
  - presupuestos
  - pagos
- reglas de validación y confirmación por workflow
- auditoría más semántica por workflow, no solo por tool
- capa híbrida:
  - parser backend
  - extracción IA estructurada cuando haga falta
  - validación backend posterior
- soporte homogéneo de `delete` y batch fuera de `aberturas`

### Criterio de cierre

- los casos core dependen menos del razonamiento libre del modelo
- las validaciones críticas viven en código del sistema

### Prioridad

Alta.

## Fase 5 · Cerrar el flujo real de `aberturas`

### Objetivo

Cerrar el circuito operativo real de `aberturas`, que hoy está fuerte en estructuración pero no completamente cerrado en ejecución final.

### Entregables

- unificación/refactor del código ya existente de:
  - parser
  - glosario
  - pricing paramétrico
  - reglas de quote/admin
- parser batch para fuentes heterogéneas:
  - WhatsApp
  - texto libre
  - PDF
  - imagen
  - audio transcripto
  - planilla/tabular
- salida estándar estable:
  - parse
  - warnings
  - score
  - `insertPayload`
  - draft quote
- confirmación y creación real:
  - alta confirmada desde `prepare_aberturas_insert`
  - presupuesto confirmado desde `prepare_aberturas_quote`

### Criterio de cierre

- desde una fuente ruidosa se obtiene:
  - resultado estructurado confiable
  - alta o presupuesto realmente ejecutable
  - auditoría completa

### Prioridad

Alta, pero después de cerrar subroles y UI.

## Fase 6 · Harden knowledge cross-tenant

### Objetivo

Que el flujo documental y de retrieval sea serio, reusable y gobernable para cualquier tenant.

### Entregables

- filtros/search de documentos gestionados
- mejor observabilidad de retrieval
- provenance visible por respuesta
- mantenimiento claro de documentos activos vs históricos
- candidate review más fuerte para conocimiento derivado de conversaciones
- pipeline base de extracción para adjuntos operativos:
  - `pdf`
  - `image`
  - `audio`
  - `csv/xlsx`
  - ya implementado como base técnica; pendiente endurecimiento cross-channel y ampliación de coverage operativa

### Criterio de cierre

- cualquier tenant puede mantener su base documental sin hacks locales
- la knowledge usada por IA es trazable y controlable

### Prioridad

Media-alta.

## Fase 7 · Recién después ampliar a módulos no core

### Objetivo

Expandir cobertura IA sin erosionar confiabilidad.

### Posibles áreas futuras

- gastos
- logística
- proveedores
- CMS/campañas
- configuraciones avanzadas

### Regla

No abrir estas áreas mientras las fases 1 a 6 no estén suficientemente estabilizadas.

## 7. Orden práctico recomendado

1. E2E por subrol interno real
2. UI diferenciada por subrol
3. consolidar enforcement real por `permission envelope` y evaluación pragmática de `active conversational role`
4. workflows/backend determinístico para operativa core
5. cierre real del circuito de `aberturas`
6. hardening cross-tenant de knowledge/documentos
7. expansión a módulos no core

## 8. Criterio de mantenimiento

Cuando cambie el alcance real de IA, hay que actualizar:

- [AI_OPERATING_MODEL.md](/Users/rodrigo/git/personal/react_admin_dashboard/docs/AI_OPERATING_MODEL.md)
- [AI_IMPLEMENTATION_PLAN.md](/Users/rodrigo/git/personal/react_admin_dashboard/docs/AI_IMPLEMENTATION_PLAN.md)
- [ai-safe-operations-survey.md](/Users/rodrigo/git/personal/react_admin_dashboard/docs/ai-safe-operations-survey.md)
- [tasks.md](/Users/rodrigo/git/personal/react_admin_dashboard/docs/tasks.md)
- [progress.md](/Users/rodrigo/git/personal/react_admin_dashboard/docs/progress.md)

Si no se actualizan esos cinco puntos, el estado de IA debe considerarse desalineado.
