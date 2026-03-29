# WhatsApp QR Channel Design

## Contexto
En la realidad actual de `urucortinas`, WhatsApp concentra más del 90% de las conversaciones.

Eso vuelve crítico resolver una integración real que permita:
- continuidad conversacional
- ejecución de acciones
- operación humana
- trazabilidad
- bajo riesgo de bloqueo

## Decisión de producto

### Camino objetivo de largo plazo
Mantener compatibilidad futura con `Meta Business API`.

### Camino inicial recomendado
Integración vía QR sobre dispositivo/sesión real de WhatsApp.

Razones operativas:
- conserva el uso desde el teléfono de origen
- permite múltiples dispositivos
- mantiene el historial operativo real
- facilita respaldo a demanda
- evita restricciones prácticas de plantillas y ventanas en el día a día del negocio
- se alinea mejor con la operación actual del tenant

## Separación correcta

### Baseline reusable
El sistema debe abstraer el canal como:
- inbound message
- outbound message
- message status
- attachments
- reactions
- typing / presence
- quoted replies
- session health

Esto significa:
- WhatsApp QR es una opción transversal del sistema
- no debe quedar acoplado al runtime ecommerce
- debe poder convivir con storefront, admin y futuras capabilities no ecommerce

### Add-on tenant/operational
La decisión de usar QR en vez de Meta para WhatsApp es operativa y temporal.
No debe contaminar el runtime general.

## Arquitectura recomendada

### Nuevo adapter: `whatsapp-qr`
Ubicación sugerida:
- `services/channel-adapter/src/channels/whatsapp-qr/`

Responsabilidades:
- bootstrap y conexión por QR
- persistencia segura de sesión
- ingesta inbound
- envío outbound
- eventos de estado
- reacciones
- typing/presence
- quoted reply metadata
- descarga de media

### Contrato canónico
Todo debe entrar al sistema por `UnifiedMessage`.

Campos mínimos a preservar:
- `channel = whatsapp`
- `authorKind`
- `messageKind`
- `providerMessageId`
- `threadId`
- `replyToMessageId`
- `quotedMessage`
- `attachments`
- `metadata.channelCapabilities`

## Capacidades mínimas para paridad con webchat

### Customer side
- FAQ grounding
- cotización
- agenda
- handoff
- seguimiento

### Active WhatsApp capabilities
- reply con cita
- reaction a mensajes
- typing/presence
- lectura/ack de estados
- multimedia real

## Buenas prácticas críticas para evitar bloqueo

### 1. No spam
- no iniciar campañas masivas desde el número operativo
- limitar envíos salientes no solicitados
- respetar ventanas reales de continuidad
- no mandar bursts automatizados

### 2. Comportamiento humano
- simular typing solo cuando aporte realismo
- distribuir tiempos de respuesta
- usar delays realistas basados en el corpus real ya cargado
- evitar contestar instantáneamente cada turno

### 3. Respetar ritmo de conversación
- no responder dos veces a un mismo evento
- no reabrir hilos cerrados sin disparador humano
- no insistir cuando el usuario no respondió

### 4. Sesión segura
- persistir credenciales/sesión cifradas
- permitir invalidación manual
- detectar desconexión y requerir nuevo QR

## Modelo operativo recomendado

### Modo asistido
El sistema redacta y ejecuta parte del flujo, con supervisión y handoff.

### Modo semiautomático
Capacidades habilitadas:
- respuestas frecuentes
- intake de cotización
- coordinación de agenda
- confirmaciones operativas

### Modo manual reforzado
Ante riesgo o degradación:
- desactivar ejecución automática
- mantener sugerencias al operador
- conservar lectura y trazabilidad

## Kill switches por capability
Para WhatsApp QR deben existir al menos:
- `faq`
- `quote`
- `schedule`
- `handoff`
- `reactions`
- `typing_presence`
- `outbound_auto_send`

Si una capability falla:
- apagar solo esa capability
- no apagar todo el canal

## Sesión QR y ciclo de vida

### Estados sugeridos
- `disconnected`
- `waiting_qr`
- `authenticated`
- `degraded`
- `reconnect_required`

