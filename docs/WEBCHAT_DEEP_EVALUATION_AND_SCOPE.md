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

## Estado validado 2026-03-30 `conversation-first / flow-second`

El slice arquitectónico principal ya quedó implementado y validado.

Piezas cerradas:

- `conversationContext` explícito como capa superior del hilo
- `supportContext` explícito, alineado con `quoteContext` y `scheduleContext`
- clasificación de modo conversacional:
  - `small_talk`
  - `exploration`
  - `flow`
  - `unclear`
- orchestrator con política:
  - entender primero
  - elegir carril después
  - pedir solo el siguiente dato útil
- `AI-assisted decision engine` acotado a acciones permitidas
- coalescing natural de mensajes cortos para dejar que el usuario “termine” de escribir

Reglas que quedan fijadas:

- memoria/contexto no dependen obligatoriamente de una llamada al provider
- la IA puede interpretar y recomendar, pero no decidir libremente negocio
- la respuesta final puede variar por perfil de canal:
  - `chat`
  - `email`

Validación técnica del slice:

- suite completa del agente: `166/166`
- suite de orchestrator, contextos y coalescing: `26/26`
- backend AI config/runtime: `21/21`

## Estado validado 2026-03-29

Luego del ciclo de ajuste sobre corpus real de WhatsApp, el runtime base quedó validado así:

- set muestra: `baseAverage 100`
- set profundo: `baseAverage 100`

Artefactos:

- [runtime-real-set-evaluation-sample-2026-03-29.md](/Users/rodrigo/git/personal/react_admin_dashboard/.qa/external-real-conversations/whatsapp/generated/runtime-real-set-evaluation-sample-2026-03-29.md)
- [runtime-real-set-evaluation-deep-2026-03-29.md](/Users/rodrigo/git/personal/react_admin_dashboard/.qa/external-real-conversations/whatsapp/generated/runtime-real-set-evaluation-deep-2026-03-29.md)

Casos que quedaron efectivamente cerrados en esta iteración:

- comprobante/pago como continuidad operativa, incluso cuando el turno trae solo el nombre del archivo
- cambio de eje desde cotización a service puntual, por ejemplo `enrollador/cinta`
- continuidad natural entre soporte, agenda y seguimiento operativo

Límite que sigue abierto y debe tratarse como siguiente foco:

- la capa `playbook-assisted / rewrite híbrido` todavía puede degradar respuestas que la base ya resuelve bien

Conclusión práctica:

- el problema principal ya no está en clasificación base, foco o continuidad mínima
- el problema siguiente está en cómo naturalizar sin degradar precisión ni dirección

## Estado validado 2026-03-29 `corpus ampliado`

Luego de reingestar el corpus real ampliado de WhatsApp y volver a correr el loop:

- corpus real: `149` conversaciones
- proposals derivados: `466`
- turns totales: `2911`
- set derivado `deep mixed`: `47` escenarios
- set derivado `category_focus`: `21` escenarios
- score promedio base `deep mixed`: `90`
- score promedio assisted `deep mixed`: `90`
- score promedio base `category_focus`: `91`
- score promedio assisted `category_focus`: `90`

Artefactos:

- [proposal-derived-real-set-mixed-2026-03-29.json](/Users/rodrigo/git/personal/react_admin_dashboard/.qa/external-real-conversations/whatsapp/generated/deep-2026-03-29/proposal-derived-real-set-mixed-2026-03-29.json)
- [runtime-real-set-evaluation-deep-2026-03-29.md](/Users/rodrigo/git/personal/react_admin_dashboard/.qa/external-real-conversations/whatsapp/generated/deep-2026-03-29/runtime-real-set-evaluation-deep-2026-03-29.md)
- [runtime-real-set-evaluation-category-2026-03-29.md](/Users/rodrigo/git/personal/react_admin_dashboard/.qa/external-real-conversations/whatsapp/generated/category-2026-03-29/runtime-real-set-evaluation-category-2026-03-29.md)
- [runtime-real-question-answer-review-2026-03-29.md](/Users/rodrigo/git/personal/react_admin_dashboard/.qa/external-real-conversations/whatsapp/generated/deep-2026-03-29/runtime-real-question-answer-review-2026-03-29.md)

