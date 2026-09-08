# Política de seguridad local

- El security gate debe cubrir backend, admin, storefront, AI Platform y Channel
  Adapter.
- Critical/high no se corrigen con `npm audit fix --force` masivo: cada grupo
  requiere análisis de exposición, upgrade acotado y regresión.
- Auth, pagos, uploads, webhooks, canales, IA y campañas requieren threat model.
- Secretos nunca se versionan; los repositorios públicos requieren especial
  cuidado con documentos personales y dumps.
- Un build con el gate omitido sirve para diagnóstico, no para release.
- Toda excepción tiene owner, mitigación, evidencia y fecha de vencimiento.
