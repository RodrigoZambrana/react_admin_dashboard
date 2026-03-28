# AI Quote Profiles And Derived Taxonomy Design

## 1. Propósito

Este documento define dos piezas que deben evolucionar juntas:

- `quote profiles` por tenant y por tipo de producto/servicio
- derivación automática de taxonomía y términos útiles desde documentación ya aprobada

Objetivo:

- estandarizar el intake conversacional de cotizaciones
- desacoplar requisitos de presupuesto del código
- alinear el runtime con lo que realmente espera el backend para cotizar
- permitir que conocimiento aprobado alimente taxonomías, aliases, slots y términos portadores sin hardcodear ontología del tenant

Debe leerse junto con:

- [AI_RUNTIME_MINIMAL_DESIGN.md](/Users/rodrigo/git/personal/react_admin_dashboard/docs/AI_RUNTIME_MINIMAL_DESIGN.md)
- [AI_ACTIVE_KNOWLEDGE_INGESTION_PLAN.md](/Users/rodrigo/git/personal/react_admin_dashboard/docs/AI_ACTIVE_KNOWLEDGE_INGESTION_PLAN.md)
- [AI_CONVERSATION_TO_KNOWLEDGE_DRAFT_DESIGN.md](/Users/rodrigo/git/personal/react_admin_dashboard/docs/AI_CONVERSATION_TO_KNOWLEDGE_DRAFT_DESIGN.md)
- [AI_CRITICAL_PROCESS_OWNERSHIP.md](/Users/rodrigo/git/personal/react_admin_dashboard/docs/AI_CRITICAL_PROCESS_OWNERSHIP.md)
- [AI_REUSABLE_CHATBOT_CAPABILITIES.md](/Users/rodrigo/git/personal/react_admin_dashboard/docs/AI_REUSABLE_CHATBOT_CAPABILITIES.md)
- [urucortinas-aberturas-operational-etl-playbook.md](/Users/rodrigo/git/personal/react_admin_dashboard/docs/knowledge/urucortinas-aberturas-operational-etl-playbook.md)
- [urucortinas-quotation-criteria.md](/Users/rodrigo/git/personal/react_admin_dashboard/docs/knowledge/urucortinas-quotation-criteria.md)

## 2. Regla central

El runtime no debe conocer detalles del tenant como si fueran reglas universales.

El runtime base sí puede conocer:

- intents genéricos
- tipos de atributos
- estrategias de pricing
- estados del intake
- reglas conversacionales

El tenant debe proveer por datos:

- familias, temas y variantes
- aliases y typos de dominio
- slots de cotización
- términos portadores de medidas
- requisitos mínimos por perfil
- estrategia de pricing por perfil

## 3. Flujo base de cotización

El comportamiento esperado para customer es:

```text
cliente inicia contacto
  -> se detecta el producto o familia
  -> se selecciona el quote profile activo
  -> se piden solo los datos mínimos faltantes
  -> se evalúa la estrategia de pricing del perfil
  -> si se puede cotizar en el momento, se busca/calcua
  -> si no se puede, se cierra intake y se deriva a operador
```

## 4. Estrategias de pricing

El runtime debe dejar de pensar solo en `handoff` vs `price_or_handoff`.

La estrategia correcta a nivel de perfil es:

### 4.1 `immediate_unit_price`

Caso:

- producto unitario
- precio disponible por unidad

Mínimos:

- producto
- cantidad

Respuesta:

- puede devolver total inmediato si hay match real

### 4.2 `immediate_square_meter`

Caso:

- producto cuyo pricing real depende de superficie

Mínimos:

- producto
- ancho
- alto
- cantidad

Respuesta:

- si existe `price_per_m2` o regla equivalente visible en backend, calcular
- si no existe criterio explícito, no inventar cálculo

### 4.3 `parametric_exact_or_handoff`

Caso:

- matriz paramétrica o compatibilidad técnica real
- ejemplo actual: `aberturas`

Mínimos:

- medidas
- cantidad
- serie
- vidrio
- color
- otros atributos solo si el backend real los exige

Respuesta:

- si existe un producto publicado exacto con precio inmediato para esa configuración, responder en el momento usando el preview autoritativo de backend
- si el backend puede resolver match exacto, devolver cotización
- si no hay match exacto o hay incompatibilidad, no confirmar precio final
- cerrar intake y derivar

### 4.4 `handoff_only`

Caso:

- el sistema no tiene cálculo automático confiable

Mínimos:

- los que defina el perfil

Respuesta:

- confirmar recepción del intake
- informar que un operador continuará

## 5. Contrato objetivo del quote profile

El runtime actual ya consume perfiles declarativos. La extensión inmediata recomendada es esta:

```json
{
  "key": "quote_profile:example",
  "label": "Perfil ejemplo",
  "appliesToTopicKeys": ["product_topic:example"],
  "appliesToTopicLabels": ["producto ejemplo"],
  "familyLabel": "familia ejemplo",
  "pricingStrategy": "handoff_only",
  "closureMode": "collect_then_handoff",
  "measurementCarrierTerms": ["ventana", "puerta", "vano"],
  "attributes": [
    {
      "key": "measurements",
      "label": "las medidas aproximadas (ancho por alto)",
      "captureKind": "measurements",
      "required": true
    },
    {
      "key": "quantity",
      "label": "cuántas unidades necesitás",
      "captureKind": "quantity",
      "required": true
    },
    {
      "key": "color",
      "label": "el color",
      "captureKind": "enum",
      "required": false,
      "subjectPrefix": "color",
      "options": [
        { "value": "blanco", "aliases": ["blanca", "blancos", "blancas"] }
      ]
    }
  ]
}
```

## 6. Tipos de atributos soportados

Los atributos no deben ser especiales por nombre. Deben resolverse por `captureKind`.

### 6.1 `measurements`

Captura:

- ancho
- alto
- unidades
- listas de medidas por item

### 6.2 `quantity`

Captura:

- cantidad total
- cantidad por línea

### 6.3 `taxonomy_tag`

Captura:

- valores presentes en taxonomía aprobada
- ejemplo: `serie`, `linea`, `tipo`

### 6.4 `enum`

Captura:

- valores cerrados aprobados por perfil
- ejemplo: `color`, `vidrio`, `terminación`

## 7. Términos portadores de medidas

Términos como:

- `ventana`
- `puerta`
- `vano`
- `hueco`
- `paño`

no deben competir con el producto principal si aparecen dentro de un bloque de medidas.

Regla:

- si el producto principal ya quedó fijado por el lead del presupuesto
- y luego aparecen estos términos en líneas de medidas
- se tratan como carriers de instalación o referencia física
- no como cambio de tópico

Ejemplo abstracto:

- `presupuesto de X`
- `medidas de ventanas: ...`

Resultado esperado:

- producto principal sigue siendo `X`
- `ventana` solo ayuda a parsear items/medidas

## 8. Alineación con backend real

### 8.1 Productos unitarios

Si el backend o catálogo resuelve precio unitario inmediato:

- pedir cantidad
- calcular total si el precio es real y visible

### 8.2 Productos por `m2`

Si el backend usa `SQUARE_METER` o equivalente:

- pedir ancho
- pedir alto
- pedir cantidad
- calcular superficie y luego total solo si el criterio está realmente disponible

## 9. Taxonomía operativa de `product_not_found`

`product_not_found` no debe significar solo “no existe”.

Para un chatbot reusable, la taxonomía correcta es:

### 9.1 `catalog_missing_but_known_in_knowledge`

Caso:

- existe a nivel informacional en documentos aprobados
- no existe como producto operativo con pricing inmediato

Ejemplo abstracto:

- el negocio maneja la categoría
- el sitio la describe
- no hay SKU/producto/publicación operativa para cotizar en el momento

Salida esperada:

- responder información útil que sí esté aprobada
- relevar intake mínimo para futura cotización
- cerrar con `information -> intake -> handoff`

### 9.2 `catalog_known_but_no_immediate_resolution`

Caso:

- existe en base o en catálogo extendido
- pero no tiene camino automático de precio inmediato
- o su pricing depende de proceso externo

Salida esperada:

- no inventar precio
- confirmar que se tomó el pedido de cotización
- pasar a humano con contexto completo

### 9.3 `catalog_match_ambiguous`

Caso:

- hay más de un match razonable
- no hay forma segura de elegir uno sin preguntar

Salida esperada:

- pedir la precisión mínima
- si la conversación mezcla estrategias o productos, usar el camino menos optimista

### 9.4 `catalog_and_knowledge_missing`

Caso:

- no existe señal confiable ni en catálogo ni en documentación aprobada

Salida esperada:

- evitar afirmar disponibilidad
- pedir reformulación o derivar según el caso

## 10. Flujo general reusable: `information -> intake -> handoff`

Este flujo debe quedar formalizado como baseline reusable, no como excepción de `urucortinas`.

Aplica cuando:

- hay información útil aprobada
- pero no se puede resolver automáticamente
- o el cliente pide material complementario no disponible en el momento

Ejemplos abstractos:

- “me pueden enviar fotos del producto”
- “quisiera más información técnica”
- “quiero ver otras opciones”
- “manejan este tipo de producto pero no está cotizable ahora”

Salida correcta:

1. responder lo informacional que sí está aprobado
2. pedir o confirmar el intake mínimo útil
3. cerrar con mensaje de ampliación o seguimiento humano

Regla importante:

no siempre debe decir “te derivo con un operador”.

También puede decir:

- que se ampliará la información
- que se enviará material complementario
- que se preparará una propuesta/presupuesto

siempre que ese cierre siga siendo consistente con el handoff real.

## 11. Mezcla de productos y estrategias

Si en la misma conversación de presupuesto aparecen:

- productos con precio inmediato
- productos informacionales sin precio inmediato
- productos paramétricos

la política base debe ser:

- resolver de inmediato solo si todos los items comparten una estrategia automática confiable
- si hay mezcla de estrategias, usar el camino menos optimista
- preservar el intake por item para que el humano continúe sin pérdida de contexto

Para `urucortinas`, esto implica:

- productos no paramétricos con resolución inmediata si existen en base
- productos paramétricos o no publicados -> handoff
- mezcla de ambos -> handoff con intake completo

## 12. Particularidad tenant-specific de `urucortinas`

La presupuestación paramétrica y varios productos a medida de `urucortinas` son add-ons del tenant.

No deben reescribir el baseline general.

La separación correcta es:

- baseline reusable:
  - `immediate_unit_price`
  - `immediate_square_meter`
  - `information -> intake -> handoff`
- add-ons tenant-specific:
  - `parametric_exact_or_handoff`
  - taxonomías y perfiles específicos
  - intake extra como `serie`, `vidrio`, `color`

## 13. Gestión de perfiles y sincronización

El sync de curación repetible sirve para bootstrap y recuperación rápida local, pero el camino objetivo de operación debe ser UI/admin.

Recomendación:

- mantener script repetible para soporte local, migración y recovery
- exponer el mismo flujo desde admin para:
  - editar perfiles
  - publicar perfiles
  - refrescar taxonomía derivada
  - sincronizar contra catálogo real

Regla:

el script no debe ser la única forma de dejar consistente la curación activa.

### 8.3 Productos paramétricos

En el caso actual de `aberturas`, el backend real ya exige una estructura operativa más estricta. El runtime customer no debe inventar esa estructura; debe pedirla.

Contrato relevante actual:

- `serie`
- `color`
- `vidrio`
- `widthMm`
- `heightMm`
- otros opcionales según compatibilidad o instalación

Por lo tanto:

- `aberturas` debe seguir yendo por perfil específico
- no por heurística conversacional suelta

## 9. Modelo de derivación automática desde documentos aprobados

## 9.1 Problema que resuelve

Hoy un tenant puede cargar documentación aprobada que ya contiene:

- familias
- variantes
- aliases frecuentes
- slots operativos
- formas idiomáticas reales
- términos portadores

Pero si eso queda solo como texto libre:

- el runtime no lo aprovecha bien
- la taxonomía se mantiene manual
- las correcciones de typo o alias terminan volviendo al código

## 9.2 Principio

Documentos aprobados pueden producir artefactos derivados utilizables por el sistema, pero:

- no deben convertirse en respuestas literales
- no deben crear conocimiento activo opaco
- deben quedar ligados al documento fuente

## 9.3 Qué puede derivarse

### 9.3.1 `topic_taxonomy`

- familias
- temas
- variantes
- aliases
- typos frecuentes

### 9.3.2 `quote_profile_hints`

- atributos requeridos
- atributos opcionales
- slots detectados
- términos de configuración

### 9.3.3 `measurement_carrier_terms`

- `ventana`
- `puerta`
- `vano`
- equivalentes del tenant

### 9.3.4 `keyword_lexicon`

- términos de pricing
- términos de coordinación
- términos frecuentes de consulta
- lenguaje real del tenant

## 10. Persistencia recomendada

Hay dos caminos posibles.

### 10.1 Camino corto: vista derivada no persistida

Ventaja:

- menos migraciones
- si un documento se elimina, desaparece automáticamente del resultado efectivo

Desventaja:

- poca auditabilidad
- difícil revisar qué salió de qué documento

### 10.2 Camino recomendado: artefactos derivados persistidos con vínculo fuerte

Modelo recomendado:

```prisma
enum KnowledgeDerivedArtifactType {
  TOPIC_TAXONOMY
  QUOTE_PROFILE_HINTS
  MEASUREMENT_CARRIER_TERMS
  KEYWORD_LEXICON
}

enum KnowledgeDerivedArtifactStatus {
  ACTIVE
  DISABLED
  STALE
}

model KnowledgeDerivedArtifact {
  id                String   @id @default(cuid())
  tenantKey         String
  scope             KnowledgeDocumentScope
  type              KnowledgeDerivedArtifactType
  status            KnowledgeDerivedArtifactStatus @default(ACTIVE)
  sourceDocumentId  String
  sourceDocument    KnowledgeDocument @relation(fields: [sourceDocumentId], references: [id], onDelete: Cascade)
  content           Json
  metadata          Json?
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  @@index([tenantKey, scope, type, status])
  @@index([sourceDocumentId])
}
```

Con este modelo:

- el artefacto queda explícito
- se puede revisar en admin
- al borrar el documento fuente, se borra el derivado

## 11. Flujo de derivación recomendado

```text
documento aprobado activo
  -> eligibility check
  -> extractor determinístico
  -> artifact draft/active
  -> merge con taxonomía efectiva del tenant
  -> runtime consume vista agregada
```

## 12. Reglas de extracción

La extracción debe ser conservadora.

Extraer sí:

- listas
- headings
- tablas simples
- enumeraciones
- aliases explícitos
- estructuras tipo “serie / color / vidrio”

No extraer automáticamente como taxonomía activa:

- claims comerciales ambiguos
- promesas no estructuradas
- pricing textual no verificable
- párrafos enteros de marketing

## 13. Fusión con taxonomía efectiva

La taxonomía efectiva del tenant debe componerse así:

1. taxonomía curada explícita
2. artefactos derivados activos de documentos aprobados
3. facts derivados de web/doc
4. fallback heurístico mínimo

Prioridad:

- lo curado explícito gana sobre lo derivado
- lo derivado gana sobre heurística