Casos reforzados en esta pasada:

- follow-ups cortos de medios de pago como `¿Y con transferencia?`
- follow-ups visuales dentro de un hilo comercial como `¿Tenés foto de cómo quedaría?`
- adjuntos puros como `PTT-...opus (archivo adjunto)` con continuidad mínima útil
- turnos compuestos de `support + visit + payment condition`
- payloads administrativos de agenda como dirección/teléfono/horario dentro de hilos operativos
- aclaración de presupuesto ya emitido sin reiniciar el intake desde cero

Límites reales que siguen abiertos:

- multimodal sin transcripción ni caption sigue resolviendo continuidad mínima, no comprensión rica
- algunos reenganches largos de postventa todavía se desvían a presupuesto genérico
- la capa `playbook-assisted / rewrite híbrido` ya no introduce falsas regresiones del harness, pero todavía no aporta una mejora consistente sobre la base

Hallazgo metodológico importante:

- parte de la regresión anterior del modo `assisted` venía de un bug en el harness de evaluación, no del runtime
- el simulador de rewrite parseaba un formato viejo del payload y terminaba devolviendo ecos del tipo `Consulta original: ...`
- corregido eso, la comparación real volvió a una foto más fiel:
  - la base sigue siendo más sólida en varios casos complejos
  - el assisted mejora algunos casos de medios de pago
  - pero todavía no justifica expandirse sobre flujos delicados sin más control

## Estado validado 2026-03-30 `deep current`

Después de cerrar el slice de:

- `multimodal richer continuity`
- `reenganches largos de postventa`
- `rewrite híbrido sólo donde aporta mejora real`

el estado actual quedó así:

- `46` escenarios deep
- `baseAverage 100`
- `assistedAverage 100`
- `deltaAverage +0`
- `0` regresiones assisted sobre el deep set actual
- `0` mejoras assisted necesarias para sostener el score final del set actual

Artefactos actualizados:

- [runtime-real-set-evaluation-deep-current.md](/Users/rodrigo/git/personal/react_admin_dashboard/.qa/external-real-conversations/whatsapp/generated/deep-2026-03-29/runtime-real-set-evaluation-deep-current.md)
- [runtime-real-set-evaluation-deep-current.json](/Users/rodrigo/git/personal/react_admin_dashboard/.qa/external-real-conversations/whatsapp/generated/deep-2026-03-29/runtime-real-set-evaluation-deep-current.json)
- [runtime-real-question-answer-review-current.md](/Users/rodrigo/git/personal/react_admin_dashboard/.qa/external-real-conversations/whatsapp/generated/deep-2026-03-29/runtime-real-question-answer-review-current.md)

Cambios cerrados en este corte:

- la continuidad multimodal de cotización ya no cae a intake genérico cuando llegan adjuntos dentro del hilo
- los adjuntos de cotización quedan asociados al caso con `seguimiento`, no como texto suelto sin continuidad
- los pedidos de cambio o reemplazo sobre instalaciones existentes usan wording orientado a foto + medidas + ubicación, sin forzar `medidas aproximadas` cuando no corresponde
- las preguntas de franja u horario dentro de una coordinación en curso ya no se responden como `horario de atención`
- los follow-ups de soporte tipo `trabajan con este tipo de materiales` se mantienen dentro del carril de service
- los agradecimientos sobre un presupuesto ya enviado dejan de reabrir la cotización como si fuera una consulta nueva
- preguntas meta como `¿En qué podés cotizar?` dejan de contaminar el subject del quote
- el `rewrite híbrido` quedó bloqueado en carriles donde degradaba:
  - follow-ups cortos de medios de pago
  - continuidades multimodales
  - reenganches operativos de soporte
  - follow-ups de reemplazo/assessment
