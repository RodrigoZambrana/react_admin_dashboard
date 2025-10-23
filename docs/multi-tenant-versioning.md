# Estrategia de versionado multi-cliente

Esta guía describe la estructura y el flujo de trabajo para mantener múltiples variantes del producto a partir de una base compartida, garantizando que las actualizaciones globales (por ejemplo, versiones de librerías o mejoras genéricas) se apliquen una sola vez y se propaguen de forma controlada a cada cliente.

## Componentes principales

- **Núcleo compartido (`core`)**  
  - Define la funcionalidad estándar y los valores por defecto.  
  - Vive en los directorios `backend/src/clients/core` y `frontend/src/clients/core`.  
  - Toda nueva funcionalidad genérica debe agregarse aquí.

- **Variantes de cliente (`clients/<slug>`)**  
  - Contienen únicamente overrides o extensiones necesarias para cada cliente.  
  - Pueden habilitar/deshabilitar módulos, ajustar rutas, branding, límites, etc.  
  - Ejemplos incluidos: `retail`, `urucortinas`.

### Clientes configurados actualmente

| Slug          | Descripción breve                              | Back/Front overrides clave |
| ------------- | ------------------------------------------------ | --------------------------- |
| `core`        | Base compartida para todos los despliegues       | Valores por defecto         |
| `retail`      | Demo retail con módulo de fidelización extra     | Ruta de lealtad, flags contables apagados |
| `urucortinas` | Variante inicial para el cliente UruCortinas     | Idioma `es`, tema teal      |

- **Inyección en tiempo de ejecución**  
  - Backend: `ClientConfigModule` expone un provider global (`CLIENT_CONFIG`) para consultar la configuración activa.  
  - Frontend: `clientConfig` y utilidades asociadas resuelven overrides y exponen helpers (feature flags, rutas, etc.).  
  - La variante activa se selecciona con las variables de entorno `CLIENT_SLUG` (backend) y `VITE_CLIENT_SLUG` (frontend).

## Flujo de ramas recomendado

1. `main`: Base estable que agrupa las mejoras genéricas y se mantiene desplegable.  
2. `client/<slug>`: Rama por cliente que consume `main` periódicamente y contiene ajustes específicos (copy, branding, integraciones).  
3. `release/<slug>/<version>`: Opcional para preparar publicaciones etiquetadas del cliente.

**Proceso sugerido para cambios globales**
1. Crear feature branch desde `main`.  
2. Implementar y validar (incluye tests unitarios y verificación de lint).  
3. Merge a `main`.  
4. Hacer rebase/merge de cada `client/<slug>` con `main` y resolver conflictos puntuales (idealmente en los archivos de `clients/<slug>`).  
5. Ejecutar smoke/regression tests por cliente antes de desplegar.

## Pasos para agregar un nuevo cliente

1. Crear carpeta `backend/src/clients/<slug>` con un archivo `config.ts` que exporte `ClientVariantConfig`.  
   - Puede sobrescribir flags de módulos, rate limits, metadatos, etc.  
2. Crear carpeta `frontend/src/clients/<slug>` con `config.ts`.  
   - Permite ajustar rutas, tema, textos y feature flags de UI.  
3. Ajustar pipelines de CI/CD para construir desplegables separados con las variables de entorno adecuadas.  
4. Documentar en el tablero interno qué ajustes diferenciados se aplicaron.

## Despliegue y automatización

- **Build por cliente**: generar artefactos independientes por slug (e.g. `CLIENT_SLUG=core npm run build`).
  - En Docker Compose exporta `CLIENT_SLUG` y `VITE_CLIENT_SLUG` antes de ejecutar `docker compose build`
    para hornear los assets correctos (`CLIENT_SLUG=urucortinas VITE_CLIENT_SLUG=urucortinas docker compose -f deploy/docker-compose.prod.yml build`).
- **Pruebas por variante**: ejecutar suites relevantes (unitarias + e2e) con la configuración del cliente antes de promover a producción.
- **Monitorización**: etiquetar métricas/logs con el slug del cliente para correlacionar incidencias rápidamente.

## Estrategia de upgrades

1. Actualizar librerías en `main` y validar.  
2. Propagar a cada rama `client/<slug>` y resolver diferencias necesarias exclusivamente en las carpetas `clients/<slug>`.  
3. Usar feature flags y overrides de rutas para desactivar temporalmente módulos que requieran trabajo extra para un cliente concreto.  
4. Comunicar a los equipos de soporte la ventana de mantenimiento y los cambios visibles para cada cliente.

## Buenas prácticas adicionales

- Mantener los overrides acotados: si una personalización aplica a más de un cliente, promuévela al `core`.  
- Registrar en issues/tickets los motivos de cada override para facilitar refactors futuros.  
- Incluir pruebas específicas cuando un override modifique comportamiento crítico.  
- Revisar periódicamente los feature flags para evitar deuda técnica.
