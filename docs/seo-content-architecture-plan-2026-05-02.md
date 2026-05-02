# SEO + Content Architecture Plan

Fecha: 2026-05-02

## Objetivo

Definir una arquitectura comercial y SEO para el sitio que distribuya mejor el contenido, separe la intención de búsqueda por tipo de página, ordene la jerarquía comercial y alinee búsqueda, página y acción.

La base de esta propuesta es:

- contenido legacy comercial validado
- documento maestro operativo y comercial
- señales de Search Console, GA4 y Ads
- estado actual del CMS y del storefront

## Principios de diseño

- Cada página debe tener una intención principal.
- Cada página debe tener un CTA principal.
- Home orienta, productos convierten, información educa, contacto cierra.
- `Tienda` apunta a compra o catálogo.
- `Productos` apunta a navegación editorial de producto.
- `Información` apunta a comparación, decisión y confianza.
- No repetir la misma intención en varios menús.
- No exponer lenguaje analítico o interno al usuario.

## Roles de navegación

| Menú | Rol | Qué contiene | Qué no debe hacer |
| --- | --- | --- | --- |
| Home | Gateway comercial | Entrada visual, productos destacados, confianza, acceso a categorías | No debe reemplazar la navegación de producto |
| Tienda | Catálogo / shop | Cards de producto reales, precio, compra o exploración de catálogo | No debe duplicar la navegación editorial de productos |
| Productos | Navegación de producto | Familias, variantes, hubs, fichas, comparativas de decisión | No debe repetir lo que ya vive en Información |
| Información | Hub de decisión | Guías, comparativas, medición, materiales, series, DVH, FAQ | No debe convertirse en un listado automático de producto |
| Contacto | Conversión | Formulario, cobertura, tiempos, medios de pago, urgencia | No debe ser una página institucional genérica |

## Arquitectura propuesta por tipo de página

### 1. Home

Rol:

- mostrar oferta real
- ordenar por familia
- dar confianza
- derivar a producto, tienda, información o contacto

Estructura esperada:

1. Hero superior
2. Productos de la tienda
3. Familias o líneas principales
4. Soporte comercial y confianza
5. Clientes / proyectos
6. CTA final

Hero superior recomendado:

- Un carrusel de 4 productos reales de la tienda.
- Cada slide debe decir qué resuelve y a quién le conviene.

Propuesta de cards del hero:

| Producto | Qué debe decir | CTA |
| --- | --- | --- |
| Cortinas Roller | Blackout, screen y roller doble para controlar luz y privacidad en interiores modernos. | Ver producto |
| Cortina de Enrollar en PVC | Solución práctica y accesible para recambio, mantenimiento simple y uso diario. | Ver producto |
| Cortina de Enrollar en Aluminio | Más resistencia y mejor respuesta para frentes expuestos o uso más intensivo. | Ver producto |
| Cortina Tradicional con riel | Opción clásica para ambientes que buscan caída suave y una solución atemporal. | Ver producto |

Grilla de familias recomendada debajo del hero:

| Familia | Qué debe decir | CTA |
| --- | --- | --- |
| Cortinas de enrollar | PVC o aluminio según uso, exposición y mantenimiento. | Ver opciones |
| Aberturas en aluminio | Serie 20 y 25, Probba, Gala y Summa con o sin DVH. | Ver aberturas |
| Toldos y cerramientos | Sombra, exterior y cierre a medida. | Ver toldos |
| Motores y automatismos | Más confort y automatización en el uso diario. | Ver motores |
| Cortinas Roller | Interior moderno para luz y privacidad. | Ver roller |
| Bandas verticales | Ventanales amplios y oficinas. | Ver bandas verticales |
| Cortinas venecianas | Control fino de luz y privacidad. | Ver venecianas |
| Cortinas metálicas | Seguridad para accesos y comercios. | Ver cortinas metálicas |

Soporte comercial que sí debe estar en Home:

- visita y toma de medidas
- medios de pago y financiación
- garantía
- instalación y mantenimiento
- clientes reales

Lo que debe evitar Home:

- slogans vacíos
- duplicar el menú de productos
- cargar explicaciones largas dentro del hero
- mezclar producto, información y contacto sin jerarquía

## 2. Productos

Rol:

- resolver la decisión sobre qué producto o serie conviene
- mostrar variantes y rutas a información o contacto
- capturar la demanda transaccional de cada familia

Estructura base recomendada para cada producto:

1. Hero claro del producto
2. Qué es y para quién sirve
3. Variantes o materiales
4. Galería o fotos reales
5. Preguntas frecuentes
6. CTA comercial

Reglas de contenido para productos:

- hablar de uso real
- hablar de material, exposición, medidas, instalación y mantenimiento
- mostrar la diferencia entre variantes sin ruido técnico
- cerrar con un siguiente paso claro

### 2.1 Mapa de páginas de producto actual

| URL | Rol SEO/CRO | Qué debe decir | CTA principal | Links de apoyo |
| --- | --- | --- | --- | --- |
| `/productos/cortinas-roller.html` | Producto editorial principal | Screen, blackout y roller doble según luz, privacidad y uso diario | Pedir asesoramiento o ir a la tienda | `/guias/cortinas-pvc-vs-aluminio`, `/contacto.html` |
| `/productos/cortinas-de-enrollar.html` | Hub de decisión | PVC vs aluminio, manual o motorizada, obra nueva o recambio | Ver PVC / Ver aluminio | `/productos/cortinas-de-enrollar-pvc.html`, `/productos/cortinas-de-enrollar-aluminio.html`, `/guias/cortinas-pvc-vs-aluminio` |
| `/productos/cortinas-de-enrollar-pvc.html` | Variante material | Practicidad, costo accesible, bajo mantenimiento | Pedir presupuesto en PVC | `/productos/cortinas-de-enrollar.html`, `/guias/cortinas-pvc-vs-aluminio` |
| `/productos/cortinas-de-enrollar-aluminio.html` | Variante material | Resistencia, uso intensivo y frentes expuestos | Pedir presupuesto en aluminio | `/productos/cortinas-de-enrollar.html`, `/guias/cortinas-pvc-vs-aluminio` |
| `/productos/venecianas.html` | Producto de control de luz | Lamas 16 mm y 25 mm, luz y privacidad con terminación limpia | Ver opciones | `/guias/como-medir-ancho-y-alto`, `/contacto.html` |
| `/productos/bandas-verticales.html` | Producto para grandes paños | Ventalanes amplios, oficinas y uso cotidiano | Pedir asesoramiento | `/guias/como-medir-ancho-y-alto`, `/contacto.html` |
| `/productos/cortinas-tradicionales.html` | Producto clásico | Opción tradicional con riel para ambientes cotidianos | Ver opciones | `/contacto.html`, `/guias/como-medir-ancho-y-alto` |
| `/productos/cortinas-metalicas.html` | Producto de seguridad | Seguridad para comercios y accesos | Consultar seguridad | `/contacto.html`, `/servicios/reparacion-cortinas-y-persianas.html` |
| `/productos/toldos-y-cerramientos.html` | Producto exterior | Sombra, protección solar y cerramiento a medida | Ver opciones exteriores | `/guias/como-medir-ancho-y-alto`, `/contacto.html` |
| `/productos/motores-cortinas-y-persianas.html` | Automatización | Confort, control remoto y uso diario más simple | Consultar automatización | `/contacto.html`, `/productos/cortinas-roller.html` |
| `/productos/aberturas-aluminio.html` | Hub de serie | Serie 20 y 25, Probba, Gala y Summa como rutas separadas | Ver series | `/productos/aberturas-serie-20-y-25.html`, `/productos/aberturas-probba.html`, `/productos/aberturas-gala.html`, `/productos/aberturas-summa.html`, `/guias/dvh` |
| `/productos/aberturas-serie-20-y-25.html` | Serie estándar | Resolución funcional y accesible para obra o recambio | Consultar serie | `/productos/aberturas-aluminio.html`, `/guias/dvh` |
| `/productos/aberturas-probba.html` | Serie de entrada alta prestación | Mejor cierre, tipologías y posibilidad de DVH | Ver guía de Probba | `/guias/aberturas-probba`, `/guias/dvh`, `/contacto.html` |
| `/productos/aberturas-gala.html` | Serie de confort | Mejor terminación, confort y variante Gala CR | Ver guía de Gala | `/guias/aberturas-gala`, `/guias/dvh`, `/contacto.html` |
| `/productos/aberturas-summa.html` | Serie premium | Grandes dimensiones, hermeticidad y mayor prestación | Ver guía de Summa | `/guias/aberturas-summa`, `/guias/dvh`, `/contacto.html` |
| `/productos/dvh.html` | Complemento técnico | El DVH no reemplaza la serie, la complementa | Ver aberturas | `/productos/aberturas-aluminio.html`, `/guias/dvh` |

