# SEO + Content Architecture Backlog

Fecha: 2026-05-02  
Baseline de referencia: `d7bce285` (`backup current CMS and storefront state before backlog rollout`)

## Objetivo

Ejecutar el plan de arquitectura comercial, contenido y SEO sobre el sitio completo sin perder el estado actual, atacando en paralelo:

- distribución correcta del contenido
- separación por intención
- jerarquía comercial
- alineación entre búsqueda, página y acción

El backlog se divide en cuatro fases. Cada fase incluye contenido, SEO on-page, estructura y conversión, pero prioriza un eje principal para evitar re-trabajo.

## Reglas de ejecución

- No eliminar contenido sustancial que ya aporta SEO o ventas.
- No introducir lenguaje analítico al usuario final.
- No reemplazar contenido real por copy genérico.
- Si una página necesita una nueva sección, debe sumar valor real y no duplicar intención.
- Todo cambio editorial debe quedar en CMS o en seeds/scripts reproducibles.
- Las páginas que hoy ya funcionan como base no se reescriben desde cero; se corrigen y amplían.

## Fase 1: Contenido

### 1.1 Home

Objetivo:

- mostrar oferta real desde el primer scroll
- derivar a productos, tienda, información o contacto según intención
- mantener el contenido comercial ya existente

Tareas:

- conservar hero con productos reales de tienda
- asegurar que cada producto destacado explique qué resuelve
- mantener grillas de familias reales
- mantener secciones de confianza, clientes y CTA final
- evitar que la home se convierta en landing editorial genérica

Criterio de aceptación:

- el home muestra productos reales
- el home no borra contenido ya útil
- el home diferencia tienda, productos e información

### 1.2 Productos

Objetivo:

- mantener y ampliar contenido sustancial de legacy
- enriquecer variantes, usos, materiales y decisión comercial
- sostener el SEO de cada familia

Tareas:

- validar y preservar el contenido legado de cada detalle de producto
- ampliar fichas con bloques de decisión: uso, material, exposición, mantenimiento, medida, instalación
- separar nodos cuando una familia tiene variantes fuertes
- mantener secciones repetibles estándar: hero, pago, split editorial, multimedia, CTA, FAQ
- no mezclar páginas de producto con guías informativas

Criterio de aceptación:

- cada producto tiene una intención principal clara
- no hay pérdida de información histórica útil
- variantes y series quedan diferenciadas cuando corresponde

### 1.3 Información

Objetivo:

- concentrar guías, comparativas y criterios de decisión
- reutilizar contenido del documento maestro y del legacy técnico/comercial
- capturar búsquedas informacionales reales

Tareas:

- consolidar guías comparativas como `PVC vs aluminio`, `DVH`, `Probba vs Gala`
- mantener guías de medición, precios y preguntas frecuentes
- convertir contenido técnico del proveedor en guías informativas útiles
- evitar que la información repita fichas de producto o el contenido de home

Criterio de aceptación:

- cada guía responde una duda concreta
- cada guía deriva a producto o contacto
- no hay guías que expliquen el sitio en lugar del producto

### 1.4 Contacto

Objetivo:

- cerrar conversión
- simplificar el paso final
- ordenar cobertura, pagos y tiempos

Tareas:

- mantener una página de contacto clara y comercial
- incluir formulario simple, cobertura, pagos, garantía y respuesta esperada
- sostener CTA directo para presupuesto, asesoramiento o urgencia

Criterio de aceptación:

- el contacto no es institucional genérico
- la página reduce fricción y acelera consulta

## Fase 2: SEO on-page

### 2.1 Titles, descriptions y H1

Tareas:

- revisar títulos y descripciones de páginas con demanda y CTR bajo
- alinear title, H1 y primer bloque con la query principal
- evitar titles demasiado cortos o genéricos
- evitar descriptions neutras o repetitivas

Prioridad alta:

- `/productos/cortinas-de-enrollar.html`
- `/productos/cortinas-roller.html`
- `/productos/aberturas-aluminio.html`
- `/guias/cortinas-pvc-vs-aluminio`
- `/precios/cortinas-de-enrollar`
- `/servicios/reparacion-cortinas-y-persianas.html`

Criterio de aceptación:

- cada URL expresa la intención correcta
- el snippet es más persuasivo y más específico

### 2.2 Schema y señales semánticas

Tareas:

- mantener FAQ donde existan dudas reales
- sostener breadcrumb y señales de jerarquía
- usar structured data solo donde aporte valor
- no inflar el markup con secciones vacías

