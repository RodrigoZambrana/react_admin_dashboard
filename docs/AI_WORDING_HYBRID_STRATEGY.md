# AI Wording Hybrid Strategy

## Objetivo
Definir una estrategia reusable para que el chatbot suene más natural sin perder control, grounding ni trazabilidad.

## Principio
La semántica de la respuesta debe seguir siendo determinística.
La IA solo puede variar la forma de decirla, no el significado operativo.

## Capas
1. `semantic_key`
   Ejemplo: `customer.quote.handoff_ready`, `customer.schedule.progress.ask_time`.
   Esta es la unidad estable del sistema.

2. `base_variants`
   Variantes humanas curadas por clave semántica.
   Deben ser configurables fuera de código.

3. `runtime_overrides`
   Overrides por tenant, capability o experimento.
   Sirven para ajustar tono o wording sin deploy.

4. `style_profile`
   Perfil declarativo, no literal.
   Ejemplos:
   - `brief_operational`
   - `warm_commercial`
   - `formal_service`
   - `technical_support`

5. `grounded_rewrite`
   Paso opcional con IA.
   Toma:
   - semantic key
   - facts ya resueltos
   - restricciones del perfil
   - contexto local de la conversación
   Devuelve solo una reformulación segura.

## Cuándo usar IA
Sí:
- cierres
- pedidos de un dato faltante
- frases de transición
- aclaraciones suaves
- reexpresión para evitar repetición mecánica

No:
- facts sensibles
- políticas
- montos calculados
- disponibilidad
- ejecución de acciones
- campos de payload

## Contrato recomendado
Entrada:
- `semanticKey`
- `facts`
- `conversationContext`
- `styleProfile`
- `allowedTransforms`

Salida:
- `finalText`
- `usedFacts`
- `rewriteApplied`
- `safetyChecks`

## Reglas de seguridad
- no inventar facts
- no cambiar números, fechas, precios o direcciones
- no introducir políticas nuevas
- no cambiar la intención operativa
- fallback automático a variante determinística si el rewrite falla

## Recomendación
Mantener el registry como fuente principal.
Agregar IA solo como `surface layer` para naturalización controlada.
Eso evita depender de un diccionario enorme y, a la vez, evita que el modelo se convierta en la fuente de verdad.

## Hallazgos actuales del runtime
Las últimas corridas sobre conversaciones reales muestran que los problemas más relevantes ya no son solo de wording.

Patrones observados:
- en cotizaciones largas, el cierre es correcto pero demasiado genérico cuando el intake ya quedó completo
- en soporte o postventa, el hilo todavía puede romperse y volver por error a un flujo de cotización
- en preguntas como `incluye instalación?`, el problema principal es de ontología y política comercial, no de redacción
- la variación superficial del texto no compensa desvíos de estado, tópico o resolución comercial

Conclusión:
- el wording híbrido debe seguir siendo una capa de naturalización
- no debe absorber problemas que en realidad pertenecen a estado conversacional, resolución comercial o backend

## Aplicación correcta del enfoque híbrido
La secuencia recomendada para cada respuesta customer es:

1. resolver semántica y estado
2. construir `semanticKey`
3. elegir variante determinística del registry
4. aplicar override de tenant/capability si existe
5. aplicar rewrite opcional con IA solo si el texto sigue siendo de bajo riesgo

Si falla cualquiera de los pasos 4 o 5:
- se vuelve a la variante determinística
- no se degrada el significado operativo

## Casos donde sí conviene usar la capa de IA
- cierres de handoff cuando ya se capturó intake completo
- pedidos de un solo dato faltante
- transiciones suaves entre subtemas
- evitar repetir exactamente la misma pregunta dentro de una conversación larga
- reformular una respuesta segura ya resuelta por backend

## Casos donde no conviene usar la capa de IA
- confirmación de instalación
- montos de cotización
- disponibilidad de agenda
- política comercial no estructurada
- datos de payload
- decisión entre cotización inmediata y handoff

## Próximos pasos recomendados
Orden sugerido para seguir mejorando coherencia y flexibilidad sin perder control:

1. agregar rewrite híbrido opcional solo a claves seguras y de bajo riesgo:
   - `customer.quote.handoff_ready`
   - `customer.schedule.progress.ask_missing`
   - `customer.support.followup`
   - `customer.product.info_offer`
   - `customer.product.options_offer`
2. enriquecer `quote_handoff` para que, cuando el intake ya esté completo, el cierre mencione de forma grounded:
   - producto
   - cantidad
   - estado de la solicitud
   - próximo paso esperado
3. cerrar el puente `support_request -> schedule_request` con estado compartido explícito
4. ampliar taxonomía tenant para familias menos dominantes antes de ampliar más el rewrite
5. medir siempre contra conversaciones reales antes de ampliar el registry

## Orden de ejecución recomendado
Para esta etapa del proyecto, el orden práctico queda así:

1. aplicar rewrite híbrido en claves seguras para mejorar fluidez visible
2. enriquecer cierres determinísticos para que el rewrite parta de una base mejor
3. corregir puentes de estado donde todavía se rompe el hilo
4. recién después ampliar ontología y políticas comerciales más profundas

## Criterio final
El texto puede sonar más humano, pero nunca debe pasar a ser la fuente de decisión.
La coherencia sale de semántica + estado + datos estructurados.
El wording híbrido solo mejora la superficie visible.
