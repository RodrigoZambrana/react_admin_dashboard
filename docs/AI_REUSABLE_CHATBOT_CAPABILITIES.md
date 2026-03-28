# AI Reusable Chatbot Capabilities

## 1. Objetivo

Este documento separa:

- baseline reusable del chatbot
- add-ons por tenant o vertical
- puntos donde la IA agrega valor de naturalidad sin volverse fuente de verdad

La meta futura no es un asistente rígido para un solo cliente, sino un chatbot reusable que pueda operar en combinaciones de:

- ecommerce
- agenda de turnos
- respuestas sobre contenido aprobado
- modos híbridos de esos tres

## 2. Capacidades base reutilizables

Estas capacidades deben existir como módulos generales, no atadas a un tenant concreto:

### 2.1 `content_faq`

Sirve para:

- responder desde conocimiento aprobado
- pedir aclaración mínima
- mantener continuidad y follow-ups

### 2.2 `ecommerce_assistant`

Sirve para:

- detectar producto/interés
- responder disponibilidad, precio, pagos, envíos, horarios, ubicación
- iniciar cotización o compra

### 2.3 `scheduling_assistant`

Sirve para:

- capturar día, horario, dirección, contacto y motivo
- validar disponibilidad real
- crear la cita o visita

### 2.4 `handoff_assistant`

Sirve para:

- cerrar intake
- generar contexto útil para humano
- mantener continuidad sin caer en error técnico

## 3. Add-ons por tenant o vertical

Todo lo que no sea reusable debe vivir como add-on.

Ejemplos:

- productos paramétricos de `urucortinas`
- intake especial por `serie`, `vidrio`, `color`
- políticas comerciales específicas
- taxonomía de dominio
- wording comercial particular

Regla:

los add-ons pueden extender el baseline, pero no reescribirlo.

## 4. Dónde la IA aporta valor real

La IA no debe ser la fuente de verdad ni la capa de ejecución.

Sí agrega valor en:

### 4.1 Reescritura grounded

- tomar hechos ya resueltos
- devolver una respuesta más natural y humana
- variar wording sin cambiar el contenido

### 4.2 Desambiguación liviana

- multi-intent
- follow-ups cortos
- cambios de hilo
- inputs mal redactados

### 4.3 Variación controlada de prompts repetidos

Ejemplo:

en vez de repetir siempre:

- `Perfecto. Ya tengo el día. ¿Querés decirme un horario concreto o preferís que te proponga uno?`

el sistema debería usar una familia de variantes equivalentes.

Eso no debe resolverse hardcodeando muchas frases aisladas en ramas dispersas.

La forma correcta es:

- catálogo de variantes semánticas por `responseKey`
- selección determinística o pseudoaleatoria estable
- optional grounded rewrite final

## 5. Variación de wording sin rigidez

Cada respuesta recurrente debería poder definirse como:

```ts
type ResponseTemplateSet = {
  key: string
  audience: 'customer' | 'admin'
  variants: string[]
  constraints?: {
    requiresKnownFields?: string[]
    forbiddenWords?: string[]
  }
}
```

Ejemplo abstracto:

- `schedule.ask_time_after_day_known`
- `quote.ask_missing_quantity`
- `handoff.intake_complete`
- `content.ask_clarification_location`

Regla:

- el runtime selecciona la intención semántica
- el renderer elige una variante adecuada
- la IA puede reescribir solo si sigue grounded

## 6. Fallbacks más finos que “operador”

No todo caso no resuelto debe caer en:

- `te derivo con un operador`

Deben existir fallbacks especializados:

### 6.1 `information_then_handoff`

Cuando sí hay contenido aprobado pero no resolución automática.

### 6.2 `material_followup`

Cuando el usuario pide:

- fotos
- ejemplos
- material adicional
- detalles no presentes en el momento

Salida esperada:

- confirmar que se ampliará la información
- dejar trazabilidad/handoff
- no responder como error técnico

### 6.3 `quote_handoff`

Cuando el intake de cotización ya está completo pero el precio no puede resolverse automáticamente.

### 6.4 `service_degraded_safe_mode`

Cuando hay una caída o degradación real del servicio y conviene cortar el camino automático antes de exponer mensajes pobres o repetitivos.

## 7. Modo degradado y desactivación masiva

Debe existir una política explícita para apagar o reducir comportamiento automático ante fallos de servicio.

Objetivo:

evitar respuestas del tipo:

- “No puedo resolver la consulta automáticamente en este momento...”

como única experiencia visible en cascada.

Diseño recomendado:

### 7.1 Kill switches por capability

- `aiCustomerFaqEnabled`
- `aiCustomerQuoteEnabled`
- `aiCustomerScheduleEnabled`
- `aiGroundedRewriteEnabled`

### 7.2 Modos de degradación

- `normal`
- `deterministic_only`
- `handoff_only`

### 7.3 Criterio

Si hay fallo sistemático:

- cortar IA opcional primero
- mantener determinístico si sigue confiable
- si tampoco es confiable, pasar a handoff controlado

## 8. Embebido por script

Si el producto se quiere exponer vía script embebido, la arquitectura debe quedar compuesta por capacidades desacopladas.

Capas mínimas:

- widget shell
- transcript/composer
- runtime gateway
- capability profile
- tenant configuration

El script embebido no debe asumir que siempre existe:

- ecommerce
- cotización
- agenda

Debe poder activarse por perfil:

- solo FAQ/contenido
- FAQ + agenda
- FAQ + ecommerce
- FAQ + ecommerce + agenda

## 9. Recomendación de implementación futura

### 9.1 Capability profile

Crear un perfil declarativo por tenant o canal:

```json
{
  "contentFaq": true,
  "ecommerceAssistant": true,
  "schedulingAssistant": false,
  "quoteAssistant": true,
  "parametricQuoteAddon": false
}
```

### 9.2 Add-on registry

Los comportamientos no generales deben entrar por add-ons registrados, por ejemplo:

- `tenant.urucortinas.parametric_quote`
- `tenant.urucortinas.measurement_carriers`

### 9.3 Template registry

Mover prompts repetibles a un registro de variantes en vez de frases sueltas por rama.

### 9.4 UI-managed curation

La sincronización de perfiles, taxonomías y derivados no debería depender solo de scripts.

Camino objetivo:

- admin UI para revisar
- publicar
- refrescar derivados
- ver consistencia con catálogo y knowledge

## 10. Criterio final

La solución futura debe poder reutilizarse así:

- el baseline maneja conversación, FAQ, scheduling y ecommerce simple
- los tenants agregan taxonomía, perfiles y add-ons
- la IA mejora naturalidad, variación y desambiguación
- el backend sigue siendo la fuente de verdad operativa
