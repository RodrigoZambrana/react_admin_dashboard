# Descubrimiento de necesidades del producto

Fecha: 2026-09-08

## Necesidades confirmadas

Estas necesidades provienen de la dirección expresada para el proyecto y se
consideran restricciones del backlog:

1. La solución final debe estar formada por productos independientes pero
   accesibles de manera unificada.
2. Los productos deben poder reutilizarse en empresas distintas, no quedar
   codificados para un único cliente.
3. La prioridad de negocio es cerrar el paquete ecommerce: CRM, backend
   comercial y storefront.
4. El producto de métricas debe integrar Google Analytics, Google Ads, Search
   Console, Meta y señales de WhatsApp para medir, explicar y apoyar decisiones.
5. Las operaciones sobre campañas son deseables, pero deben separarse de la
   medición y diseñarse con control humano y trazabilidad.
6. AI Platform debe centralizar canales primero y automatizar respuestas en una
   etapa posterior y controlada.
7. Seguridad, buenas prácticas, modularización, limpieza y separación de
   responsabilidades son trabajo explícito, no actividades opcionales.
8. Antes de implementar se requiere conocer el estado de todos los productos y
   disponer de tareas independientes, auditadas y verificables por el harness.
9. El proceso debe aprovechar agentes especializados en paralelo sin perder un
   owner final, coherencia arquitectónica ni calidad funcional.

## Restricciones de ejecución

- Discovery, decisiones, arquitectura e implementación son tareas distintas.
- Una tarea funcional no comienza si su necesidad, alcance, dependencias,
  aceptación o verificación están incompletos.
- La separación física no precede al ownership de datos y contratos.
- Los agentes pueden producir evidencia en paralelo, pero no modificar la misma
  frontera sin coordinación.
- El producto integrado debe mantenerse ejecutable durante la transición.

## Decisiones de producto todavía necesarias

Estas preguntas no se resolverán por inferencia técnica. Se convertirán en
tareas de discovery/decisión y bloquearán las implementaciones dependientes.

### Modelo comercial y multi-tenant

- Resuelto por `DEC-009` / ADR-009: modelo híbrido, con data plane dedicado para
  el piloto y ejecución compartida solo por producto después de certificar su
  aislamiento.
- Primer tenant: UruCortinas, segmento uruguayo de cortinas y aberturas a
  medida. Rodrigo es responsable de aceptación.
- El tenant decide valores de negocio; la plataforma posee schema, defaults,
  guardrails, custodia y enforcement. La matriz detallada está en
  `adr/ADR-009-HYBRID-TENANCY-AND-URUCORTINAS-PILOT.md`.

### Ecommerce

- ¿La operación primaria es venta online, solicitud de presupuesto o ambas?
- ¿Cuál es la política real de stock, reserva, sobreventa y productos a medida?
- ¿Qué modalidades de entrega/retiro, zonas, costos y promesas se soportan?
- ¿Qué estados de pago/orden habilitan producción, entrega, cancelación y
  devolución?
- ¿Qué impuestos, monedas, comprobantes y requisitos de Uruguay son obligatorios?

### Métricas y campañas

- ¿Qué cuentas/fuentes son obligatorias para el MVP y con qué frecuencia/SLA?
- ¿Cuál es la fuente de verdad de cada conversión e ingreso?
- ¿Qué acciones de campaña se permitirán, a qué roles y con qué límites de
  presupuesto/aprobación/rollback?
- ¿WhatsApp aporta solo conversiones/eventos o también métricas operativas de
  conversaciones y atención?

### Conversaciones e IA

- ¿Cuál es el orden de canales: webchat, WhatsApp QR, WhatsApp Cloud API, email,
  Instagram o Messenger?
- ¿WhatsApp QR es una opción de piloto o un canal soportado en producción?
- ¿Qué casos pueden responderse automáticamente y cuáles exigen aprobación?
- ¿Qué umbrales de calidad, costo y latencia habilitan mayor autonomía?
- ¿Qué política de privacidad, retención, anonimización y uso para aprendizaje
  aplica a conversaciones y documentos?

### Plataforma y operación

- ¿Qué proveedor/arquitectura de hosting será canónico?
- ¿Cuáles son los SLOs, RPO/RTO, ambientes y responsables operativos?
- ¿Cuándo se justifica un control plane común para identidad, tenants, permisos,
  integraciones y billing?
- ¿Qué productos requieren repositorio propio y cuáles solo despliegue propio?

## Resultado del discovery técnico

Las auditorías por producto documentan qué existe técnicamente y el backlog
consolidado separa:

- tareas `ready` de investigación o mejora sin decisión pendiente;
- tareas `blocked` por las decisiones anteriores;
- tareas `proposed` que aún necesitan especificación adicional;
- dependencias que establecen el orden real de ejecución.

Las respuestas de negocio de las secciones anteriores no se infirieron. Cada
una quedó asociada a una tarea de decisión o como bloqueo de la implementación
que la necesita en `planning/backlog.json`.
