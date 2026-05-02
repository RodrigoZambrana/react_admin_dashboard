# SEO + Content Execution Loop

Fecha: 2026-05-02  
Base de arranque: `bb4e7738` (`add phased seo content backlog`)

## Objetivo

Ejecutar el backlog de SEO y contenido en un loop profundo, sin cortar la iteración hasta cerrar todos los puntos definidos por bloque:

- contenido
- SEO on-page
- estructura
- conversión

La ejecución se ordena por tipo de página:

1. Home
2. Productos
3. Información
4. Contacto

## Regla de loop

No pasar al siguiente bloque hasta que el bloque actual cumpla con:

- contenido alineado a la intención
- SEO on-page coherente
- estructura consistente con el estándar
- CTA y conversión claros

Si una página sigue mostrando ruido, duplicación o pérdida de jerarquía, se vuelve a iterar sobre esa misma página antes de avanzar.

## Secuencia operativa

### Loop 1: Home

Objetivo:

- mostrar oferta real
- ordenar por familia y por tienda
- no duplicar intenciones
- derivar a producto, información y contacto

Chequeos:

- hero superior con productos reales
- secciones de tienda y productos diferenciadas
- soporte comercial y confianza visibles
- navegación coherente con el rol de cada bloque
- CTA final claro

### Loop 2: Productos

Objetivo:

- mantener contenido legacy útil
- ampliar variantes, materiales y uso real
- separar hubs y series donde haya mezcla de intenciones

Chequeos:

- cada ficha tiene una intención única
- el contenido no repite home ni información
- las series y variantes están separadas cuando conviene
- el CTA responde a la intención de la ficha

### Loop 3: Información

Objetivo:

- concentrar guías, comparativas y criterios de decisión
- sostener el SEO informacional sin contaminar fichas de producto

Chequeos:

- una guía = una duda concreta
- cada guía deriva a producto o contacto
- no hay lenguaje interno ni analítico visible

### Loop 4: Contacto

Objetivo:

- convertir
- ordenar cobertura, pagos, urgencia y tiempos

Chequeos:

- formulario simple
- CTA directo
- cobertura y medios visibles
- sin copy institucional innecesario

## Cómo se cierra cada loop

Un loop se considera cerrado cuando:

- la página o bloque auditado cumple la intención
- no quedan secciones duplicadas para el mismo rol
- el CTA principal coincide con la intención
- la navegación interna sostiene la decisión
- el contenido importante no se perdió durante la mejora

## Priorización dentro de cada loop

1. Contenido
2. SEO on-page
3. Estructura
4. Conversión

Si el bloque actual necesita ajustes de varias capas, se resuelve primero contenido y SEO on-page para no construir sobre una base rota.

## Resultado esperado

- menos repetición
- mejor separación por intención
- mejor jerarquía comercial
- mejor alineación entre búsqueda, página y acción
- un sitio que vende y orienta sin perder SEO

## Checkpoint actual

Estado registrado el 2026-05-02:

- `Información` quedó reforzado con nuevas guías y alias de medición.
- `/articulos/dvh.html` quedó consolidado mediante redirect permanente hacia `/guias/dvh` para evitar duplicación de intención.
- `Preguntas frecuentes` y `Quiénes somos` quedaron con snippets SEO más alineados al rol comercial e informacional.
- `Contacto` quedó convertido en hub comercial con hero real, H1 visible y CTA directo.
- La mejora en `Contacto` quedó persistida en CMS y validada en HTML renderizado.
- `Productos` avanzó con `cortinas-tradicionales` llevada al estándar común y enriquecida con editorial real de legacy.
- El baseline actual debe conservarse como referencia antes de seguir con ajustes de `Productos`.