### UX admin mínima
- ver QR activo
- saber si la sesión está viva
- reiniciar sesión
- invalidar sesión
- ver último heartbeat
- ver número conectado
- configurar delays, typing/presence y límites operativos desde su propio menú
- resincronizar backend -> adapter cuando exista drift operativo
- ver consistencia entre configuración, `InboxAccount` y estado real del adapter

## Persistencia y respaldo

Guardar:
- credenciales/sesión del proveedor QR
- metadata de dispositivo
- timestamps de conexión
- errores de reconexión
- export/backups manuales

## Reconciliación después de desconexión o restore

### Problema real

En WhatsApp QR, el historial que expone la sesión conectada puede cambiar después de:

- logout / relink
- cambio de dispositivo
- restore sin backup cloud
- pérdida parcial de mensajes en el teléfono

Eso no puede implicar pérdida automática del historial ya persistido en el sistema.

### Resultado buscado

- el sistema preserva el historial interno aunque el proveedor remoto vuelva con menos mensajes
- si el mismo número vuelve a escribir, se intenta merge con la identidad y conversación previas
- el canal remoto aporta eventos nuevos, no reescribe por completo la historia del CRM

### Diseño recomendado

- separar:
  - identidad canónica del customer
  - aliases de identidad del canal
  - mensajes persistidos del sistema
  - visibilidad actual del proveedor

Persistir aliases del canal:

- número normalizado
- JIDs observados
- thread ids históricos

Estados útiles de reconciliación:

- `provider_present`
- `provider_missing`
- `system_only`
- `merged`

### Fuente de verdad

- backend/CRM: historial persistido, customer matching y auditoría
- adapter QR: estado de sesión y eventos nuevos del proveedor

### Regla operativa

- nunca borrar historial interno porque el proveedor ya no lo exponga
- preferir merge cuando el número canónico matchee
- dejar explícito cuándo el mensaje vive solo del lado sistema

## Riesgos y mitigaciones

### Riesgo: bloqueo por automatización visible
Mitigación:
- delays realistas
- límites salientes
- no campañas
- handoff temprano en casos complejos

### Riesgo: sesión inestable
Mitigación:
- heartbeat
- reconexión controlada
- alertas admin
- re-login por QR cuando haga falta

### Riesgo: dependencia de una librería no oficial
Mitigación:
- aislar el adapter
- no mezclarlo con contratos del runtime
- preparar migración a Meta en la capa de canal, no en el negocio

## Migración futura a Meta Business API

### Qué debe mantenerse estable
- `UnifiedMessage`
- contratos inbound/outbound
- actions del runtime
- ownership backend
- auditoría

### Qué cambia
- adapter del canal
- autenticación
- restricciones de mensajería
- plantillas y ventanas

### Estrategia
- Facebook e Instagram sí pueden seguir yendo por Meta desde el inicio
- WhatsApp arranca por QR
- luego migra a Meta cuando la operación esté lista para asumir sus restricciones

## Plan de implementación recomendado

### Fase 1
- adapter `whatsapp-qr`
- login por QR
- inbound/outbound básicos
- media
- persistencia de sesión

### Fase 2
- quoted replies
- reactions
- typing/presence
- health/heartbeat

### Fase 3
- kill switches por capability
- delays humanizados
- rate controls
- métricas anti-spam

### Fase 4
- UI admin de sesión QR
- monitoreo
- reconnect flows
- manejo explícito de errores del canal
- consistencia con `InboxAccount`

### Fase 5
- parity completa con webchat
- ejecución de acciones AI/customer/admin sobre WhatsApp
- preparación de migración a Meta

## Estado actual esperado del slice
Al cerrar la implementación base del canal, debe existir:
- backend como fuente de verdad de configuración
- `channel-adapter` como ejecutor QR
- UI dedicada en settings del canal
- acciones explícitas de `refresh`, `sync`, `start`, `stop`, `reconnect` y `reset`
- bloque de consistencia para detectar drift entre backend, inbox y adapter
- sesión persistida fuera del contenedor
- reconexión y reset de sesión
- límites salientes y delays humanos configurables
- migración futura a Meta posible sin tocar runtime ni contratos internos

## Decisión final
Para el contexto actual de `urucortinas`, WhatsApp QR no es un workaround marginal.
Es el canal crítico y debe tratarse como una capability principal del producto, con arquitectura limpia, límites operativos explícitos y migración futura posible a Meta sin reescribir el runtime.
