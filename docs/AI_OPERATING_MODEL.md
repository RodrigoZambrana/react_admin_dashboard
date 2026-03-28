# AI Operating Model

## 1. Objetivo real del stack IA

El objetivo del stack IA no es “tener un agente” sino construir un sistema operativo conversacional y transaccional que:

- entienda el contexto del interlocutor
- responda con tono adecuado al rol
- use conocimiento aprobado y trazable
- ejecute acciones operativas seguras cuando corresponda
- derive a humano cuando el caso no puede resolverse con seguridad

El valor del sistema no debe medirse por cantidad de prompts o complejidad del agente, sino por:

- cobertura real de operativa útil
- confiabilidad
- auditabilidad
- control de permisos
- facilidad de mantenimiento

## 2. Estado actual del stack

### 2.1 Arquitectura activa

La arquitectura vigente ya está separada en capas:

- `backend`
  - fuente de verdad
  - autorización real
  - contratos canónicos
  - persistencia de conversaciones, estado IA y catálogo de acciones
- `services/ai-agent-service`
  - runtime conversacional
  - memoria corta
  - construcción de prompt
  - invocación de tools
  - filtrado por rol
- `services/channel-adapter`
  - normalización de mensajes/canales
- `frontend`
  - inbox/admin
  - auditoría operativa
  - handoff/takeover
- `ecommerce`
  - chat cliente/storefront

Archivos centrales:

- [backend/src/ai/ai.service.ts](/Users/rodrigo/git/personal/react_admin_dashboard/backend/src/ai/ai.service.ts)
- [backend/src/ai/ai.controller.ts](/Users/rodrigo/git/personal/react_admin_dashboard/backend/src/ai/ai.controller.ts)
- [backend/src/ai/role-engine/role.config.ts](/Users/rodrigo/git/personal/react_admin_dashboard/backend/src/ai/role-engine/role.config.ts)
- [backend/src/conversations/conversations.service.ts](/Users/rodrigo/git/personal/react_admin_dashboard/backend/src/conversations/conversations.service.ts)
- [services/ai-agent-service/src/ai/agent.js](/Users/rodrigo/git/personal/react_admin_dashboard/services/ai-agent-service/src/ai/agent.js)
- [services/ai-agent-service/src/ai/prompts/index.js](/Users/rodrigo/git/personal/react_admin_dashboard/services/ai-agent-service/src/ai/prompts/index.js)
- [services/ai-agent-service/src/ai/tools/tool-registry.js](/Users/rodrigo/git/personal/react_admin_dashboard/services/ai-agent-service/src/ai/tools/tool-registry.js)
- [frontend/src/views/crm/ConversationsV2/ConversationsV2.tsx](/Users/rodrigo/git/personal/react_admin_dashboard/frontend/src/views/crm/ConversationsV2/ConversationsV2.tsx)

Documento de cierre conversacional:

- [AI_CONVERSATIONAL_CLOSURE_PLAN.md](/Users/rodrigo/git/personal/react_admin_dashboard/docs/AI_CONVERSATIONAL_CLOSURE_PLAN.md)
- [AI_CONVERSATIONAL_BEHAVIOR_ANALYSIS.md](/Users/rodrigo/git/personal/react_admin_dashboard/docs/AI_CONVERSATIONAL_BEHAVIOR_ANALYSIS.md)

### 2.2 Principios ya implementados

- separación entre comportamiento conversacional y autorización real
- memoria conversacional por rol
- reset limpio por cambio de tarea
- knowledge aprobada por scope
- auditoría de tools y fallback
- confirmación para acciones críticas
- protección base contra prompt injection

### 2.3 Gestión documental y knowledge como capacidad transversal

La carga y administración de documentos de contexto no pertenece a un tenant puntual.

Es una capacidad base del sistema y debe existir para cualquier tenant:

- alta de documento
- descarga
- visualización
- eliminación
- recarga/reemplazo
- clasificación por scope

Objetivo:

- que cualquier tenant pueda mantener su base documental aprobada para IA
- que el sistema no dependa de archivos externos dispersos o documentación no gobernada
- que `customer_public` y roles internos consuman solo conocimiento aprobado y trazable

Esto aplica a `urucortinas`, pero no nace para `urucortinas`: es una regla transversal del producto.

### 2.4 Estado actual de adjuntos y archivos conversacionales

Hoy el stack ya superó el nivel de “solo almacenamiento/render” y tiene una base operativa real para adjuntos, aunque todavía no está cerrada end-to-end en todos los canales.

