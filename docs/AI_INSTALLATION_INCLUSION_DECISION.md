# AI Installation Inclusion Decision

## Problema
Preguntas como `¿incluye instalación?` no siempre tienen una respuesta binaria estable.
En `urucortinas`, la inclusión puede depender de:
- producto consultado
- forma de cotización
- si existe servicio de instalación asociado
- si la propuesta final ya incluye ese servicio

## Regla actual recomendada
No responder `sí` o `no` de forma fuerte si no existe una señal determinística en datos.

## Estados de resolución
1. `included_confirmed`
   La cotización o el producto resuelto ya incluye instalación de forma explícita.
   Respuesta: confirmar inclusión.

2. `separate_install_service`
   Existe servicio de instalación asociado, pero no consta que esté incluido.
   Respuesta: explicar que puede contemplarse por separado o dentro de la propuesta final según el caso.

3. `unknown_install_policy`
   No existe señal confiable.
   Respuesta: dejar la consulta en modo comercial seguro, sin afirmar inclusión.

## Fuente de verdad futura
La decisión no debe quedar en el runtime.
Debe salir de datos estructurados.

Orden de prioridad:
1. línea cotizada final
2. producto exacto resuelto
3. relación explícita con servicio complementario
4. configuración de categoría
5. fallback seguro conversacional

## Señales candidatas en backend
- línea de presupuesto con `includesInstallation = true`
- producto relacionado de servicio
- categoría con servicio de instalación asociado
- perfil de cotización con política declarada:
  - `included_by_default`
  - `optional_related_service`
  - `separate_service`
  - `unknown`

## Respuesta segura recomendada mientras no exista contrato completo
Para preguntas de inclusión con incertidumbre:
- no reabrir cotización
- no devolver precio otra vez
- responder en modo informacional/comercial

Ejemplo de intención esperada:
`La instalación se define según el producto y el alcance del trabajo. Si querés, la dejamos contemplada en la propuesta para que el asesor te confirme cómo aplica en tu caso.`

## Diseño futuro
Agregar a catálogo o quote resolution una propiedad normalizada:
- `installationResolutionMode`

Valores:
- `included`
- `optional_related`
- `separate`
- `unknown`

Con eso el runtime puede responder sin heurística dura y sin inventar.