- el fixture deep también quedó corregido para no penalizar aclaraciones de presupuesto o service con señales de topic heredadas que no correspondían

Regla consolidada:

- el rewrite sólo entra donde mejora naturalidad sin romper continuidad
- si el turno es operativo, multimodal o follow-up corto con contexto fuerte, se conserva la salida determinística
- el registry de wording ya soporta perfiles por canal:
  - `chat`: más ágil y corto
  - `email`: más formal y estructurado

Conclusión práctica del estado actual:

- el runtime ya no tiene el problema principal en `thread/context` ni en continuidad multimodal básica
- el control del backend sigue siendo la fuente de verdad
- la IA queda mejor encuadrada como:
  - interpretación
  - naturalización controlada
  - no decisión de negocio

## Criterio arquitectónico consolidado

El análisis del caso `service / agenda` deja una conclusión estable:

- el problema no es sólo de wording
- tampoco se resuelve dejando al LLM contestar libremente
- el punto crítico es separar con claridad:
  - interpretación
  - estado
  - flujo

### 1. Interpretación

La IA y las heurísticas deben interpretar:

- intención principal
- entidades
- modo conversacional
- señales de continuidad

Pero esa capa no debe decidir negocio ni el siguiente paso final.

### 2. Estado

El runtime necesita memoria explícita por hilo, no sólo inferencia por turno.

Hoy ya existe estado útil en:

- `quoteContext`
- `scheduleContext`
- `supportContext`
- `conversationContext`
- `threadResolution`

Eso cubre explícitamente:

- producto o familia activa
- objetivo del usuario
- modo del hilo
- dato siguiente realmente útil
- producto instalado
- problema detectado
- slots operativos ya capturados
- etapa actual del caso

Regla obligatoria:

- nunca volver a pedir un dato ya capturado en estado

### 3. Flujo

El backend debe decidir siempre el siguiente paso.

Forma correcta:

- interpretar mensaje
- actualizar estado
- decidir siguiente slot o acción
- recién después generar wording

No forma correcta:

- dejar que el LLM improvise la conversación de punta a punta

### Aplicación práctica al caso de service

En flujos como:

- `reparan cortinas de enrollar`
- `es una persiana de pvc`
- `quiero reparar una existente`
- `091... es ne fraga 2137`

el sistema correcto debe:

- mantener `support_request`
- registrar tipo de producto instalado
- abrir agenda cuando aparezcan teléfono/dirección/fecha/hora reales
- evitar respuestas de catálogo
- evitar repreguntas fuera de orden
- confirmar cuando ya tiene todos los datos

## Recomendación sobre frameworks tipo Rasa

Sí, la idea de usar un framework clásico para `intents + entities + contexto básico` es viable técnicamente.

Pero en este stack, hoy no es la recomendación principal.

### Por qué no conviene como paso inmediato

- ya existe una arquitectura híbrida funcionando:
  - interpretación LLM
  - clasificación heurística
  - orchestrator determinístico
  - response generation controlada
- meter Rasa ahora duplicaría responsabilidades
- sumaría otra capa de entrenamiento, mantenimiento y despliegue
- no resuelve por sí solo el problema central actual, que es estado conversacional explícito por proceso

### Dónde sí podría aportar

Podría tener sentido como capa auxiliar si más adelante se necesita:

- dataset etiquetado estable por tenant o vertical
- fallback NLU local sin dependencia de proveedor
- benchmarking separado de `intent/entity extraction`
- entrenamiento supervisado con corpus propio

### Decisión recomendada

- no reemplazar el runtime actual por Rasa
- no mover la decisión de flujo a un framework externo
- sí mantener la arquitectura actual y reforzar:
  - `conversationContext` explícito
  - `supportContext` explícito
  - slots y etapas por proceso
  - interpretación híbrida `LLM + reglas`
  - lenguaje por canal y por registry configurable

Conclusión:

- Rasa es viable
- pero no es el paso óptimo ahora
- el paso óptimo ahora es completar el modelo de estado y flujo dentro del runtime actual