Estado real:

- `inbox` guarda metadata de adjuntos y los serializa en detalle de mensaje
- conversaciones/admin renderizan:
  - imágenes
  - audios
  - adjuntos genéricos
- mail ya expone adjuntos como parte del detalle del mensaje
- existe un contrato canónico `ExtractedAsset` para ingestión operativa
- existe un endpoint interno de extracción controlada para IA
- el backend ya resuelve extracción determinística para:
  - `csv`
  - `xlsx`
  - `pdf`
- el backend/runtime ya soportan extracción asistida para:
  - `image`
  - `audio`
  cuando llega texto previo o hay proveedor IA disponible
- el runtime IA ya puede usar ese resultado para:
  - enriquecer contexto conversacional
  - refinar drafts con Structured Outputs
  - disparar al menos un flujo batch real (`products.create` desde filas tabulares)

Todavía no está cerrado como capacidad transversal:

- ingesta homogénea de adjuntos operativos desde todos los canales
- OCR/transcripción especializada con observabilidad completa
- reutilización amplia del mismo pipeline en:
  - `quotes`
  - `orders`
  - `payments`
  - `aberturas`
- auditoría visible por adjunto origen dentro del lifecycle común

Conclusión:

- el sistema ya no está en estado “solo muestra archivos”
- sí existe una base operativa real para adjuntos
- pero todavía no debe afirmarse que el pipeline multimodal completo esté cerrado para toda la plataforma

### 2.5 Marco global de comportamiento del agente

El marco de comportamiento del agente debe seguir siendo programático, transversal y desacoplado de la knowledge dinámica de cada tenant.

Acuerdos vigentes:

- la inferencia de flujo debe partir primero del input del usuario y del contexto operativo del sistema, no del corpus documental
- la documentación dinámica aprobada sirve para:
  - contenido de respuesta
  - grounding
  - contexto de negocio
  pero no para definir:
  - reglas base del agente
  - permisos
  - lifecycle operativo
  - política de memoria
- si el mensaje actual incluye elementos no textuales ambiguos:
  - primero debe intentarse su interpretación usando:
    - extracción del adjunto
    - contexto reciente de la conversación
    - referencias operativas ya resueltas en el hilo
  - si eso no alcanza con confianza suficiente:
    - debe escalar a humano
- cuando haya múltiples mensajes recientes plausibles como origen de una respuesta, el sistema debe poder:
  - referenciar el mensaje o bloque que está respondiendo
  - o al menos dejar trazabilidad suficiente para que el operador entienda el vínculo

Esto implica que el “marco de trabajo” del agente debe vivir en:

- código
- configuración global controlada
- políticas de rol/memoria/tools

Y no en documentos de tenant cargados dinámicamente.

## 3. Cobertura operativa real hoy

Esta sección describe capacidad **real expuesta a IA**, no solo dominio existente en backend.

### 3.1 Operativa core general ya cubierta por IA

#### Clientes

- buscar
- crear
- actualizar

Estado:
- usable por roles internos habilitados
- con búsqueda previa y validación de payload

#### Actividades / citas

- buscar
- crear
- actualizar
- eliminar

Estado:
- usable por soporte/operaciones según rol
- adecuada para agenda y seguimiento operativo

#### Productos

- buscar
- crear
- actualizar
- archivar
- publicar
- ajustar stock

Estado:
- usable en flujos internos
- con confirmación en mutaciones críticas

#### Categorías

- buscar
- crear
- actualizar

Estado:
- cubierto como operativa general de ecommerce

#### Pedidos

- buscar
- crear
- actualizar estado
- actualizar comentario
- actualizar estructura del documento

Estado:
- cubierto con flujo seguro reutilizando servicios reales del backend
- no usa caminos paralelos ad hoc

#### Presupuestos

- buscar
- crear
- enviar
- confirmar
- actualizar estado
- actualizar comentario
- actualizar estructura

Estado:
- cubierto de forma segura
- apoyado en flujo canónico del dominio

#### Pagos

- buscar
- crear
- actualizar estado
- actualizar detalles

Estado:
- cubierto
- aún requiere madurar algunos casos más finos de conciliación/refund

### 3.2 Operativa core no cubierta o solo parcialmente cubierta por IA

No está expuesto hoy como catálogo operativo IA:

- usuarios y auth
- roles/permisos administrativos completos
- proveedores
- gastos/expenses
- producción
- CMS
- logística externa
- cupones/campañas
- multi-depósito
- refund/cancelaciones complejas
- gestión IA de configuración paramétrica avanzada
- import/export paramétrico vía IA
- edición IA de reglas técnicas avanzadas

Conclusión:
- la IA hoy cubre una porción operativa importante del core
- pero no cubre “toda la empresa”
- y no debe asumirse que cualquier módulo existente del sistema ya es operable por IA

## 4. Estado particular de UruCortinas

### 4.1 Lo que sí está cubierto

#### Knowledge y grounding

La infraestructura correcta es transversal al sistema: cualquier tenant debe poder cargar y gobernar su documentación base para IA.

En `urucortinas`, hoy esa infraestructura ya está poblada con base aprobada para `customer_public` y roles internos:

- [docs/knowledge/urucortinas-admin-internal-curated.md](/Users/rodrigo/git/personal/react_admin_dashboard/docs/knowledge/urucortinas-admin-internal-curated.md)
- [docs/knowledge/urucortinas-admin-internal-operational-playbook.md](/Users/rodrigo/git/personal/react_admin_dashboard/docs/knowledge/urucortinas-admin-internal-operational-playbook.md)
- [docs/knowledge/urucortinas-commercial-rules.md](/Users/rodrigo/git/personal/react_admin_dashboard/docs/knowledge/urucortinas-commercial-rules.md)
- [docs/knowledge/urucortinas-quotation-criteria.md](/Users/rodrigo/git/personal/react_admin_dashboard/docs/knowledge/urucortinas-quotation-criteria.md)
- [docs/knowledge/urucortinas-frequent-objections.md](/Users/rodrigo/git/personal/react_admin_dashboard/docs/knowledge/urucortinas-frequent-objections.md)
- [docs/knowledge/urucortinas-operational-policies.md](/Users/rodrigo/git/personal/react_admin_dashboard/docs/knowledge/urucortinas-operational-policies.md)

#### Aberturas

Está cubierto:

- parseo determinístico
- separación de múltiples ítems
- reglas anti-contaminación
- clasificación alta vs cotización
- preparación de payload estructurado para alta
- preparación de borrador estructurado para cotización
- grounding del agente con playbooks y documentación específica

Componentes vivos:

- [backend/src/aberturas/parser/aberturas-parser.service.ts](/Users/rodrigo/git/personal/react_admin_dashboard/backend/src/aberturas/parser/aberturas-parser.service.ts)
- [backend/src/aberturas/aberturas-glossary.service.ts](/Users/rodrigo/git/personal/react_admin_dashboard/backend/src/aberturas/aberturas-glossary.service.ts)
- [backend/src/pricing/parametric-pricing.service.ts](/Users/rodrigo/git/personal/react_admin_dashboard/backend/src/pricing/parametric-pricing.service.ts)

### 4.2 Lo que NO está cubierto todavía para UruCortinas

No debe sobreafirmarse como disponible:

- creación real automática en lote de productos finales a partir de `prepare_aberturas_insert`
- creación confirmada de presupuesto desde `prepare_aberturas_quote`

No forma parte del objetivo operativo esperado:

- crear nuevas matrices paramétricas por IA
- sostener un ABM IA de matrices paramétricas múltiples
- sostener un CRUD IA del glosario como fin en sí mismo

Alcance correcto:

- existe una matriz relevante del sistema para `aberturas`
- a futuro podría requerir ajustes controlados de atributos/reglas
- pero el foco de IA no es administrar la matriz, sino interpretar fuentes heterogéneas y producir un resultado estándar para alta/cotización

El núcleo esperado para `aberturas` es:

- intake de distintas fuentes
- parseo robusto
- normalización
- validación
- estandarización
- `insert` limpio o borrador de cotización

Conclusión:
- hoy la IA de `urucortinas` está fuerte en interpretación y estructuración
- todavía no está cerrada en ejecución full-cycle confirmada de alta/presupuesto

### 4.3 Resultado objetivo de parser para `aberturas`

El caso neurálgico no es “editar glosario” sino lograr que entradas como estas:

- `corr probba blanco 100x100 c/dvh 4/9/5 con fenix usd 306`
- `puerta batiente todo vidrio 80 x 200 negro c/dvh 4/9/5 usd 521`
- `monoblock alum negro 160x120 probba negro c/dvh 4/9/5 c/fenix usd 722`
- `batiente probba negro 50x130 c/dvh 4/9/5 usd 328`

