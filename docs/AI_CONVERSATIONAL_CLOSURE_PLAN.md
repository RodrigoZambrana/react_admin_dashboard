# AI Conversational Closure Plan

## 1. Objetivo

Cerrar la interacción conversacional entre:

- cliente público en storefront
- cliente autenticado en storefront
- operador/admin en inbox
- asistente IA interno

para que el sistema responda con consistencia operativa y con un estilo de conversación natural, sin perder:

- seguridad
- trazabilidad
- confirmación explícita
- validación backend
- separación entre IA y permisos reales

Este documento define el estado actual, los huecos que siguen abiertos y el orden recomendado para alcanzar un MVP conversacional confiable.

Debe leerse junto con:

- [AI_OPERATING_MODEL.md](/Users/rodrigo/git/personal/react_admin_dashboard/docs/AI_OPERATING_MODEL.md)
- [AI_IMPLEMENTATION_PLAN.md](/Users/rodrigo/git/personal/react_admin_dashboard/docs/AI_IMPLEMENTATION_PLAN.md)
- [AI_USER_CAPABILITIES_MODEL.md](/Users/rodrigo/git/personal/react_admin_dashboard/docs/AI_USER_CAPABILITIES_MODEL.md)
- [ai-role-matrix.md](/Users/rodrigo/git/personal/react_admin_dashboard/docs/ai-role-matrix.md)

## 2. Estado actual consolidado

### 2.1 Lo que ya está resuelto

- existe un hub conversacional canónico en backend
- storefront y admin ya conversan contra el mismo dominio de conversaciones
- el runtime IA ya distingue scopes y roles conversacionales
- la memoria corta por tarea ya existe
- el lifecycle común `draft -> confirm -> execute -> verify -> respond/debug` ya está activo en varios ABM
- el inbox admin ya expone:
  - owner IA/humano
  - preview del último mensaje
  - `taskSummary`
  - indicadores de auditoría
- el storefront chat ya tiene:
  - bubble flotante
  - drawer lateral
  - transcript canónico rehidratado
  - continuidad para cliente público y autenticado

### 2.2 Lo que ya funciona bien desde el punto de vista conversacional

- cliente ya no recibe errores técnicos crudos de proveedor/cuota/configuración
- saludo simple y respuestas ligeras ya pueden resolverse sin depender del proveedor
- respuestas de ABM confirmable ya no dependen exclusivamente del LLM para el paso crítico
- preview del inbox ya distingue mejor:
  - `IA`
  - operador humano
- el chat interno del asistente ya se comporta como una única instancia por operador al filtrar `admin_chat`

### 2.3 Lo que sigue incompleto

Todavía no puede afirmarse que la interacción sea plenamente “humana” o cerrada operativamente en toda la plataforma.

Faltan piezas importantes en cinco frentes:

1. calidad y naturalidad de respuestas  
2. contexto conversacional profundo  
3. multimodalidad real  
4. cierre homogéneo del lifecycle operativo  
5. robustez visual/operativa de las superficies storefront y admin

## 3. Huecos reales pendientes

### 3.1 Lenguaje natural consistente

Hoy existen respuestas determinísticas útiles, pero todavía no hay una capa común de redacción final suficientemente madura para todos los casos.

Pendientes:

- unificar cómo se redactan respuestas de éxito, error, bloqueo, falta de datos y handoff
- evitar que algunos casos queden demasiado “operativos” o secos para cliente
- evitar respuestas excesivamente técnicas en admin fuera de `modo debug`
- separar mejor:
  - texto final al usuario
  - resumen debug interno
  - auditoría persistida

Objetivo:

- que cada respuesta suene humana, clara y breve
- que el contenido siga siendo verificable y alineado con el resultado real

### 3.2 Renderizador común de resultados operativos

El lifecycle común ya existe, pero la capa de composición de respuesta todavía no está completamente generalizada.

Pendientes:

- un formateador común por tipo de acción:
  - `create`
  - `update`
  - `delete`
  - `single`
  - `batch`
- mensajes homogéneos para:
  - confirmación previa
  - éxito
  - error validable
  - error de proveedor
  - falta de confirmación
  - handoff humano
