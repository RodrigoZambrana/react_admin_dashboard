# Webchat Deep Evaluation And Scope

## Objetivo

Llevar el webchat desde un asistente orientado a flujos y acciones a un agente conversacional usable en producción, con:

- mejor comprensión de contexto y cambio de tema
- continuidad multi-turno realista
- fallback mínimo seguro cuando no puede cerrar la resolución
- mejor cobertura para conversaciones no puramente comerciales
- criterio explícito sobre qué se automatiza y qué se deriva a operador

## Estado actual

La calidad del chat mejoró de forma considerable y ya resuelve bien varios flujos:

- cotización inmediata cuando el caso es claro
- handoff con intake relativamente completo
- agenda multi-turno
- continuidad básica de contexto
- lenguaje más natural que en etapas previas

Los principales desvíos que siguen abiertos están en:

- foco del hilo cuando cambia el tema de la conversación
- identificación del producto o necesidad actual frente a arrastre de contexto previo
- mezcla entre flujos comerciales y operativos
- respuestas demasiado rígidas o demasiado genéricas en casos borde
- dificultad para cerrar bien casos no determinísticos sin “romper” la conversación

## Corpus real a usar como fuente de prueba

Fuente principal:

- [summary.md](/Users/rodrigo/git/personal/react_admin_dashboard/.qa/external-real-conversations/whatsapp/summary.md)
- [index.json](/Users/rodrigo/git/personal/react_admin_dashboard/.qa/external-real-conversations/whatsapp/index.json)
- manifests y proposals en:
  - [/Users/rodrigo/git/personal/react_admin_dashboard/.qa/external-real-conversations/whatsapp/manifests](/Users/rodrigo/git/personal/react_admin_dashboard/.qa/external-real-conversations/whatsapp/manifests)
  - [/Users/rodrigo/git/personal/react_admin_dashboard/.qa/external-real-conversations/whatsapp/proposals](/Users/rodrigo/git/personal/react_admin_dashboard/.qa/external-real-conversations/whatsapp/proposals)

Artefactos ya generados:

- [runtime-real-set-evaluation.md](/Users/rodrigo/git/personal/react_admin_dashboard/.qa/external-real-conversations/whatsapp/generated/runtime-real-set-evaluation.md)
- [runtime-real-corpus-short-report-2026-03-28.md](/Users/rodrigo/git/personal/react_admin_dashboard/.qa/external-real-conversations/whatsapp/generated/runtime-real-corpus-short-report-2026-03-28.md)
- [runtime-simulated-conversations.md](/Users/rodrigo/git/personal/react_admin_dashboard/.qa/external-real-conversations/whatsapp/generated/runtime-simulated-conversations.md)

Regla:

- el corpus real de WhatsApp se usa como benchmark de naturalidad, continuidad y cobertura
- no se debe “copiar” texto ni acoplar la solución al tenant o a una conversación puntual
- los hallazgos deben convertirse en reglas y estructuras reutilizables

## Loop de mejora recomendado

### 1. Selección de muestra

Tomar un set corto pero representativo por iteración:

- cotización simple
- cotización mixta
- consulta informativa
- seguimiento de presupuesto
- agenda
- soporte/postventa
- caso no comercial
- caso con multimedia
- caso con interferencia de sistema o cambio de tema

### 2. Ejecución

Correr el runtime actual contra esa muestra usando el stack real.

### 3. Evaluación por turno

Medir:

- coherencia
- continuidad
- correctitud
- cambio de tema
- identificación de intención
- identificación de producto o necesidad
- calidad del wording
- seguridad comercial
- cierre útil o handoff correcto

### 4. Clasificación del error

Todo desvío debería caer en una de estas familias:

- `topic_tracking_failure`
- `context_carryover_failure`
- `intent_resolution_failure`
- `quote_resolution_failure`
- `support_operational_failure`
- `handoff_quality_failure`
- `wording_quality_failure`
- `unsafe_claim_failure`

### 5. Ajuste

Primero corregir:

- estado
- contexto
- taxonomía
- ownership de decisión

Y solo después:

- wording
- rewrite híbrido

### 6. Re-prueba

Repetir sobre el mismo set y sobre un set nuevo de control para evitar “overfitting” sobre una conversación puntual.

## Fallback mínimo obligatorio

Cuando el sistema no pueda cerrar una cotización final o una resolución confiable, debe poder hacer al menos esto:

1. identificar la necesidad principal del cliente
2. responder información útil y no inventada
3. pedir o confirmar los datos mínimos que ya se tengan
4. cerrar con continuidad operativa clara

Texto esperado a nivel funcional:

- el sistema reconoce qué quiere el cliente
- indica que un operador continuará a la brevedad
- evita decir “no puedo” de forma seca o vacía

Esto aplica especialmente a:

- cotizaciones incompletas o ambiguas
- cambios bruscos de producto o tema
- consultas operativas no totalmente modeladas
- casos con información insuficiente o no cargada

## Casos no comerciales que deben entrar en alcance

No todo debe tratarse como venta. El agente debería cubrir también:

- envío de comprobante de pago
- consulta por medios de pago
- seguimiento de presupuesto ya enviado
- reprogramación o coordinación
- soporte/postventa básico
- consultas informativas simples

La respuesta esperada no siempre es cotizar. A veces la salida correcta es:

- registrar la necesidad
- informar el siguiente paso
- pedir el dato faltante
- derivar con contexto suficiente

## Viabilidad real con el stack actual

Sí, es viable llegar a un agente conversacional bastante más flexible que uno puramente basado en acciones.

Pero la forma realista no es intentar replicar a ChatGPT como agente general irrestricto.

El modelo objetivo viable con este stack es:

- comprensión conversacional amplia
- memoria de hilo y tema razonable
- resolución guiada por taxonomía, contexto y estado
- ejecución segura sólo cuando hay datos suficientes
- fallback/handoff limpio cuando la conversación supera el nivel de certeza

Eso implica una arquitectura híbrida:

- comprensión flexible por IA
- estado conversacional explícito
- resolución determinística para acciones y respuestas críticas
- reescritura natural sólo sobre claves seguras

## Lo que sí es alcanzable

- diálogo multi-turno bastante natural
- cambios de tema controlados
- cobertura de intents comerciales y operativos frecuentes
- continuidad contextual similar a un operador básico bien guiado
- derivación útil sin perder el hilo

## Lo que no conviene prometer

- un agente generalista del nivel de ChatGPT para cualquier conversación abierta
- comprensión perfecta en todos los cambios de tema sin estructuras de estado
- respuesta 100% libre sin riesgo comercial u operativo
- automatización total de casos con ambigüedad alta o sin datos estructurados

## Decisión de alcance recomendada

El sistema debería dividirse así:

### Zona A: automatización fuerte

- cotización inmediata clara
- agenda clara
- FAQs y contenido sustentado
- follow-ups operativos conocidos
- acciones estructuradas

### Zona B: automatización guiada con fallback

- cotizaciones incompletas
- mezcla de productos
- consultas informativas con falta de datos
- soporte básico
- pago y seguimiento con contexto parcial

### Zona C: operador

- conflicto de contexto alto
- ambigüedad persistente
- temas no modelados o de riesgo
- decisiones comerciales sensibles
- casos donde la información estructurada no alcanza

## Prioridad recomendada de implementación

### 1. Fallback mínimo universal

Agregar una salida estándar y reusable para:

- `need_identified_operator_continues`

Campos mínimos:

- necesidad detectada
- producto o tema principal si existe
- datos ya capturados
- próximo paso

### 2. Segmentación de tema y cambio de contexto

Agregar estado explícito por conversación para distinguir:

- tema actual
- tema previo
- intención activa
- intención latente
- condición de cambio de hilo

### 3. Cobertura operativa no comercial

Empezar por:

- comprobante de pago
- consultas de pago
- seguimiento de presupuesto
- soporte/revisión

### 4. Harness de evaluación continua

Formalizar una corrida repetible contra corpus real con:

- scoring por conversación
- scoring por turno
- diff entre versiones

### 5. Decisión final de alcance

Con los resultados del corpus real, decidir explícitamente:

- qué flujos quedan automáticos
- qué flujos quedan híbridos
- qué flujos se derivan siempre a operador

## Criterio de cierre de esta línea

Se considerará suficientemente maduro cuando:

- el agente mantenga tema y contexto en la mayoría de los cambios de turno
- no mezcle productos o medidas de forma frecuente
- resuelva bien casos simples y medianos
- no invente respuestas comerciales críticas
- tenga un fallback útil y humano cuando no puede cerrar
- cubra también conversaciones operativas frecuentes, no solo venta