terminen en una salida estándar, auditable y apta para alta:

- familia
- serie
- color
- vidrio
- ancho/alto normalizados
- extras
- precio
- moneda
- warnings
- score
- `insertPayload`

## 5. Desviaciones detectadas y riesgo de sobredimensionamiento

### 5.1 Desviaciones observadas

- exceso de documentos tácticos sin jerarquía clara
- mezcla de ideas de arquitectura, backlog, relevamiento y estado real en archivos distintos
- tendencia a asumir cobertura IA por existencia de código de dominio
- riesgo de meter demasiada lógica del negocio en prompts
- crecimiento rápido del alcance IA sobre áreas no críticas todavía no validadas operativamente

### 5.2 Señales de sobredimensionamiento

Hay sobredimensionamiento cuando:

- se modelan demasiadas capacidades antes de estabilizar las operativas core
- se intenta hacer que el LLM “resuelva” lógica de negocio que debería vivir en backend
- se agregan playbooks o prompts sin convertirlos en reglas/pipelines auditables
- se confunde conocimiento del tenant con cobertura funcional del sistema
- se confunde gestión documental transversal con una customización puntual de tenant
- se intenta abarcar módulos no prioritarios antes de cerrar clientes, actividades, productos, pedidos, presupuestos, pagos y mensajería

### 5.3 Regla recomendada

Priorizar siempre en este orden:

1. operativa general reusable
2. seguridad y trazabilidad
3. ejecución confiable
4. tenant specialization
5. ampliaciones no críticas

## 6. Recomendaciones técnicas más allá de lo ya pedido

### 6.1 Evolucionar hacia capacidades compuestas sin sobredimensionar el MVP

El sistema hoy resuelve un rol conversacional efectivo.

Eso sirve para arrancar. La siguiente evolución debe ser pragmática.

Modelo recomendado:

- `grupos`
  - ventas
  - soporte
  - operaciones
  - supervisor
  - plataforma
- `membresías`
  - un usuario puede pertenecer a varios grupos
- `permission envelope`
  - unión de capacidades reales del usuario
- `active conversational role`
  - solo si aporta valor real a la sesión/tarea

Regla clave:

- los permisos reales pueden ser unión de grupos
- una empresa puede querer dar acceso amplio a un mismo usuario
- el sistema no debe limitar a un operador por imponer un `rol activo` cuando no hace falta
- el tono, memoria y comportamiento del agente no deben mezclar todos los roles a la vez cuando eso degrada coherencia
- si el sistema necesita distinguir comportamiento, puede resolver un `rol activo` por:
  - contexto de la conversación
  - tipo de tarea
  - selección explícita del operador
  - inferencia automática

Recomendación:

- para MVP:
  - resolver primero `permission envelope`
  - permitir usuarios multi-área sin fricción
  - no exigir selección manual de rol activo para operar
- estado actual:
  - ya existe un primer slice implementado de `grupos + capacidades`
  - el ABM de usuarios ya permite configurar grupos y capacidades directas
  - la sesión administrativa ya expone `capabilityGroups`, `directCapabilities`, `capabilityEnvelope` y `capabilitySource`
  - la IA usa esa capa de forma conservadora cuando la configuración explícita es clara
- solo introducir `activeRole` si aparecen casos reales donde:
  - el tono del agente entre en conflicto
  - la auditoría requiera distinguir el área de acción
  - la UX gane claridad real
- si no aparece esa necesidad, mantener la capacidad compuesta sin agregar esa capa

### 6.2 Introducir `intent -> workflow` como capa formal

Hoy hay detección de intención y tools.

El siguiente paso sano es un registro explícito de workflows:

- `customer.lookup`
- `appointment.manage`
- `quote.create_or_update`
- `aberturas.register`
- `aberturas.prepare_quote`

Eso reduce dependencia del LLM para orquestación fina.

### 6.2 bis · Introducir extracción híbrida controlada

Hay entradas que el backend puro no puede entender con confianza suficiente.

Para esos casos, la recomendación correcta no es “dejar que el agente razone libremente”, sino insertar una capa híbrida:

- parser backend primero
- si no alcanza:
  - extracción IA estructurada a schema canónico
- validación backend posterior
- recién después:
  - `draft`
  - `confirm`
  - `execute`

La IA en ese punto no reemplaza al backend.

Su responsabilidad debe ser:

- transformar input ambiguo o ruidoso en estructura entendible
- resumir faltantes
- señalar conflictos o dudas