- enlaces de verificación solo donde correspondan

Objetivo:

- que cualquier acción de ABM responda con la misma semántica
- que el usuario sepa siempre qué pasó, qué falta y dónde verificarlo

### 3.3 Inferencia de contexto y referencia de mensajes

Esto ya empezó, pero no está cerrado.

Pendientes:

- inferencia de flujo a partir del input actual más mensajes previos
- referencia explícita del mensaje o bloque al que se está respondiendo
- mejor resolución de follow-ups ambiguos:
  - “ese”
  - “el mismo”
  - “agregalo”
  - “pasame precio de esos”
- escalado a humano cuando la confianza siga siendo baja

Objetivo:

- que el sistema no conteste fuera de contexto
- que pueda usar historial real sin contaminar tareas nuevas

### 3.4 Multimodalidad operativa

La base existe, pero todavía no está generalizada.

Pendientes:

- cerrar pipeline transversal para:
  - `pdf`
  - `image`
  - `audio`
  - `csv`
  - `xlsx`
- usar esos insumos tanto para:
  - contexto conversacional
  - drafts operativos
  - batch
- dejar trazabilidad visible del origen:
  - mensaje
  - adjunto
  - bloque interpretado

Objetivo:

- que el usuario pueda “hablar” con el sistema también a través de archivos y no solo texto

### 3.5 Storefront chat todavía no está cerrado como superficie productiva

La base visual y técnica ya está, pero faltan contratos de producto.

Pendientes:

- estado visible más claro de:
  - IA
  - humano
  - híbrido
- feedback más rico:
  - sincronizando
  - escribiendo
  - derivado a humano
  - esperando respuesta
- soporte real de adjuntos desde storefront
- respuestas comerciales con cards/enlaces más claros cuando aplique
- E2E más profundas sobre:
  - continuidad
  - reload
  - fallback seguro
  - handoff humano

Objetivo:

- que el storefront deje de parecer un experimento técnico y se comporte como un canal real de atención

### 3.6 Inbox admin todavía necesita cierre operativo fino

Ya hay una superficie muy superior a la anterior, pero falta endurecerla.

Pendientes:

- estabilizar por completo:
  - filtros
  - counts
  - paginación
  - refresh
  - búsqueda
- resolver los casos restantes donde la API y la UI pueden quedar desfasadas
- seguir mejorando preview y legibilidad de lista
- reforzar la trazabilidad entre:
  - último mensaje
  - autor
  - tool ejecutada
  - estado real de control

Objetivo:

- que el inbox admin sea una consola operativa confiable y no un visor incompleto

### 3.7 Handoff humano todavía es funcional, pero no completo

Existe takeover/release/hybrid, pero falta madurar la experiencia.

Pendientes:

- mensaje claro al cliente cuando se deriva a humano
- estado visible en storefront y admin
- notas de contexto/handoff más aprovechables
- sugerencias de takeover basadas en:
  - baja confianza
  - adjunto ambiguo
  - intent no soportado

Objetivo:

- que la derivación sea parte del flujo, no una caída abrupta

### 3.8 Permisos reales y capacidades todavía deben cerrar mejor con la experiencia conversacional

El `permission envelope` ya existe, pero falta seguir proyectándolo.

Pendientes:

- enforcement más homogéneo en endpoints/core actions
- proyección más clara en UI
- respuestas más precisas cuando una acción no está habilitada
- diferenciar:
  - bloqueo por permiso
  - bloqueo por falta de datos
  - bloqueo por policy/rol conversacional
  - fallo de proveedor

Objetivo:

- que el usuario entienda por qué algo no se ejecutó y qué hacer después

### 3.9 Resiliencia del proveedor

Se mejoró la clasificación de errores, pero falta cerrar el comportamiento completo.

Pendientes:

- fallback determinístico para más intents seguros
- observabilidad mejor de:
  - rate limit
  - timeout
  - auth/provider
  - provider unavailable
- respuesta humana y útil incluso con proveedor degradado cuando haya datos suficientes en backend

Objetivo:

- que una falla del proveedor degrade la experiencia lo menos posible

## 4. Lo que no debe inflarse en esta fase

Para cerrar el MVP conversacional, no conviene desviar esfuerzo a:

- nuevos subroles conversacionales innecesarios
- `active conversational role` obligatorio
- ABM IA de dominios no core
- automatizaciones complejas no pedidas por la operativa real
- sobre-diseño visual del chat por encima de estabilidad conversacional

En esta etapa, el foco correcto sigue siendo:

- interacción útil
- contexto correcto
- confirmación segura
- ejecución verificable
- handoff humano

## 5. Plan de cierre recomendado

### Fase 1 — Cierre de coherencia conversacional base

- unificar redacción final de respuestas por tipo de outcome
- separar formalmente:
  - `finalUserText`
  - `debugSummary`
  - `auditPayload`
- ampliar respuestas determinísticas seguras para casos livianos y frecuentes
- estandarizar bloqueos por permiso/policy/datos faltantes

Criterio de cierre:

- mismo tipo de operación => misma forma de respuesta
- cliente y admin reciben textos adecuados a su rol

### Fase 2 — Contexto real y referencia de mensajes

- inferencia de flujo desde input + historial reciente
- referencia explícita del mensaje objetivo cuando aplique
- resolución de follow-ups ambiguos
- escalado a humano por baja confianza

Criterio de cierre:

- disminuyen respuestas fuera de contexto
- el sistema puede continuar tareas sin re-preguntar de más

### Fase 3 — Multimodalidad útil

- pipeline transversal de adjuntos
- extracción estructurada canónica
- integración a drafts y contexto
- trazabilidad por adjunto origen

Criterio de cierre:

- adjuntos ya no son solo render: pasan a ser input operativo confiable

### Fase 4 — Cierre de storefront chat

- estado IA/humano/híbrido claro
- refresh/polling/hidratación robustos
- soporte de adjuntos
- E2E pública y autenticada ampliada
- respuestas comerciales más ricas y seguras

Criterio de cierre:

- storefront usable como canal real de atención inicial

### Fase 5 — Cierre de inbox admin

- filtros y paginación estabilizados
- previews y autoría cerrados
- trazabilidad visible suficiente
- handoff y bulk actions confiables

Criterio de cierre:

- inbox admin listo como consola operativa principal

### Fase 6 — Cierre ABM conversacional completo

- generalizar lifecycle común a más casos pendientes
- batch y delete homogéneos
- confirm/execute/verify con verificación real
- respuestas naturales y auditables

Criterio de cierre:

- el sistema puede ejecutar y comunicar acciones de negocio de forma predecible

## 6. Prioridad práctica inmediata

Orden recomendado desde este punto:

1. unificar el renderizado final de respuestas y outcomes  
2. cerrar inferencia contextual y referencia de mensajes  
3. estabilizar inbox admin en filtros/paginación/refresh  
4. completar storefront chat como canal productivo  
5. cerrar multimodalidad aplicada a operaciones  
6. expandir lifecycle común a más ABM y batch/delete  

## 7. Criterio de aceptación del MVP conversacional

El bloque puede considerarse realmente cerrado cuando se cumpla todo esto:

- cliente público y autenticado reciben respuestas naturales, seguras y útiles
- el admin puede operar y verificar acciones desde conversación
- el sistema diferencia claramente:
  - éxito
  - error validable
  - bloqueo por permiso
  - falta de contexto
  - handoff humano
- el historial ayuda y no contamina
- el inbox admin y storefront reflejan el mismo estado real de la conversación
- los archivos pueden actuar como contexto o input operativo
- la caída del proveedor no destruye la experiencia cuando hay datos suficientes en backend

## 8. Recomendación final

No seguir agregando acciones nuevas “una por una” antes de cerrar estas capas.

La prioridad correcta ya no es ampliar superficie funcional por cantidad, sino consolidar:

- lenguaje final
- contexto
- multimodalidad
- estabilidad visual/operativa
- consistencia del lifecycle

Ese cierre es lo que realmente transforma el stack actual en una interacción que parezca humana y sea operativamente confiable.