### 2.2 Cómo debe hablar cada producto en la home o en una tarjeta destacada

| Producto | Mensaje comercial corto |
| --- | --- |
| Cortinas Roller | Interior moderno para controlar luz y privacidad sin recargar el espacio. |
| Cortina de Enrollar en PVC | Práctica, liviana y con bajo mantenimiento. |
| Cortina de Enrollar en Aluminio | Más resistente para frentes expuestos y uso más intensivo. |
| Cortina Tradicional con riel | Clásica, suave y útil para ambientaciones atemporales. |
| Bandas verticales | Buena respuesta para ventanales amplios y oficinas. |
| Venecianas | Regulación precisa de luz y privacidad con terminación limpia. |
| Cortinas metálicas | Seguridad real para accesos y locales. |
| Motores y automatismos | Más confort y menos esfuerzo en el uso diario. |

## 3. Información

Rol:

- educar
- comparar
- reducir incertidumbre
- sostener el SEO informacional

Estructura esperada:

1. Hero de decisión
2. Guía o comparativa principal
3. Bloque de criterios de elección
4. Links a producto
5. FAQ o cierre de confianza

### 3.1 Mapa de páginas informativas actuales

| URL | Rol | Qué debe decir | CTA principal | Links de apoyo |
| --- | --- | --- | --- | --- |
| `/guias/cortinas-pvc-vs-aluminio` | Comparativa central | Elegir según uso, exposición, mantenimiento y presupuesto | Ver PVC / Ver aluminio | `/productos/cortinas-de-enrollar-pvc.html`, `/productos/cortinas-de-enrollar-aluminio.html` |
| `/guias/dvh` | Guía técnica útil | Cuándo conviene el DVH y qué aporta al confort | Ver aberturas | `/productos/aberturas-aluminio.html` |
| `/guias/probba-vs-gala` | Comparativa de serie | Diferencia de prestación y uso entre líneas | Ver series | `/productos/aberturas-probba.html`, `/productos/aberturas-gala.html` |
| `/guias/aberturas-probba` | Guía de serie | Tipologías, colores, terminaciones y usos | Ver serie Probba | `/productos/aberturas-probba.html` |
| `/guias/aberturas-gala` | Guía de serie | Confort, terminación y variante Gala CR | Ver serie Gala | `/productos/aberturas-gala.html` |
| `/guias/aberturas-summa` | Guía premium | Tipologías, terminaciones y grandes dimensiones | Ver serie Summa | `/productos/aberturas-summa.html` |
| `/guias/como-medir-ancho-y-alto` | Guía práctica | Tomar medidas sin errores antes de pedir presupuesto | Pedir presupuesto | `/contacto.html`, `/precios/cortinas-de-enrollar` |
| `/precios/cortinas-de-enrollar` | Guía de precio | Qué cambia el precio y cómo cotizar mejor | Enviar medidas | `/contacto.html`, `/guias/como-medir-ancho-y-alto` |
| `/preguntas-frecuentes` | Confianza y fricción | Cobertura, garantía, instalación, financiación y pagos | Ir a contacto | `/contacto.html`, `/quienes-somos` |
| `/quienes-somos` | Credibilidad | Quiénes somos, cómo trabajamos y qué cubrimos | Consultar | `/contacto.html`, `/preguntas-frecuentes` |