## Principio conversacional objetivo

El modo correcto no es:

- un bot rígido que solo ejecuta formularios
- ni una charla libre sin dirección

El objetivo es un modo híbrido:

- responde naturalmente
- mantiene dirección
- detecta cuándo pasar a flujo

### 1. Responder naturalmente

Sí, la generación de texto debe seguir apoyándose en LLM.

Pero esa naturalidad no debe venir de improvisación libre sobre el negocio. Debe venir de:

- contexto actual
- estado conversacional
- datos sustentados
- rewrite seguro

Resultado esperado:

- el cliente siente una conversación natural
- el sistema no rompe tono ni continuidad
- no inventa respuestas solo para sonar humano

### 2. Mantener dirección

La conversación no debe quedar abierta sin rumbo.

Aunque el usuario venga difuso, el agente siempre debería tender a:

- orientar
- acotar
- proponer opciones

Ejemplo funcional:

- si el cliente dice que está mirando opciones, la respuesta correcta no es solo enumerar cosas
- la respuesta correcta lo ayuda a ubicarse en un eje útil: interior, exterior, ventanas, aberturas, cortinas, visita, pago, seguimiento

Regla:

- el agente no fuerza un formulario
- pero tampoco responde de forma pasiva o decorativa

### 3. Detectar cuándo pasar a flujo

El modo conversacional debe estar siempre escuchando señales para pasar a un flujo operativo.

Eso implica detectar:

- intención suficientemente clara
- necesidad concreta
- producto o familia probable
- evento operativo
- pedido de acción

Ejemplos de señales:

- quiere cotizar
- quiere coordinar visita
- quiere saber medios de pago
- envía comprobante
- pide seguimiento
- pregunta por instalación

Cuando aparece suficiente señal, el sistema debe pasar de:

- conversación exploratoria

a:

- flujo guiado
- intake
- acción
- handoff

sin que el cambio se note artificial o brusco

## Registry configurable: contenido fuera del código, decisión dentro del backend

El runtime no debe quedar atrapado en el patrón:

- `regex -> intent -> mensaje fijo`

porque eso:

- mezcla lógica con contenido
- vuelve costosa cada variación de wording
- escala mal ante nuevas formas de hablar
- empuja a sembrar regexs y frases sueltas por todo el runtime

La estructura correcta pasa a ser:

- `regex / señales / IA -> intent`
- `intent -> tipo de respuesta`
- `response template registry -> borrador controlado`
- `LLM controlado -> lenguaje final`

### 1. Response template registry configurable

El antiguo `wording registry` debe tratarse como un `response template registry`.

Cada clave puede definir:

- `messages`
- `goal`
- `mustAskQuestion`
- `maxChars`
- `allowHybridRewrite`

Esto permite:

- editar wording sin deploy
- versionar contenido separado de la lógica
- mantener el backend como decisor
- usar IA solo para naturalizar una salida ya aprobada

Ejemplo conceptual:

```json
{
  "customer.quote.clarification_followup": {
    "messages": [
      "Claro. Para no cambiarte nada de lo ya cotizado, lo dejo en seguimiento para que te aclaren el total."
    ],
    "goal": "Aclarar un presupuesto ya emitido sin reiniciar el flujo.",
    "allowHybridRewrite": true,
    "maxChars": 220
  }
}
```

### 2. Intent registry híbrido configurable

El fallback semántico ya no debería depender solo de regexs embebidas en código.

La capa correcta es un `hybrid intent registry` configurable con:

- `regexAny`
- `regexAll`
- `includesAny`
- `includesAll`
- `examples`
- `priority`
- `confidence`

Uso correcto:

- heurística primero para casos críticos
- registry híbrido configurable para cubrir variaciones reales
- IA como interpretación y lenguaje, no como decisor principal

Ejemplo conceptual:

