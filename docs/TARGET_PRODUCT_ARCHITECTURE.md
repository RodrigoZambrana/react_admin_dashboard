# Arquitectura objetivo de productos

Fecha: 2026-09-08

## Principio rector

La plataforma será un conjunto de soluciones independientes, reutilizables y
multi-tenant, unificadas por identidad, navegación y contratos. Independencia
significa poder versionar, probar, desplegar y operar un producto sin modificar
los internos de otro; no exige repositorios separados desde el primer día.

```mermaid
flowchart LR
  CP[Control Plane\nidentidad, tenants, permisos] --> ADM[Admin Web]
  ADM --> COM[Commerce Core + CRM]
  ADM --> MET[Growth Metrics]
  ADM --> CONV[Conversation Platform]
  SF[Storefront] --> COM
  SF --> CONV
  SF --> MET
  CH[Channel Adapters\nWhatsApp, Meta, email, webchat] --> CONV
  COM -->|eventos de negocio| MET
  CONV -->|leads y actividad| COM
  CONV -->|eventos de canal| MET
```

## Productos objetivo

### 1. Commerce Suite — prioridad inmediata

Incluye:

- `commerce-core`: catálogo, precios, stock, checkout, órdenes, pagos,
  fulfillment y CRM;
- `admin-web`: operación interna, inicialmente shell compartido;
- `storefront-web`: experiencia pública reutilizable por tenant.

El backend y CRM permanecen juntos durante el cierre ecommerce porque hoy
comparten esquema, transacciones y flujo pedido-pago-cliente. Se evaluará
separar CRM después de estabilizar eventos y ownership.

### 2. Growth Metrics

Producto de conexión, ingestión, normalización y decisión para:

- GA4;
- Google Ads;
- Search Console;
- Meta Ads/Pixel/CAPI;
- conversiones propias de storefront, CRM y canales.

Primero será read-only y de recomendaciones. Las operaciones de campañas se
incorporarán después con permisos granulares, aprobación humana, dry-run,
idempotencia, auditoría y rollback. No se expondrán mutaciones de Ads como una
extensión incidental del conector de lectura.

### 3. Conversation Platform

`ai-platform` será el sistema de registro de conversaciones, estado, políticas
y ejecución IA. `channel-adapter` conservará la mecánica específica de cada
proveedor y traducirá a un mensaje canónico.

La evolución funcional será:

1. centralización y respuesta humana;
2. sugerencias IA visibles y aprobables;
3. automatización de casos acotados;
4. autonomía gradual medida por calidad, riesgo y canal.

El modelo conversacional duplicado en el backend principal se tratará como
legacy/puente. No se desarrollarán dos runtimes equivalentes.

### 4. Control Plane

Capacidad transversal futura para tenants, usuarios, permisos, suscripciones,
feature flags e inventario de integraciones. No debe convertirse ahora en un
proyecto grande: se extraerá desde contratos que ya necesitan los tres productos.

## Contratos compartidos

- `tenantId`, identidad y capacidades;
- eventos versionados (`order.created`, `payment.confirmed`, `lead.created`,
  `conversation.updated`, `conversion.recorded`);
- mensajes canónicos de canal;
- IDs externos e idempotency keys;
- errores y correlation/trace IDs;
- API pública con compatibilidad hacia atrás.

Los contratos pueden comenzar como schemas versionados en el monorepo. No se
creará un paquete `shared` generalista: cada elemento compartido necesita owner,
consumidores y política de versionado.

## Ownership de datos

| Dominio | Owner objetivo |
| --- | --- |
| catálogo, cliente, orden, pago, fulfillment | Commerce Core |
| conversación, mensaje, estado IA, channel binding | Conversation Platform |
| credenciales y métricas de fuentes, atribución, insights | Growth Metrics |
| credenciales del canal y transporte proveedor | Channel Adapters |
| tenant, usuario y capability global | Control Plane (gradual) |

## Decisión de migración

Se adopta un monolito modular con runtimes separables antes de crear nuevos
repositorios. Esta decisión reduce el riesgo de romper transacciones comerciales
y permite que las pruebas de contrato precedan a cada extracción física.