### 3.2 Reglas para información

- una guía no debe parecer una ficha de producto ni un informe interno
- cada guía debe terminar en una recomendación concreta
- cada guía debe vincular al menos una página de producto y una de conversión
- cada comparativa debe dejar claro cuándo conviene una opción y cuándo la otra

### 3.3 Páginas legacy que conviene consolidar

| URL legacy / duplicada | Recomendación |
| --- | --- |
| `/articulos/dvh.html` | Consolidar con `/guias/dvh` como canonical o redirección controlada |
| Páginas que repiten la misma comparación o el mismo material | Unificarlas en una sola guía fuerte, no distribuir la misma idea en varias URLs |

## 4. Contacto

Rol:

- convertir
- bajar la fricción
- ordenar el paso final

Estructura esperada:

1. Hero directo
2. Formulario simple
3. Medios de contacto
4. Cobertura, pagos y garantías
5. CTA final

Qué debe decir:

- qué tipo de consulta puede entrar
- qué datos conviene enviar
- cuánto tarda la respuesta
- cómo se coordina visita o presupuesto
- cómo se resuelve urgencia o reparación

Formulario recomendado:

- nombre
- teléfono o WhatsApp
- email
- ubicación
- producto de interés
- medidas aproximadas
- urgencia
- foto opcional

Bloques que sí deben estar:

- visita y toma de medidas
- cobertura geográfica
- medios de pago
- garantía
- servicios de instalación y reparación

Lo que debe evitar:

- texto institucional largo
- formularios con campos innecesarios
- CTA genéricos sin promesa de respuesta

## 5. Jerarquía comercial recomendada

1. Home: descubrir qué solución necesito.
2. Productos: decidir qué producto o variante conviene.
3. Información: comparar y despejar dudas.
4. Contacto: pedir presupuesto o coordinar.
5. Tienda: cerrar compra o ver el catálogo real.

## 6. Reglas de interlinking

- Home debe enlazar a tienda, productos, información y contacto.
- Cada producto debe enlazar a una guía y a contacto.
- Cada guía debe enlazar a al menos una ficha de producto y a contacto.
- `Aberturas de aluminio` debe enlazar a sus series.
- `Cortinas de enrollar` debe enlazar a PVC, aluminio y comparativa.
- `DVH` debe vivir como guía complementaria, no como destino único de todas las series.

## 7. Prioridades de mejora

### Alto impacto, bajo esfuerzo

- ajustar titles y descriptions donde la intención es clara
- reforzar el primer bloque de cada página
- ordenar el CTA principal por intención
- separar mejor `Tienda` de `Productos`

### Alto impacto, esfuerzo medio

- profundizar contenido de producto con legacy y documento maestro
- consolidar guías comparativas
- afinar la home para que los productos visibles sean realmente los que más venden
- mejorar `Contacto` para que capture mejor las consultas

### Alto impacto, esfuerzo alto

- consolidar duplicados o solapamientos de información
- mantener una arquitectura editorial consistente en todo el catálogo
- seguir separando por serie o por material cuando la demanda lo justifique

## 8. Resultado esperado

La arquitectura final debería lograr que:

- cada query tenga una página claramente asociada
- cada página tenga una sola intención principal
- cada bloque tenga una función distinta
- el usuario entienda rápido qué conviene, por qué y qué hacer después
- Google entienda mejor la relación entre productos, guías y contacto

