# Auditoría general del proyecto

Fecha de corte: 2026-09-08

## Resumen ejecutivo

El repositorio no es un prototipo vacío: contiene una base funcional extensa,
tests relevantes y tres líneas de producto reconocibles. El problema principal
es de cierre y gobernanza: límites difusos, documentación histórica abundante,
readiness operativo no demostrado de punta a punta y deuda de dependencias que
hoy bloquea el release del backend.

La estrategia recomendada es estabilizar ecommerce primero, convertir métricas
y conversaciones en módulos con contratos propios, y solo después extraerlos a
repositorios independientes.

## Evidencia ejecutada

| Alcance | Resultado |
| --- | --- |
| Integridad monorepo | 4 pasos, todos aprobados |
| Backend smoke | 5 archivos / 49 tests aprobados |
| Frontend admin | 7 archivos / 26 tests aprobados |
| Storefront unit | 5 archivos / 11 tests aprobados |
| AI Platform | 91 suites / 454 tests aprobados |
| Channel Adapter | 36 tests aprobados |
| Build frontend | aprobado con warnings de bundle |
| Build storefront | aprobado con un warning de hook y fallbacks de configuración durante prerender |
| Build AI Platform | aprobado |
| Build backend | compila con gate omitido; release bloqueado por seguridad |

No se ejecutó el E2E conectado a proveedores reales. Por lo tanto, esta
auditoría no certifica compra, pago, email, canales ni analytics reales en un
ambiente productivo.

## Hallazgos críticos

### Seguridad de dependencias

El gate de build del backend reportó 30 vulnerabilidades: 22 altas, 7 moderadas
y 1 baja. Entre las dependencias afectadas hay componentes expuestos a HTTP,
uploads, correo, parsing, Prisma y clientes de red. El build sin gate demuestra
que TypeScript compila, pero no habilita un release.

Acción: remediación por grupos con tests de regresión, sin usar un `audit fix
--force` masivo. Criterio de salida: cero vulnerabilidades críticas/altas
aplicables al runtime o excepciones temporales documentadas con mitigación y
fecha de vencimiento.

### Fronteras y duplicación

- El backend principal concentra commerce, CRM, analytics, inbox, knowledge y
  una implementación conversacional legacy.
- `ai-platform` tiene base, API, frontend y esquema propios, pero convive con
  modelos y superficies de conversaciones del backend principal.
- `channel-adapter` ya consume AI Platform como control plane, señal correcta
  para consolidar ownership.
- Métricas cuenta con muchas tablas y endpoints dentro del esquema commerce;
  todavía no es desplegable ni migrable en forma independiente.

Acción: contratos y anti-corruption layers antes de mover código o datos.

### Readiness ecommerce

Hay evidencia fuerte de catálogo, pricing, storefront, auth y settlement de
pagos. El código actual incluye un servicio central de settlement y pruebas
específicas, por lo que algunos riesgos descritos en documentos de marzo ya han
sido trabajados. Sin embargo, faltan evidencias actuales de un recorrido release
completo con runtime real: compra, confirmación de Mercado Pago sandbox,
idempotencia de webhook, stock, notificaciones, fulfillment, backup y restore.

Acción: convertir ese recorrido en el gate de lanzamiento y cerrar primero un
tenant piloto, sin seguir ampliando funciones cosméticas.

### Métricas y operaciones

El módulo ya tiene OAuth para GA4/Ads/Search Console, normalización, reporting,
health, data quality, BullMQ/Redis, retries y lock distribuido. Esto vuelve
obsoleta parte de la auditoría del 2026-04-29 que aún enumera la cola durable
como faltante.

Los endpoints de Google Ads observados son de conexión, sincronización y
lectura; no hay evidencia de un ABM seguro de campañas. Meta mantiene una
asimetría: CAPI existe, pero no un lifecycle de Ads comparable al de Google.

Acción: cerrar confianza de datos y packaging read-only antes de habilitar
mutaciones de campañas.

### IA conversacional

AI Platform tiene una suite interna amplia, límites multi-tenant, ingestión de
documentos, políticas, tool execution, conversación asíncrona y control de
canales. Su riesgo no es falta de código sino integración/operación: coexistencia
legacy, pruebas reales de canales, evals con conversaciones representativas,
observabilidad y estrategia clara de fallback humano.

Acción: lanzar primero como inbox unificado con asistencia, no como respuesta
autónoma general.

## Deuda estructural

- Más de 6.800 archivos versionados y 91 documentos solo en la raíz de `docs/`.
- Assets vendor y source maps abundantes dentro de AI Platform.
- Backups `.bak` y `.sql.gz` versionados; deben inventariarse antes de retirar.
- El storefront conserva rutas/templates demo y legacy deliberadamente, lo que
  eleva el costo de navegación y build.
- El admin genera chunks cercanos a 1 MB y Vite advierte sobre partición.
- La compilación storefront usa fallback cuando la configuración remota no está
  disponible; el release debe distinguir fallback permitido de configuración
  obligatoria.
- Durante esta fundación se declaró explícitamente `services/shared` como ESM;
  la suite de canales volvió a pasar sin el warning de tipo de módulo.
- El branch actual está adelantado respecto a origen y el working tree contiene
  trabajo previo; cualquier iniciativa debe delimitar ownership de archivos.

## Estado por producto

| Producto | Código | Tests internos | Operación real | Decisión |
| --- | --- | --- | --- | --- |
| Commerce/CRM | alto | medio/alto | no certificada | prioridad 1 |
| Storefront | alto | medio | no certificada | cerrar con ecommerce |
| Growth Metrics | alto dentro de backend | medio/alto | parcial | modularizar y pilotear read-only |
| AI Platform | alto | alto | parcial | consolidar ownership y pilotear humano+IA |
| Channel Adapter | medio | medio | dependiente de proveedores | endurecer por canal |

## Riesgos de gestión

- Continuar por features sueltas vuelve a postergar el cierre.
- Separar repositorios antes de separar datos y contratos crea un monolito
  distribuido más difícil de operar.
- Tratar documentos históricos como estado vigente produce decisiones erróneas.
- Automatizar campañas o respuestas sin aprobación/auditoría expone dinero,
  reputación y datos de clientes.

## Recomendación inmediata

Abrir una Fase 1 única: seguridad de runtime y cierre operativo ecommerce. Todo
trabajo nuevo debe demostrar que contribuye a ese gate o quedar en backlog.
