# Pedido de dirección — cierre gobernado de checkout y medición

Fecha: 2026-09-09
Origen: conversación de planificación con dirección de producto
Audiencia: equipo de plataforma y AI Harness

Necesitamos retomar el programa sin perder el hilo entre lo que se pidió, lo
que hace falta, lo que se decide y lo que realmente entra al backlog. El
pedido es extenso a propósito: describe varios frentes, incluye hechos ya
observados, supuestos no confirmados y al menos una duda que una persona debe
resolver. Ninguna herramienta debe inventar esa respuesta.

## Contexto observado

El repositorio sigue siendo un monorepo con Commerce Suite, Growth Metrics y
el AI Harness conviviendo. El control read-only ya reconstruye vistas generales
y por producto desde `planning/backlog.json`. Eso es un hecho: no existe hoy
una segunda cola autoritativa, y no queremos crearla.

También es un hecho que el storefront puede construir y que el backend expone
flujos de carrito, aunque la compra E2E con medio de pago real todavía no está
certificada para el piloto UruCortinas. Growth Metrics ya ingiere señales, pero
el contrato canónico de eventos todavía no cierra qué cuenta como conversión.

## Necesidad

Operar ecommerce y medición como resultados terminables, cada uno con dueño,
alcance y gate, sin abrir ambos frentes a la vez ni mezclar sus requisitos.

## Requisitos materiales

- El intake debe conservar cada requisito material de este pedido, incluidos los de checkout y los de medición.
- El cierre de checkout ecommerce es un resultado independiente del contrato de métricas y no pueden compartirse en el mismo slice.
- Cada slice debe declarar resultado observable, alcance incluido y excluido, producto dueño y un gate verificable.
- No se debe inferir si el medio oficial de cobro del piloto es Mercado Pago o transferencia bancaria.
- Los slices deben trazarse al backlog canónico en planning/backlog.json y no a una lista paralela.
- Una promoción a ready solo se propone cuando todas las dependencias están done y no quedan decisiones humanas pendientes.
- Si el alcance crece para incluir escritura de campañas publicitarias, ese cambio queda como decisión o supersesión explícita.

## Hechos que no se discuten en este pedido

El árbol Git del harness ya tiene lifecycle con commit local aislado. El
control no escribe el backlog cuando detecta un bloqueo obsoleto. UruCortinas
es el piloto dedicado aprobado en ADR-009.

## Supuestos

Suponemos, sin evidencia de negocio firmada, que el IVA uruguayo se calculará
después del cierre de checkout y que no forma parte de este corte. También
suponemos que GA4 será la fuente primaria de sesiones, pero eso no autoriza a
tratarlo como decisión aceptada.

## Preguntas abiertas

¿El medio oficial de cobro del piloto UruCortinas es Mercado Pago, transferencia
bancaria, o ambos con una regla de desempate? Esta respuesta cambia aceptación,
sandbox, evidencia y rollback. Debe responderla una persona. No complete el
campo con la opción más común ni con lo que aparece en código legado.

## Fuera de alcance de este pedido

No se pide un gestor de proyectos externo. No se pide comenzar automáticamente
una tarea promovida. No se pide que el auditor implemente producto. No se pide
resolver tenancy de nuevo: el modelo híbrido ya está decidido.

## Relato extendido para no perder matices

Cuando un cliente de UruCortinas arma un carrito de cortinas a medida, el
operador necesita saber si puede prometer fecha de producción. Eso depende del
estado de pago y del stock o del pedido a medida, no de una métrica de
campaña. Mezclar ambos en una sola tarea produce un slice que nunca termina:
el checkout espera al pixel y el pixel espera al checkout.

La medición, por su lado, necesita un contrato de eventos que distinga página
vista, agrega al carrito, inicia checkout y compra. Si ese contrato se escribe
dentro del mismo issue que el medio de pago, cualquier cambio de alcance de
publicidad reabre el checkout. Por eso el pedido insiste en slices
independientes y en terminar uno antes de abrir el otro.

Si más adelante dirección quiere que el mismo equipo también dispare pausas de
campañas de Google Ads o Meta, eso no es un detalle menor: cambia permisos,
auditoría, rollback y el tipo de prueba. No se agrega “de yapa”. Tiene que
aparecer como decisión o como supersesión de un acuerdo previo.

El harness debe poder tomar este texto largo, clasificar hechos, supuestos y
dudas, y demostrar con un diff semántico que cada requisito material llegó a
una tarea canónica. Si un requisito desaparece o dos requisitos independientes
se funden, la validación tiene que fallar.
