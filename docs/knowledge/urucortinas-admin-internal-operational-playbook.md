# UruCortinas · Playbook Operativo Interno para IA

Documento curado interno con formato de uso operativo, pensado para producción.

Objetivo:

- asistir a operadores internos en tareas frecuentes
- mejorar respuestas sobre clientes, productos, presupuestos, pedidos, pagos y actividades
- definir criterios de validación previos a ejecutar tools
- reducir confirmaciones prematuras o payloads incompletos

## 1. Reglas generales para operaciones

### Flujo obligatorio

Ante una solicitud operativa la IA debe:

1. identificar intención
2. identificar entidad afectada
3. determinar si debe buscar una entidad existente antes de crear o editar
4. extraer campos útiles
5. separar:
   - campos confirmados
   - campos faltantes
   - campos dudosos o inválidos
6. pedir corrección o datos faltantes si corresponde
7. pedir confirmación final solo cuando el payload esté listo
8. ejecutar la tool recién después de confirmación explícita

### Nunca confirmar prematuramente si hay

- email dudoso o mal escrito
- teléfono incompleto o ambiguo
- fecha u hora ambigua
- monto sin moneda
- producto/cliente/pedido referenciado de forma insuficiente
- dirección libre poco clara
- datos requeridos faltantes

### Formato recomendado de respuesta previa a confirmación

- Acción detectada
- Entidad objetivo
- Datos confirmados
- Datos faltantes o dudosos
- Próximo paso

## 2. Clientes

### Casos frecuentes

- alta de cliente
- edición de cliente
- búsqueda de cliente

### Campos principales

- nombre
- nombre y apellido
- email
- teléfono
- ubicación
- cargo / título
- idioma preferido

### Reglas de validación

- nombre:
  - no debe quedar vacío
- email:
  - debe tener formato válido
  - si viene con typo evidente como `coreo`, interpretar la intención pero validar el valor igual
- teléfono:
  - si parece uruguayo móvil, idealmente 9 dígitos empezando en `09` o internacional `+598`
  - si viene corto o ambiguo, no confirmar todavía
- dirección:
  - si viene libre y comprensible, puede guardarse como `location`
  - si hiciera falta dirección estructurada, pedir aclaración posterior

### Criterio operativo

- si el cliente ya puede existir, buscar primero por nombre/email/teléfono
- si el operador no confirmó todavía, mostrar resumen del alta o edición antes de ejecutar

## 3. Actividades

### Casos frecuentes

- agendar visita
- crear actividad de seguimiento
- mover actividad
- cancelar o eliminar actividad

### Campos principales

- título
- fecha y hora de inicio
- fecha y hora de fin
- ubicación
- descripción
- cliente asociado si aplica

### Reglas de validación

- no confirmar si la fecha no es inequívoca
- no confirmar si `endAt` es anterior a `startAt`
- si la actividad a editar/eliminar no está claramente identificada, buscar primero

## 4. Productos

### Casos frecuentes

- alta de producto
- edición de producto
- archivo o despublicación
- consulta de características o precio

### Campos principales

- nombre
- código
- descripción
- categoría
- tipo
- modo
- precio de venta
- precio de costo
- moneda
- unidad
- stock
- publicado

### Reglas de validación

- no confirmar precios sin moneda
- no confirmar monto negativo o claramente inconsistente
- si el producto no está identificado con claridad, buscar primero

### Respuesta a consultas

La IA puede responder sobre:

- familias de producto
- características visibles
- categorías ofrecidas
- disponibilidad conceptual de líneas como roller, toldos o aberturas

La IA no debe afirmar como hecho:

- stock real
- precio final
- plazo final

sin usar datos reales del backend o sin aclararlo explícitamente.

## 5. Presupuestos

### Casos frecuentes

- generar presupuesto
- revisar presupuesto
- pedir datos faltantes para cotizar

### Campos mínimos esperables

- cliente
- items o solución a cotizar
- moneda

### Datos útiles adicionales

- medidas
- instalación sí/no
- zona
- vigencia
- observaciones

### Reglas de validación

- no confirmar presupuesto si no existe cliente resuelto o identificable
- no confirmar si faltan items o criterio de cotización
- si el pedido del operador es muy general, primero pedir estructura del presupuesto

## 6. Pedidos

### Casos frecuentes

- crear pedido
- revisar pedido
- registrar ajustes posteriores

### Campos mínimos esperables

- cliente
- items
- moneda

### Validaciones

- si no hay cliente resuelto, buscar primero
- si no hay items claros, no pedir confirmación todavía
- si hay dirección de entrega, distinguir entre dirección libre y dirección suficiente para la operación

## 7. Pagos

### Casos frecuentes

- registrar pago
- asociar pago a pedido
- confirmar saldo o seña

### Campos mínimos esperables

- pedido
- monto
- moneda

### Validaciones

- no confirmar si no está identificado el pedido
- no confirmar si falta monto o moneda
- método, referencia y notas son recomendables cuando existan

## 8. Respuestas sobre precios y características

### Características

Para consultas de características:

- usar knowledge aprobada primero
- complementar con búsqueda de productos reales si corresponde
- si una característica depende de variante, medida o instalación, explicarlo

### Precios

Para consultas de precios:

- preferir datos reales de backend
- si no hay precio real disponible, no inventarlo
- si el precio depende de medidas o instalación, responder que requiere cotización

## 9. Reglas específicas de confirmación

### Pedir confirmación final solo si

- la intención está clara
- la entidad objetivo está clara
- los campos obligatorios están completos
- no hay campos dudosos
- el payload es ejecutable por la tool disponible

### No pedir confirmación final si

- todavía falta búsqueda previa
- hay valores inválidos o dudosos
- el usuario mezcló dos acciones
- la operación real no puede ejecutarse con las tools actuales

## 10. Ejemplo correcto

Solicitud:

`registrar el cliente Carlos Rodriguez con direccion General Fraga 2137, Montevideo, telefono 09233355 y correo carlitos1@mail.com`

Respuesta esperada correcta:

- detectar `alta de cliente`
- marcar como confirmados:
  - nombre
  - email
  - ubicación tentativa
- marcar como dudoso:
  - teléfono si no cumple formato esperado
- explicar que la dirección se puede guardar como ubicación si el operador está de acuerdo
- pedir corrección o validación del teléfono antes de pedir confirmación final

No es correcto pedir confirmación final si el teléfono todavía es dudoso.

