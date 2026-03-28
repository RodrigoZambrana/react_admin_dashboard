# AI Conversational Behavior Analysis

## 1. Propósito

Este documento abstrae patrones observados en conversaciones reales para convertirlos en contexto reusable de implementación.

No describe contenido de negocio.
No propone respuestas literales.
No depende de un tenant puntual.

Su objetivo es ayudar a:

- fortalecer el comportamiento base del agente
- mejorar continuidad conversacional
- definir guardrails y reglas de clarificación
- reducir fixes puntuales guiados por wording

Debe leerse como complemento de:

- [AI_CONVERSATIONAL_CLOSURE_PLAN.md](/Users/rodrigo/git/personal/react_admin_dashboard/docs/AI_CONVERSATIONAL_CLOSURE_PLAN.md)
- [AI_RUNTIME_MINIMAL_DESIGN.md](/Users/rodrigo/git/personal/react_admin_dashboard/docs/AI_RUNTIME_MINIMAL_DESIGN.md)
- [AI_CONVERSATION_QUALITY_LOOP.md](/Users/rodrigo/git/personal/react_admin_dashboard/docs/AI_CONVERSATION_QUALITY_LOOP.md)

## 2. Principio de abstracción

El foco no está en qué se preguntó sobre un producto, servicio o política concreta.

El foco está en:

- cómo inicia una conversación
- cómo el usuario agrega contexto
- cómo aparecen follow-ups y cambios de eje
- cuándo una respuesta ayuda a avanzar
- cuándo una respuesta rompe continuidad o genera fricción

Regla base:

- el contenido específico del negocio debe vivir en `knowledge`, configuración o políticas del tenant
- el comportamiento conversacional debe vivir en el runtime común

## 3. Tipos de mensajes detectados

### 3.1 Apertura social

Mensajes de saludo, cortesía o chequeo de presencia antes de la consulta real.

Patrón:

- suelen ser cortos
- no requieren IA
- no deben disparar respuestas excesivas ni listar capacidades completas

### 3.2 Consulta inicial amplia

El usuario expresa necesidad general sin todos los datos necesarios para resolver.

Patrón:

- abre un hilo temático
- habilita preguntas de clarificación mínimas
- no debe caer en fallback técnico

### 3.3 Consulta específica

El usuario acota el tema a una variante, condición o caso puntual.

Patrón:

- puede aparecer como continuación de una consulta amplia
- requiere mantener el contexto previo
- no debe reinterpretarse como tema completamente nuevo si es un follow-up corto

### 3.4 Payload estructurado

Mensajes con medidas, cantidades, restricciones, horarios, referencias u otros datos concretos.

Patrón:

- suelen venir en varios turnos
- deben componerse como un solo contexto operativo
- no deben colapsarse en un resumen pobre

### 3.5 Follow-up elíptico

Mensajes cortos que dependen totalmente del turno anterior.

Patrón:

- una o pocas palabras
- continuidad implícita
- alta probabilidad de error si se interpretan aislados

### 3.6 Clarificación

Pedido de explicación adicional, confirmación o desglose de algo ya dicho.

Patrón:

- suele aparecer después de una respuesta larga o densa
- no debe reiniciar el hilo
- exige retomar el estado previo

### 3.7 Cambio de eje

El usuario pasa del tema principal a condiciones operativas, contacto, tiempos o siguiente paso.

Patrón:

- no siempre cierra el tema anterior
- requiere separar threads sin perder memoria útil

### 3.8 Coordinación operativa

Mensajes orientados a disponibilidad, visita, instalación, dirección, horario o confirmación de próximo paso.

Patrón:

- requieren estado conversacional
- suelen involucrar datos pendientes mínimos
- no deben depender del proveedor para responder de forma útil

### 3.9 Postventa o soporte

Mensajes sobre ajuste, falla, revisión o modificación de algo ya existente.

Patrón:

- no deben tratarse como consulta comercial nueva
- no deben degradarse a frustración genérica si el pedido es concreto

### 3.10 Cierre liviano

