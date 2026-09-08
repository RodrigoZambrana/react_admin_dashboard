# Flujo de trabajo

## 1. Retomar

- Leer el checkpoint y el roadmap.
- Inspeccionar Git y separar cambios previos de los propios.
- Identificar un solo resultado verificable y su producto dueño.

## 2. Explorar

- Usar código, contratos, esquema y pruebas como evidencia primaria.
- Registrar contradicciones documentales; no corregirlas de forma masiva dentro
  de una tarea funcional.
- Definir riesgo, dependencias, datos afectados y criterio de aceptación.

## 3. Implementar

- Mantener el cambio dentro de una frontera de producto.
- Si una frontera todavía no existe, introducir primero un contrato o adapter.
- Añadir una regresión para bugs y pruebas de contrato para integraciones.
- Evitar cambios de comportamiento accidentales durante limpieza estructural.

## 4. Verificar

- Ejecutar `quick` durante el ciclo y `standard` antes de pedir revisión.
- Ejecutar `release` para publicar o declarar un hito operativo.
- Guardar evidencia de runtime/E2E cuando el resultado dependa de infraestructura
  o proveedores externos.

## 5. Cerrar

- Actualizar el documento canónico afectado y el checkpoint.
- Informar qué se verificó, qué no y los riesgos residuales.
- Una tarea queda cerrada solo cuando no deja pasos necesarios ocultos.

## Política para este brownfield

El repositorio puede contener cambios locales de otra sesión. Esto no bloquea
trabajo nuevo si los archivos no se solapan y el alcance queda explícito. Si hay
solapamiento, se detiene la edición del archivo y se pide una decisión; nunca se
usa reset, checkout destructivo o stash automático.