## 14. Estado actual y siguiente slice

Estado actual ya implementado:

- `quote profiles` curados y activos para `urucortinas`
- runtime customer usando `requiredAttributes`, `missingAttributes` y `capturedAttributes`
- términos portadores de medida incorporados al parseo de intake
- `pricingStrategy` ya forma parte del contrato efectivo del perfil
- resolución determinística ya soportada para:
  - `immediate_unit_price`
  - `immediate_square_meter`
  - `parametric_exact_or_handoff`

Pendiente útil siguiente:

1. crear `KnowledgeDerivedArtifact`
2. agregar extractor determinístico para:
   - taxonomía
   - carriers de medida
   - slots de cotización
3. exponer revisión admin de artefactos derivados
4. usar esos artefactos como fuente adicional del `tenant topic taxonomy`

## 15. Criterio final

El resultado buscado es:

- runtime genérico y mantenible
- tenant ontology fuera del código
- quote intake alineado al backend real
- posibilidad de enriquecer taxonomía desde documentos aprobados
- trazabilidad fuerte entre documento fuente y artefacto derivado

## 16. Motor de resolución de cotización

Una vez completo el intake, el runtime debe pasar por una compuerta explícita de resolución.

Salida permitida inicial:

1. `immediate_price`
2. `handoff_with_complete_intake`
3. `product_not_found`

### 16.1 `immediate_price`

Aplica cuando:

- el producto o variante quedó identificado
- existe `quote profile`
- el `pricingStrategy` es inmediato
- y existe match real en catálogo/base de datos para resolver precio

Resolución:

- `immediate_unit_price`
  - buscar producto publicado en `search_products`
  - usar precio unitario visible
  - multiplicar por cantidad
- `immediate_square_meter`
  - buscar producto publicado compatible con `SQUARE_METER`
  - convertir medidas al canon interno
  - calcular superficie por item
  - multiplicar por cantidad y `price_per_m2`

### 16.2 `handoff_with_complete_intake`

Aplica cuando:

- el intake quedó completo
- pero el sistema no tiene cálculo confiable o precio exacto disponible

Debe usarse en:

- perfiles `handoff_only`
- `parametric_exact_or_handoff` sin match exacto
- productos o combinaciones parcialmente conocidas pero no resolubles en el momento

La respuesta no debe sonar a error.

Debe:

- confirmar que la información fue recibida
- dejar claro que se ingresa la solicitud de cotización
- derivar a operador

### 16.3 `product_not_found`

Aplica cuando:

- el usuario dejó completo el intake
- el producto o variante no encuentra match en la base operativa para pricing inmediato

No debe cerrarse como “no existe” automáticamente.

Antes de decidirlo, el sistema debe distinguir:

- producto realmente inexistente
- producto o familia conocida en knowledge/documentación, pero sin SKU o pricing operativo listo

Subtipos recomendados:

- `catalog_missing_but_known_in_knowledge`
  - hay información útil para responder
  - no hay producto operativo para pricing inmediato
  - salida correcta: información -> intake -> handoff
- `catalog_and_knowledge_missing`
  - no hay sustento suficiente ni en catálogo ni en knowledge aprobada
  - salida correcta: aclaración mínima o boundary response, según contexto

## 17. Caso generalizado: información -> intake -> handoff

Este debe quedar como flujo base reutilizable, no como excepción.

Aplica cuando:

- hay información útil aprobada para responder dudas frecuentes
- pero no existe resolución automática completa
- o existe una mezcla de productos donde solo algunos resuelven precio inmediato

Flujo:

1. responder la parte informacional que sí está sustentada por knowledge aprobada
2. relevar los datos mínimos faltantes para una futura cotización o gestión
3. cerrar con mensaje operativo y derivación humana

Ejemplos abstractos:

- el producto se conoce conceptualmente, pero no hay SKU publicado
- el producto existe, pero la variante exacta no tiene cálculo inmediato
- una conversación mezcla productos inmediatos y no inmediatos
- el perfil es paramétrico y requiere validación/proveedor externo

La regla es:

- primero ayudar con información realista
- después completar intake mínimo
- después cerrar correctamente si no puede resolverse automático

## 18. Mezcla de productos en una misma conversación de presupuesto

No se debe intentar una única respuesta monolítica si el turno mezcla productos con estrategias distintas.

Casos posibles:

### 18.1 Todos inmediatos

- resolver cada item si hay match
- devolver subtotales y total

### 18.2 Mixto: algunos inmediatos y otros no

- resolver de inmediato los que sí tengan pricing confiable
- dejar explícito cuáles quedan para cotización asistida/handoff
- no bloquear todo el flujo por el item no resoluble

### 18.3 Ninguno inmediato, pero intake completo

- usar `handoff_with_complete_intake`

### 18.4 Múltiples productos con intake incompleto

- pedir los faltantes por item o invitar a elegir con cuál empezar
- mantener `conversation threads` separados por producto/familia

## 19. Separación entre baseline SaaS y tenant-specific

Baseline general:

- `immediate_unit_price`
- `immediate_square_meter`
- `handoff_only`
- flujo `information -> intake -> handoff`
- mezcla de productos
- detección de producto no encontrado

Tenant-specific `urucortinas`:

- `parametric_exact_or_handoff`
- atributos `serie`, `vidrio`, `color`
- compatibilidades paramétricas
- cotización externa por proveedor
- reutilización posterior si la combinación exacta termina publicada en base

Regla:

- lo paramétrico no debe contaminar el baseline general del SaaS
- debe vivir solo en perfiles y conocimiento del tenant

## 20. Continuación después de la cotización

El diseño debe contemplar el paso siguiente cuando el cliente acepta una cotización o pide visita técnica sin presupuesto previo.

### 20.1 Después de cotización aceptada

Flujo esperado:

1. cotización aceptada por el cliente
2. iniciar agenda de visita técnica de confirmación
3. pedir o confirmar:
   - día
   - horario
   - dirección
   - contacto
   - comentarios/motivo
4. consultar disponibilidad real en `activities`
5. confirmar o proponer alternativa
6. agendar visita

### 20.2 Visita técnica sin cotización previa

Mensajes tipo:

- “¿hacen cotizaciones a domicilio?”
- “quiero coordinar una visita”

Flujo esperado:

1. detectar intención de visita técnica
2. pedir datos mínimos:
   - día u horario deseado
   - dirección
   - contacto
   - motivo
3. validar disponibilidad en `activities`
4. agendar o proponer alternativa

## 21. Plan de implementación claro

### Fase 1. Motor de resolución estable

- mantener las tres salidas explícitas:
  - `immediate_price`
  - `handoff_with_complete_intake`
  - `product_not_found`
- resolver unitario y `m2` contra `search_products`
- mantener paramétrico solo donde aplique por tenant

### Fase 2. Fallback generalizado

- formalizar `information -> intake -> handoff`
- usarlo cuando:
  - hay conocimiento útil pero no pricing
  - el producto no tiene SKU operativo
  - hay mezcla de items resolubles y no resolubles

### Fase 3. Catálogo de perfiles reales

- cargar por admin los perfiles reales de `urucortinas`
- dejar `immediate_*` para todos los no paramétricos que existan en base
- reservar `parametric_exact_or_handoff` solo para lo que realmente depende de proveedor externo o matriz exacta

### Fase 4. Multi-item y multi-product

- soportar subtotales por item
- separar ítems inmediatos de ítems en handoff
- consolidar una respuesta única y clara

### Fase 5. Post-quote visit scheduling

- integrar lookup de disponibilidad en `activities`
- proponer/agendar visita técnica
- cerrar el circuito después de aceptación o pedido directo de visita