Mensajes de agradecimiento, confirmación suave o cierre de turno.

Patrón:

- requieren respuestas breves
- no deben reabrir el flujo innecesariamente

### 3.11 Turno multimodal

Mensajes donde el texto se complementa con imagen, audio, video o documento.

Patrón:

- el adjunto forma parte del contexto real
- no debe quedar como metadata muerta

## 4. Patrones de intención más frecuentes

- pedido de orientación general
- consulta específica dentro de una categoría previamente abierta
- solicitud de presupuesto o estimación con datos parciales
- pedido de aclaración sobre una propuesta previa
- consulta por condiciones o restricciones operativas
- coordinación del siguiente paso
- soporte sobre un caso ya existente
- combinación de dos o más intenciones en un mismo turno

Conclusión:

- la intención no siempre aparece cerrada en el primer mensaje
- muchas veces se construye a través de varios turnos

## 5. Patrones de follow-up

### 5.1 Follow-up mínimo

El usuario responde con una sola palabra o frase corta.

Necesidad:

- heredar intención y tópico activos

### 5.2 Follow-up contrastivo

El usuario cambia solo un atributo respecto al turno previo.

Necesidad:

- mantener el hilo principal
- actualizar solo la dimensión que cambió

### 5.3 Follow-up comparativo

El usuario pide comparar opciones o condiciones ya mencionadas.

Necesidad:

- retener entidades previas
- responder en forma relativa y no desde cero

### 5.4 Follow-up operacional

Después de entender el caso, el usuario pregunta por disponibilidad, tiempos, forma de avanzar o coordinación.

Necesidad:

- cambiar de subthread sin perder el caso base

### 5.5 Follow-up diferido

El usuario retoma el tema después de horas o días.

Necesidad:

- reanudar si hay continuidad semántica suficiente
- evitar asumir continuidad ciega si el mensaje cambia de eje

### 5.6 Follow-up multimodal

El usuario agrega un adjunto y espera que el siguiente turno lo tome como parte del caso.

Necesidad:

- integrar el adjunto al contexto conversacional efectivo

## 6. Casos donde falta contexto

- follow-up corto tratado como mensaje independiente
- `sí/no/ok` interpretado sin estado pendiente real
- cambio de eje mezclado con el tópico anterior
- aclaración posterior tratada como conversación nueva
- datos fragmentados que no se consolidan
- adjunto visible pero no usable por el runtime
- mensajes automáticos o de sistema contaminando el hilo principal

## 7. Reglas conversacionales sugeridas

### 7.1 Clasificar el tipo de turno antes del contenido

Primero decidir si el mensaje es:

- apertura
- consulta
- clarificación
- follow-up
- coordinación
- soporte
- cierre

Luego decidir cómo responder.

### 7.2 Mantener un hilo activo explícito

El runtime debe sostener al menos:

- tema activo
- subtópico
- etapa de conversación
- datos pendientes

### 7.3 Tratar la elipsis como normal, no como excepción

Los follow-ups cortos deben considerarse dependientes por defecto cuando exista continuidad reciente.

### 7.4 Pedir el dato mínimo faltante

Si no se puede resolver, la salida no debe ser un fallback técnico sino una clarificación mínima y accionable.

### 7.5 Separar tema principal de coordinación operativa

La conversación puede hablar de:

- qué se está consultando
- cómo se sigue

Ambos ejes deben poder convivir sin mezclarse.

### 7.6 Validar confirmaciones y cancelaciones contra estado

Un `sí` o `no` solo deben cerrar algo si realmente hay una espera de confirmación en memoria.

### 7.7 Hacer que multimodalidad participe del hilo

Los adjuntos deben:

- aparecer en transcript
- ser interpretables por el runtime
- influir en la respuesta siguiente cuando aporten claridad

### 7.8 Separar baseline conversacional de conocimiento del tenant

El runtime común debe resolver:

- continuidad
- follow-ups
- clarificación
- tono base
- coordinación mínima

El tenant define:

- facts
- políticas
- condiciones
- contenido aprobado

## 8. Buenas prácticas de respuesta

