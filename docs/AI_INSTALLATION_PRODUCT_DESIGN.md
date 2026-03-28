# AI Installation Product Design

## Objetivo
Resolver preguntas del tipo `¿incluye instalación?` sin mezclar:
- baseline reusable de ecommerce
- reglas comerciales particulares de `urucortinas`

La respuesta no debe salir de heurísticas conversacionales duras.
Debe salir de datos estructurados y de una política comercial explícita.

## Separación correcta

### Baseline ecommerce
Capacidad reusable para cualquier tenant que venda:
- productos simples
- variables
- bundles
- servicios complementarios

Debe poder responder:
- si un ítem incluye un servicio
- si el servicio es opcional
- si el servicio va separado
- si todavía no hay forma confiable de afirmarlo

### Add-on tenant-specific: `urucortinas`
En `urucortinas`, instalación no es una propiedad universal:
- algunas propuestas la contemplan
- otras la dejan separada
- algunas dependen de zona o alcance
- en cotizaciones paramétricas puede no quedar definida hasta la propuesta final

Eso no debe contaminar el runtime general.
Debe vivir en:
- catálogo
- quote profiles
- relaciones de producto
- políticas comerciales del tenant

## Modelo de datos recomendado

### Nivel baseline
Agregar una resolución comercial explícita para instalación.

En producto, variante o relación comercial:
- `installationResolutionMode`

Valores:
- `included`
- `optional_add_on`
- `separate_service`
- `not_offered`
- `unknown`

Campos complementarios:
- `relatedInstallationProductId`
- `installationPolicySource`
  - `product`
  - `variant`
  - `category`
  - `quote_profile`
  - `quote_result`
- `installationAppliesByDefault`
- `installationZonePolicy`
  - opcional, para tenants que lo necesiten
- `installationPricePresentationMode`
  - `exact`
  - `from_base`
  - `hidden`

### Nivel de cotización/preview
Cuando el backend resuelva una cotización, debe devolver además:
- `installationResolution`
- `installationIncluded`
- `installationRelatedProductId`
- `installationAmount`
- `installationPricePresentationMode`
- `installationRequiresConfirmation`
- `installationNotes`

Esto evita que el runtime tenga que inferir desde texto.

## Prioridad de resolución
Orden de verdad recomendado:

1. resultado exacto de cotización o preview
2. línea de presupuesto ya calculada
3. producto exacto resuelto
4. producto relacionado de instalación
5. política del quote profile
6. política por categoría
7. fallback seguro conversacional

## Contrato de decisión

### Caso 1: `included`
Condición:
- el preview o la línea final confirman instalación incluida

Respuesta:
- confirmación directa
- sin volver a explicar precio interno

Ejemplo esperado:
- `Sí, en esta propuesta la instalación ya está contemplada.`

### Caso 2: `optional_add_on`
Condición:
- existe servicio relacionado
- no consta que esté ya incluido

Respuesta:
- informar que puede agregarse o confirmarse en la propuesta

Ejemplo esperado:
- `La instalación puede contemplarse en la propuesta final según el alcance. Si querés, la dejamos incluida para revisión.`

### Caso 3: `separate_service`
Condición:
- el catálogo o la política indican que va aparte

Respuesta:
- informar que se cotiza por separado

### Caso 4: `unknown`
Condición:
- no hay señal confiable

Respuesta:
- fallback seguro
- no afirmar `sí/no`

Ejemplo esperado:
- `La instalación se confirma según el producto y el alcance del trabajo. Si querés, lo dejamos contemplado en la propuesta para validarlo.`

## Diseño para `urucortinas`

### Regla de producto
Todo lo no paramétrico puede seguir el baseline:
- simple
- variable
- por `m²`

Pero instalación debe resolverse desde política del tenant, no desde código del agente.

### Regla paramétrica
En aberturas y otras cotizaciones externas:
- instalación normalmente queda en `optional_add_on`, `separate_service` o `unknown`
- solo pasa a `included` si el resultado exacto lo confirma

### Casos como el de esteras/persianas
Ejemplo real del corpus:
- el cliente pide precio
- luego aclara `sin instalación`
- la instalación afecta el valor final

Eso confirma que `installationResolutionMode` no puede modelarse solo por familia.
Debe poder cambiar por:
- producto exacto
- variante
- propuesta
- elección del cliente

## Relación con productos relacionados
La mejor opción general es soportar servicios relacionados.

Modelo:
- producto principal
- producto de instalación relacionado
- relación con modo:
  - `auto_include`
  - `optional`
  - `informational_only`

Si en la propuesta final aparecen ambos:
- la respuesta puede confirmar inclusión