Criterio de aceptación:

- la semántica ayuda a SEO sin ensuciar el contenido

### 2.3 Interlinking

Tareas:

- cada producto debe enlazar a al menos una guía y una ruta de conversión
- cada guía debe enlazar a producto y contacto
- la home debe distribuir autoridad hacia familias y decisiones
- consolidar enlaces duplicados o redundantes

Criterio de aceptación:

- la navegación interna refleja intención, no solo estructura técnica

## Fase 3: Estructura

### 3.1 Home

Tareas:

- mantener home comercial de Urucortinas
- separar con claridad:
  - productos de la tienda
  - familias principales
  - soporte comercial
  - clientes
- no duplicar bloques que cumplan el mismo rol

### 3.2 Productos

Tareas:

- conservar la estructura base de detalle de producto
- aplicar el mismo estándar visual y editorial a todas las fichas
- mantener el bloque estándar de facilidades de pago
- separar series cuando una sola ficha concentra demasiadas decisiones

### 3.3 Información

Tareas:

- usar hubs por tema:
  - guías
  - comparativas
  - medición
  - precio
  - FAQ
- consolidar legacy duplicado o disperso

### 3.4 Navegación

Tareas:

- `Tienda` = shop
- `Productos` = navegación editorial de familias y variantes
- `Información` = guías y comparativas
- `Contacto` = conversión

Criterio de aceptación:

- cada menú tiene rol único
- no se repite la misma intención en varios niveles

## Fase 4: Conversión

### 4.1 CTAs

Tareas:

- definir CTA primario por intención:
  - producto: pedir asesoramiento / ver opciones
  - guía: ver producto / pedir asesoramiento
  - precio: enviar medidas / pedir cotización
  - urgencia: solicitar reparación
  - home: explorar productos / ir a tienda

### 4.2 Pruebas de confianza

Tareas:

- sostener facilidades de pago
- mostrar garantía
- mostrar instalación y mantenimiento
- mostrar cobertura real
- mantener clientes/proyectos como prueba social

### 4.3 Fricción baja

Tareas:

- simplificar formularios
- evitar CTAs ambiguos
- reducir textos que explican el contenido en lugar de empujar la decisión

Criterio de aceptación:

- cada página tiene una salida clara
- el usuario sabe qué hacer después de leer

## Backlog priorizado por impacto

### Alto impacto / bajo esfuerzo

1. Ajustar titles, descriptions y H1 en páginas con volumen y CTR bajo.
2. Consolidar guías duplicadas o dispersas.
3. Mantener la home con roles claros y sin duplicación de intención.
4. Reforzar CTAs por tipo de página.

### Alto impacto / esfuerzo medio

1. Expandir productos con contenido de legacy y documento maestro.
2. Separar nodos de series cuando una ficha concentra demasiada intención.
3. Completar hubs informacionales por tema.
4. Ordenar interlinking entre productos, guías y contacto.

### Alto impacto / esfuerzo alto

1. Alinear toda la arquitectura de navegación a roles únicos.
2. Reorganizar familias que hoy mezclan producto, serie y guía.
3. Normalizar todas las páginas de producto al mismo baseline editable.

## Primeras páginas a trabajar

### Home

- revisar hero, productos de tienda, familias, clientes y CTA final
- mantener el contenido existente útil

### Productos

- `/productos/cortinas-roller.html`
- `/productos/cortinas-de-enrollar.html`
- `/productos/cortinas-de-enrollar-pvc.html`
- `/productos/cortinas-de-enrollar-aluminio.html`
- `/productos/venecianas.html`
- `/productos/bandas-verticales.html`
- `/productos/aberturas-aluminio.html`

### Información

- `/guias/cortinas-pvc-vs-aluminio`
- `/guias/dvh`
- `/guias/probba-vs-gala`
- `/guias/aberturas-probba`
- `/guias/aberturas-gala`
- `/guias/aberturas-summa`
- `/guias/como-medir-ancho-y-alto`
- `/precios/cortinas-de-enrollar`
- `/preguntas-frecuentes`

### Contacto

- `/contacto.html`

## Resultado esperado

- mejor distribución del contenido correcto
- mejor separación por intención
- mejor jerarquía comercial
- mejor alineación entre búsqueda, página y acción
- menos repetición
- más claridad comercial
- mayor capacidad de conversión sin sacrificar SEO