- responder corto y con un objetivo claro por turno
- reconocer implícitamente el hilo antes de ampliar
- contestar primero la pregunta puntual
- ampliar solo si agrega valor
- no repetir información ya confirmada
- no usar texto crudo de documentos como respuesta final
- evitar respuestas demasiado amplias a preguntas específicas
- mantener tono humano y operativo, no técnico

## 9. Respuestas efectivas vs inefectivas

### 9.1 Efectivas

- confirman comprensión del hilo
- piden una precisión mínima cuando falta algo
- continúan el tema sin reiniciar
- distinguen entre consulta, aclaración y coordinación
- cierran cada turno con siguiente paso claro

### 9.2 Inefectivas

- responden al tema equivocado por arrastre de contexto
- mezclan dos subthreads en una sola salida
- devuelven información demasiado amplia para una pregunta puntual
- usan fallback genérico cuando ya había contexto suficiente
- exponen wording crudo de source documents o fragments internos

## 10. Señales de frustración y satisfacción

### 10.1 Frustración

Señales comunes:

- repetición de la misma consulta
- pedido de aclaración reiterado
- lenguaje de falla o cansancio
- reclamo por falta de avance

Necesidad:

- respuesta breve
- contención
- siguiente paso claro

### 10.2 Satisfacción

Señales comunes:

- agradecimiento
- confirmación corta
- continuidad sin fricción
- aceptación de siguiente paso

Necesidad:

- cierre breve
- no sobreexplicar

## 11. Casos problemáticos recurrentes

- pérdida de contexto en follow-ups cortos
- mezcla indebida de hilos
- respuestas correctas en contenido pero débiles en naturalidad
- clarificaciones que reinician el caso
- coordinación operativa sin estado suficiente
- multimodalidad visible pero no realmente usada
- respuestas demasiado extensas para preguntas puntuales
- confirmaciones ambiguas fuera de flujo

## 12. Uso esperado en implementación

Este documento debe usarse como contexto para:

- diseño del baseline runtime
- clasificación de mensajes
- diseño de follow-up handling
- validación final de respuestas
- priorización de regresiones QA
- captura y análisis de fallos conversacionales

No debe usarse para:

- codificar respuestas literales
- fijar políticas de un tenant concreto
- extraer conocimiento de negocio
- reemplazar documentos de `knowledge`

## 13. Criterio final

Si este análisis se aplica correctamente, el sistema debería:

- comportarse de forma más natural en conversaciones simples
- sostener continuidad en follow-ups cortos y largos
- distinguir mejor cambio de tema vs continuidad
- reducir respuestas genéricas o desalineadas
- depender menos de fixes puntuales guiados por wording

## 14. Señales reforzadas por el corpus ampliado

En la muestra ampliada de conversaciones reales se refuerzan varias conclusiones del baseline:

- la mayoría de los hilos no son triviales ni de un solo turno; predominan conversaciones medianas y largas
- el patrón dominante no es una consulta aislada, sino una secuencia:
  - apertura
  - acotación
  - entrega de datos
  - coordinación
  - posible aclaración posterior
- la coordinación operativa aparece con mucha frecuencia y debe modelarse como capacidad base, no como excepción
- los adjuntos ya no son un caso raro; imagen, audio y documento forman parte de una porción relevante del corpus
- existe una minoría significativa de hilos de soporte/postventa que no deben mezclarse con consultas comerciales nuevas
- los mensajes automáticos y de sistema aparecen lo suficiente como para requerir filtrado explícito en razonamiento y memoria
- existen hilos reanudados y contactos salientes/proactivos; el sistema no debe asumir que toda conversación empieza con una consulta entrante limpia
- también existen hilos de muy baja señal o abandonados; el baseline debe tolerar conversaciones incompletas sin sobreinferir

Conclusión operativa:

- el runtime debe optimizar primero continuidad, composición de contexto, separación de threads y estado mínimo conversacional
- el contenido del tenant sigue siendo importante, pero sobre una base conversacional que ya soporte conversaciones largas, multimodales, reanudadas y operativas