Si existe relación pero no fue agregado:
- la respuesta debe quedar en `optional_add_on`

## Precio base de instalación

Hay un caso adicional que no es lo mismo que “precio exacto”:
- `a partir de...`

Eso debe modelarse como presentación comercial del precio, no como nuevo tipo de producto.

Separación correcta:
- `installationChargeScope`
  define cómo se calcula
- `installationPricePresentationMode`
  define cómo se comunica

Ejemplos:
- `PER_QUOTE` + `EXACT`
  - instalación fija por cotización y comunicable como monto exacto
- `PER_QUOTE` + `FROM_BASE`
  - instalación base por cotización, comunicable como `a partir de USD 150`
- `MATCH_PRODUCT_MEASUREMENTS` + `HIDDEN`
  - existe cálculo programático, pero no debe exponerse automáticamente al cliente

Esto permite cubrir:
- precio exacto
- precio base orientativo
- precio no publicable

## Responsabilidad por capa

### Backend
Fuente de verdad.
Debe resolver:
- producto exacto
- política de instalación
- preview con breakdown
- relación con servicio complementario

### Runtime
No decide política.
Solo:
- detecta la pregunta
- consulta el estado comercial resuelto
- responde según el modo devuelto

### Knowledge
Sirve para:
- explicar en términos generales cómo suele manejarse instalación
- no para confirmar inclusión en un caso puntual si backend no lo sabe

## Plan de implementación

### Fase 1
Agregar en backend contrato de resolución:
- `installationResolutionMode`
- `installationIncluded`
- `installationAmount`
- `installationRequiresConfirmation`

### Fase 2
Extender preview y quote resolution para devolver esos campos.

### Fase 3
Permitir relaciones `producto -> servicio de instalación`.

### Fase 4
Exponer política por producto/variante en admin.

### Fase 5
Para `urucortinas`, cargar política inicial por catálogo y quote profiles.

## Decisión operativa actual
Mientras no exista confirmación estructurada suficiente, la respuesta customer correcta para `¿incluye instalación?` es conservadora.

Respuesta objetivo:
- no prometer inclusión
- no negar de forma tajante
- dejar explícito que depende del producto y del alcance

Forma recomendada:
- `La instalación se confirma según el producto y el alcance del trabajo. Si querés, la dejamos contemplada en la propuesta para validarlo.`

## Casos que deben diferenciarse

### Caso A: instalación incluida y confirmada
Fuente válida:
- preview exacto
- propuesta exacta
- producto o variante con política explícita

Salida:
- afirmación directa

### Caso B: instalación disponible pero opcional
Fuente válida:
- servicio relacionado
- política de categoría
- quote profile del tenant

Salida:
- se informa que puede agregarse o confirmarse

### Caso C: instalación separada
Fuente válida:
- producto relacionado obligatorio o política explícita de servicio aparte

Salida:
- se aclara que se cotiza aparte

### Caso D: instalación desconocida
Fuente válida:
- no hay confirmación estructurada suficiente

Salida:
- fallback conservador

## Relación con el baseline reusable
En ecommerce reusable, instalación debe modelarse como un servicio complementario o como una política comercial del producto.

En `urucortinas`, además:
- puede depender de zona
- puede depender del alcance
- puede depender de una cotización externa
- puede definirse recién en la propuesta final

Eso confirma que:
- la lógica general debe ser reusable
- la política concreta debe cargarse como add-on de datos

## Próximos pasos de implementación
Orden recomendado:

1. completar primero los ajustes de fluidez y estado del runtime:
   - wording híbrido en claves seguras
   - `quote_handoff` rico
   - puente `support_request -> schedule_request`
2. modelar `installationResolutionMode` en backend y exponerlo en preview/cotización
3. soportar producto relacionado de instalación y su modo:
   - `auto_include`
   - `optional`
   - `informational_only`
4. permitir política de instalación en quote profiles del tenant
5. hacer que el runtime solo lea el resultado resuelto y no infiera desde texto
6. recién después habilitar respuestas afirmativas fuertes

## Criterio de salida
Si el backend no sabe resolver instalación con datos estructurados, el runtime no debe completar ese hueco con IA ni con heurísticas comerciales blandas.

## Criterio final
El agente solo debe responder `sí, incluye instalación` cuando:
- exista confirmación estructurada en producto/preview/propuesta

En cualquier otro caso:
- explicar
- relevar
- dejarlo contemplado para propuesta

Eso mantiene el baseline reusable de ecommerce y deja la casuística de `urucortinas` como add-on de datos, no como flujo duro del runtime.
