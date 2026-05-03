# System Loop Operating Model

Fecha: 2026-05-03

## Base viva

El contrato vivo del sistema para este proceso es:

- [docs/qa/system-use-cases-report.xlsx](/Users/rodrigo/Git/personal/react_admin_dashboard/docs/qa/system-use-cases-report.xlsx)

La fuente estructurada que lo genera es:

- [tools/qa/use-cases-report.source.mjs](/Users/rodrigo/Git/personal/react_admin_dashboard/tools/qa/use-cases-report.source.mjs)

Comando de regeneración:

```bash
node tools/qa/generate-use-cases-report.mjs
```

## Alcance

Este loop cubre:

- funcionalidad de negocio
- APIs
- UI de ecommerce y admin
- analytics
- integraciones externas
- contratos entre servicios

Este proceso excluye `Chat Platform`.

## Loop

Cada iteración debe ejecutar este orden:

1. Creación
2. Actualización
3. Ejecución
4. Detección
5. Corrección
6. Documentación

## Regla operativa

- no hay cambio sin impacto analizado
- no hay feature sin validación
- no hay corrección sin documentación
- no hay contrato sin trazabilidad
- el documento debe reflejar el estado real o el estado objetivo de forma explícita

## Estructura del contrato vivo

Cada caso debe poder responder:

- `id`
- `tipo`: `feature`, `flujo`, `endpoint`, `evento`
- `descripción`
- `comportamiento esperado`
- `inputs`
- `outputs`
- `sistemas involucrados`
- `dependencias`
- `estado`: `pending`, `valid`, `failing`
- `última validación`
- `notas / edge cases`
- `trazabilidad`

## Trazabilidad

La funcionalidad debe poder volver a:

- archivos de implementación
- componentes
- servicios
- endpoints
- eventos
- casos documentados

## Clasificación de hallazgos

Todo hallazgo debe registrarse como uno de estos tipos:

- bug funcional
- inconsistencia entre servicios
- desalineación con documento
- gap funcional
- deuda técnica

Y debe llevar:

- id
- sistema afectado
- flujo impactado
- pasos de reproducción
- severidad: `crítica`, `media`, `baja`
- estado: `open`, `in_progress`, `fixed`, `validated`

## Capas de prueba

1. Flujo end-to-end
2. API
3. Integración
4. Consistencia
5. Analytics

## PR Gate

Para cada PR:

1. identificar impacto
2. actualizar el documento base
3. ejecutar pruebas mínimas
4. validar no regresión cruzada
5. registrar cambios y hallazgos

No se aprueba si:

- rompe una funcionalidad crítica
- no actualiza la documentación cuando corresponde
- deja un hallazgo abierto sin clasificación ni plan

## Frecuencia

- loop corto: por PR o diario
- loop medio: semanal
- loop largo: limpieza estructural o refactor

## Métricas

Medir:

- cobertura del documento vs sistema real
- bugs por ciclo
- regresiones detectadas
- tiempo de resolución
- porcentaje de funcionalidades validadas

