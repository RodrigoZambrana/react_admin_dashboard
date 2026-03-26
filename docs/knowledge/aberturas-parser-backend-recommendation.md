# Aberturas · Backend Parser Recommendation

## Conclusión

Sí, es recomendable y viable mover la lógica compleja de parseo de `aberturas` al backend como código funcional propio del sistema.

La responsabilidad del agente debería quedar limitada a:

- identificar intención
- elegir el flujo correcto
- pedir faltantes o confirmación
- adaptar el mensaje según rol/scope

La responsabilidad del sistema debería ser:

- parsear
- normalizar
- validar
- aplicar reglas de negocio
- producir payloads estructurados
- decidir si algo queda listo para alta, revisión o cotización

## Motivo

`Aberturas` ya es un flujo operativo con reglas de negocio suficientes como para no dejar el criterio principal dentro del prompt.

Hoy el repo ya tiene una base importante en:

- [ai.service.ts](/Users/rodrigo/git/personal/react_admin_dashboard/backend/src/ai/ai.service.ts)
- [aberturas-glossary.service.ts](/Users/rodrigo/git/personal/react_admin_dashboard/backend/src/aberturas/aberturas-glossary.service.ts)
- [parametric-pricing.service.ts](/Users/rodrigo/git/personal/react_admin_dashboard/backend/src/pricing/parametric-pricing.service.ts)

Pero todavía parte de la robustez del flujo depende de:

- prompting
- heurísticas embebidas en la conversación
- interpretación del agente sobre cuándo alta vs cotización

Eso no es el mejor lugar para una lógica que necesita:

- determinismo
- trazabilidad
- tests estables
- compatibilidad por tenant
- evolución por reglas de negocio

## Viabilidad

La viabilidad es alta porque:

1. el proyecto Python ya aporta una referencia clara de pipeline
- normalizers
- extractors
- validators
- confidence
- dedup
- API

2. la documentación consolidada ya convirtió ese material en contrato entendible dentro del repo
- [aberturas-admin-internal-master-prompt.md](/Users/rodrigo/git/personal/react_admin_dashboard/docs/knowledge/aberturas-admin-internal-master-prompt.md)
- [aberturas-parser-process-survey.md](/Users/rodrigo/git/personal/react_admin_dashboard/docs/knowledge/aberturas-parser-process-survey.md)
- [urucortinas-aberturas-operational-etl-playbook.md](/Users/rodrigo/git/personal/react_admin_dashboard/docs/knowledge/urucortinas-aberturas-operational-etl-playbook.md)

3. el backend actual ya tiene endpoints y DTOs donde encastrar el parser sin rehacer la arquitectura
- `parseAberturas`
- `prepareAberturasInsert`
- `prepareAberturasQuote`

4. ya existen regresiones funcionales en runtime y UI para proteger el comportamiento

## Recomendación arquitectónica

Crear una capa propia bajo `backend/src/aberturas/parser` o `backend/src/ai/aberturas-parser` con módulos separados:

- `types.ts`
- `normalizers.ts`
- `segmenter.ts`
- `extractors.ts`
- `context.ts`
- `validators.ts`
- `snapshots.ts`
- `dedupe.ts`
- `mappers.ts`
- `service.ts`

## Responsabilidades sugeridas

### Backend parser

- normalizar texto
- limpiar prefijos de WhatsApp
- segmentar por separadores y keywords
- aplicar herencia contextual limitada
- extraer atributos
- calcular score
- emitir warnings
- deduplicar
- producir:
  - parse result
  - insert-ready result
  - quote-ready result

### Servicios de negocio

- resolver glosario vivo
- compatibilidades DVH / monoblock / size limits
- pricing paramétrico
- defaults por tenant
- reglas de publicación/alta real

### Agente

- distinguir:
  - alta
  - cotización
  - parseo
- llamar la tool correcta
- resumir el resultado
- pedir faltantes
- pedir confirmación si corresponde
- responder distinto para:
  - `admin_internal`
  - `customer_public`

## Qué conviene portar del proyecto Python

Sí conviene portar conceptualmente:

- pipeline por etapas
- extractores separados por atributo
- herencia contextual controlada
- score y warnings
- deduplicación por clave canónica
- soporte para WhatsApp y PDF
- snapshots exportables

No hace falta portar 1:1:

- FastAPI
- exportadores XLSX como primera prioridad
- estructura exacta de API externa

Eso debe reimplementarse nativamente en TypeScript/Nest para mantener una sola plataforma operativa.

## Beneficios esperados

- prompts mucho más simples
- menos alucinación o mezcla de atributos
- reglas de negocio versionables en código
- mejor cobertura de tests
- resultados consistentes entre operador, QA y producción
- menor dependencia del “humor” del modelo para parseo estructural
- posibilidad de reutilizar el parser fuera del agente
  - importaciones
  - ABM asistido
  - procesos batch
  - PDFs
  - validaciones previas de formularios

## Riesgos

- duplicar lógica entre prompt y backend si no se limpia el prompt después
- dejar reglas repartidas entre `ai.service.ts` y un parser nuevo si no se hace refactor de verdad
- mezclar reglas genéricas con reglas específicas de `urucortinas`

## Mitigación

- el parser backend debe ser la única fuente de verdad estructural
- el prompt maestro debe pasar a describir uso y límites, no reglas de parseo finas
- las reglas específicas por tenant deben vivir como configuración/playbook/datos, no hardcodeadas indiscriminadamente

## Plan recomendado

### Fase 1

- estado: completada
- se extrajo desde `ai.service.ts` la lógica actual de:
  - `normalizeAberturasInput`
  - `splitCompositeAberturasLine`
  - parseo por línea
  - scoring
  - construcción de contexto estructurado reutilizable
- ahora vive en:
  - `backend/src/aberturas/parser/aberturas-parser.service.ts`
  - `backend/src/aberturas/parser/types.ts`
  - `backend/src/aberturas/parser/utils.ts`
  - `backend/src/aberturas/parser/__tests__/aberturas-parser.service.spec.ts`
- `AiService` ya consume `AberturasParserService`
- la cobertura unitaria quedó validada junto con `ai.service`

### Fase 2

- incorporar del proyecto Python:
  - herencia contextual controlada
  - warnings estandarizados
  - dedupe canónico
  - mejor soporte de variantes

### Fase 3

- agregar parseo batch de PDF / WhatsApp export
- exponer salida estructurada reutilizable por:
  - admin
  - importaciones
  - tool audit
  - futuros jobs

### Fase 4

- simplificar el prompt del agente
- dejar al agente solo con:
  - intención
  - confirmación
  - lenguaje por rol

## Decisión recomendada

Para `aberturas`, el parser debe evolucionar hacia un subsistema de backend determinístico.

El agente no debería seguir siendo el lugar donde vive la lógica compleja del dominio.