```json
{
  "rules": [
    {
      "id": "quote_clarification_runtime",
      "intent": "customer.quote",
      "confidence": 0.92,
      "priority": 80,
      "examples": [
        "me quedó medio raro el precio final",
        "no entendí bien el total del presupuesto"
      ],
      "regexAny": [
        "\\bpresupuesto\\b.*\\b(total|claro|raro|duda)\\b"
      ]
    }
  ]
}
```

### 3. Regla esencial

La IA no reemplaza la lógica.

La IA queda explícitamente como:

- motor de interpretación
- capa de flexibilidad lingüística

La decisión sigue en:

- clasificación controlada
- orchestrator determinístico
- contratos backend

### 4. AI-assisted decision engine controlado

La IA ya no se usa solo para wording alternativo. También puede recomendar el siguiente paso, pero dentro de un contrato rígido.

Input de decisión:

- conversación reciente
- estado actual
- acciones permitidas
- campos requeridos por acción

Salida permitida:

- `action`
- `missingFields`
- `confidence`
- `reasoning`

Regla de ownership:

- la IA no inventa acciones
- la IA no ejecuta flujo
- el backend acepta o descarta la recomendación según confianza, carril activo y reglas duras del proceso

Esto permite:

- más flexibilidad para entender continuidad real
- menos dependencia de regex puntual
- sin perder control determinístico del siguiente paso

## Espera natural antes de responder

La conversación no debe responder cada fragmento de escritura como si ya fuera la idea completa.

Regla implementada:

- si el inbound llega en fragmentos cortos o claramente incompletos, el canal espera una ventana breve adicional
- esos fragmentos se coalescen en un solo turno semántico antes de entrar al runtime

Objetivo:

- reducir cortes artificiales
- evitar que el agente empiece intake demasiado pronto
- parecer más natural en webchat, Meta y WhatsApp

## Capas semánticas: cuándo una señal en español va a la base y cuándo no

Uno de los errores más fáciles en este tipo de runtime es mezclar en la misma capa:

- lenguaje operativo reusable
- vocabulario del dominio
- conocimiento específico del tenant

La regla correcta no es “evitar palabras específicas en español”.

La regla correcta es:

- toda señal que represente una mecánica conversacional reusable debe vivir en la base
- todo vocabulario que dependa del dominio del problema debe vivir en capa de dominio
- todo alias, producto o criterio comercial particular debe vivir en capa tenant/configurable

### 1. Base conversacional reusable

Acá entran señales que no dependen de `urucortinas`, sino de cómo las personas hablan en un flujo operativo real.

Ejemplos correctos:

- continuidad operativa de pago:
  - `comprobante`
  - `adjunto`
  - `te mando`
  - `ya hice el pago`
- captura administrativa de agenda:
  - días
  - horarios
  - dirección
  - teléfono
  - email
- verbos de continuidad:
  - coordinar
  - agendar
  - confirmar
  - revisar
  - acreditar

Estas señales son específicas del idioma, pero no del tenant.

Por eso deben quedar centralizadas como:

- `BASE_CONVERSATIONAL_ES_SIGNALS`

Su función es detectar:

- continuidad
- intención operativa
- payload administrativo
- momento de pasar a flujo

No deben decidir por sí solas:

- producto exacto
- política comercial
- familia del catálogo

### 2. Capa de dominio reusable

Acá entra vocabulario que no es universal del chat, pero sí reusable dentro de un dominio como hogar, aberturas, cortinas, persianas o service.

Ejemplos:

- `cinta`
- `enrollador`
- `lama`
- `eje`
- `soporte`
- `guía`
- `motor`

Estas palabras no deben quedar mezcladas con:

- comprobantes de pago
- agenda
- cortesías
- FAQ generales

Por eso deben vivir en una capa separada, por ejemplo:

- `DOMAIN_SUPPORT_ES_SIGNALS`

Su función es ayudar a reconocer:

- pedidos de service
- recambio de componentes
- continuidad de soporte

sin contaminar la base general del agente.

### 3. Capa tenant / catálogo / knowledge

Acá deben quedar:

- aliases de productos
- familias
- variantes
- nombres comerciales
- reglas particulares de `urucortinas`
- decisiones comerciales como instalación, perfiles de quote o disponibilidad real

Ejemplos:

- `roller blackout`
- `venecianas`
- `bandas verticales`
- `dvh`
- `aberturas probba`

Esto no debe resolverse por regex base si ya existe una fuente estructurada mejor:

- taxonomía tenant
- knowledge aprobado
- quote profiles
- catálogo

### 4. Patrón recomendado para nuevas señales

Cada vez que aparezca un caso nuevo, la pregunta correcta es:

1. ¿Esto describe una mecánica conversacional general?
2. ¿Esto describe un problema reusable del dominio?
3. ¿Esto describe una realidad comercial o taxonómica del tenant?

Si la respuesta es:

- `1` -> base conversacional
- `2` -> capa de dominio
- `3` -> capa tenant/configuración

### 5. Ejemplos concretos del refactor actual

#### Pago

Señales como:

- `comprobante`
- `adjunto`
- `ya hice el pago`
- `archivo adjunto`

deben quedar en base porque representan continuidad operativa reusable.

En cambio:

- `transferencia`

no puede significar por sí sola “seguimiento operativo”, porque también aparece en FAQs de medios de pago.

La decisión correcta es:

- `transferencia` sola = posible método de pago
- `transferencia` + señal de cierre o comprobante = continuidad operativa

#### Soporte

Señales como:

- `cinta`
- `enrollador`
- `lama`
- `motor`

deben quedar en dominio support, no en la base general.

#### Agenda

Señales como:

- `lunes`
- `a las 14`
- `dirección`
- `avenida`
- `mail`

deben quedar en base de agenda porque son payload administrativo reusable para cualquier flujo de coordinación.

## Regla de implementación

No agregar patrones sueltos en cualquier archivo.

La dirección correcta es:

- centralizar semántica reusable
- consumirla desde los clasificadores
- refinarla por contexto
- validar siempre contra corpus real

Eso permite:

- menos hardcode disperso
- mejor mantenibilidad
- menos falsos positivos por mezclar FAQ con soporte o ventas con agenda
- una base reusable para otros tenants o incluso otros dominios

### Regla crítica sobre señales ambiguas

Palabras sueltas como:

- `pasar`
- `venir`
- `cambiar`

no deben abrir por sí solas un flujo operativo.

La activación correcta tiene que apoyarse en:

- frase operacional suficientemente específica
- contexto activo del hilo
- payload administrativo real

Ejemplo:

- `dejan pasar luz` no es agenda
- `¿cuándo podrían pasar a medir?` sí es agenda

La prioridad siempre debe ser:

- primero interpretar el sentido del turno dentro del contexto actual
- después decidir si corresponde pasar a flujo
- recién al final usar señales léxicas como refuerzo, nunca como gatillo aislado

## Modo conversacional recomendado

El agente debería operar con tres modos lógicos:

### 1. Exploración guiada

Se usa cuando el usuario todavía no formuló una necesidad concreta.

Comportamiento esperado:

- responder natural
- hacer una pregunta útil
- reducir ambigüedad
- orientar hacia una categoría o propósito

### 2. Flujo guiado

Se usa cuando ya hay suficiente señal para resolver algo concreto.

Comportamiento esperado:

- pedir sólo los datos necesarios
- no volver a explorar en exceso
- avanzar hacia cotización, agenda, soporte o acción

### 3. Continuidad operativa / handoff

Se usa cuando:

- falta certeza para cerrar
- el caso ya requiere operador
- el sistema puede identificar la necesidad pero no resolverla por completo

Comportamiento esperado:

- no perder el tema
- resumir correctamente la necesidad
- dejar el próximo paso claro

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

Cobertura de test que queda como estándar:

- el bloque de contexto reciente se valida aunque la respuesta final sea determinística
- el guard de snippets crudos se valida aunque no haya una llamada obligatoria al provider
- memoria/contexto se prueba por estado y salida, no por “pasó sí o sí por LLM”

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
