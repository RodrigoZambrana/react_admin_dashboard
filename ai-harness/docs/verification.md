# Verificación por riesgo

El mapa de comandos vive en `ai-harness/config/project.json` y se ejecuta con:

```bash
npm run harness:verify -- --scope storefront --level quick
npm run harness:verify -- --scope commerce-backend --level standard
npm run harness:verify -- --scope changed --level quick
```

## Quick

Pruebas focalizadas, deterministas y sin proveedores externos. Deben durar poco
y dar feedback durante la implementación.

## Standard

Tipos, compilación y suites del producto. Es el mínimo para integrar código,
pero no certifica operación real.

## Release

Incluye los gates que pueden depender de seguridad, Docker, base sembrada,
Playwright, credenciales sandbox o servicios externos. Un fallo de seguridad no
se salta para publicar, aunque la compilación con gate omitido sirva para
diagnosticar el código.

## Evidencia mínima por tipo de cambio

| Cambio | Evidencia |
| --- | --- |
| Lógica pura | test unitario/regresión y tipos |
| API o esquema | test de contrato, migración y compatibilidad |
| UI | test de componente y recorrido crítico |
| Pago/stock/auth | integración, E2E y prueba negativa |
| Canal externo | fixture de webhook, idempotencia, retry y sandbox |
| IA | corpus/eval versionado, guardrails y fallback humano |
| Infraestructura | config renderizada, healthcheck y rollback |