La decisión final sobre ejecutar o no ejecutar sigue en backend.

### 6.3 Hacer el parser/backend más fuerte que el prompt

Especialmente en `aberturas`, pero también aplicable a otros dominios:

- parser
- normalización
- validación
- scoring
- dedupe
- payload preparation

Todo eso debe seguir migrando a backend determinístico.

### 6.4 Hacer crecer el sistema por “operativa cerrada”, no por módulo

La unidad correcta de evolución no es “agregar otro prompt”, sino cerrar ciclos completos:

- detectar
- validar
- ejecutar
- auditar
- handoff

Extensión acordada:

- incluir `delete` dentro del mismo lifecycle común
- incorporar batch cuando la operación lo requiera
- usar mensajes de éxito/error coherentes con el tipo de acción:
  - `create/update`: con enlace solo si existe una ruta útil de verificación
  - `delete`: sin enlace muerto
  - `batch`: con resumen por item

En desarrollo y QA, además, el sistema debe poder devolver un `modo debug` breve con:

- etapa
- intent
- acción
- input relevante
- motivo del resultado o del fallo

## 7. Plan futuro recomendado

### Fase A · Estabilización operativa

- cerrar E2E por subrol interno:
  - `admin_support`
  - `admin_sales`
  - `admin_operations`
- cerrar diferencias UI según subrol
- medir fallbacks, bloqueos y confirmaciones en escenarios reales

### Fase B · Capacidades compuestas y evaluación de rol activo

- introducir `group membership`
- separar `permission envelope` de cualquier decisión conversacional
- validar si `active conversational role` aporta valor real o es sobreingeniería

### Fase C · Workflows formales

- modelar workflows críticos como entidades/config formal
- conectar tools, validaciones y handoff sobre esos workflows
- incluir el patrón híbrido:
  - parser backend
  - extracción IA estructurada
  - validación backend
- incluir `delete` y batch como ciudadanos de primera clase del lifecycle común

### Fase D · Tenant specialization útil

- cerrar en `urucortinas`:
  - alta confirmada de productos desde `prepare_aberturas_insert`
  - presupuesto confirmado desde `prepare_aberturas_quote`
  - exponer sólo cuando el circuito completo sea auditable

### Fase E · Ingesta operativa de adjuntos

- definir contrato canónico de extracción para:
  - PDF
  - imagen
  - audio
  - CSV/XLSX
- hacer que esos resultados puedan alimentar:
  - drafts operativos
  - knowledge temporal de la conversación
  - debug y auditoría

## 8. Proceso de mantenimiento documental

La documentación útil del sistema IA debe quedar reducida a cuatro niveles:

### Nivel 1 · Fuente operativa principal

- [AI_OPERATING_MODEL.md](/Users/rodrigo/git/personal/react_admin_dashboard/docs/AI_OPERATING_MODEL.md)

### Nivel 2 · Contratos activos

- [ai-role-matrix.md](/Users/rodrigo/git/personal/react_admin_dashboard/docs/ai-role-matrix.md)
- [AI_USER_CAPABILITIES_MODEL.md](/Users/rodrigo/git/personal/react_admin_dashboard/docs/AI_USER_CAPABILITIES_MODEL.md)
- [ai-safe-operations-survey.md](/Users/rodrigo/git/personal/react_admin_dashboard/docs/ai-safe-operations-survey.md)
- [canonical-messaging-contract.md](/Users/rodrigo/git/personal/react_admin_dashboard/docs/canonical-messaging-contract.md)
- [knowledge/README.md](/Users/rodrigo/git/personal/react_admin_dashboard/docs/knowledge/README.md)

### Nivel 3 · Seguimiento

- [tasks.md](/Users/rodrigo/git/personal/react_admin_dashboard/docs/tasks.md)
- [progress.md](/Users/rodrigo/git/personal/react_admin_dashboard/docs/progress.md)
- [decisions.md](/Users/rodrigo/git/personal/react_admin_dashboard/docs/decisions.md)

### Nivel 4 · Referencia histórica

- blueprints/planes viejos
- relevamientos previos
- notas tácticas que no son más la fuente principal

## 9. Regla final de gobierno

Antes de declarar una nueva capacidad IA como “cubierta”, debe existir:

- tool o endpoint real
- validación y confirmación
- auditoría visible
- prueba automatizada relevante
- documentación en Nivel 1 o Nivel 2

Si falta uno de esos puntos, la capacidad existe como intención o prototipo, pero no como operativa cerrada.
