# SEO Data-Driven Report

Este informe se genera desde datos reales de:

- Google Search Console
- Google Ads
- GA4 normalizado
- snapshot local de Semrush

## Salidas

- JSON consumible por agentes: [`outputs/seo-data-driven-report/seo-data-driven-report.json`](/Users/rodrigo/Git/personal/react_admin_dashboard/outputs/seo-data-driven-report/seo-data-driven-report.json)
- Markdown legible por negocio: [`outputs/seo-data-driven-report/seo-data-driven-report.md`](/Users/rodrigo/Git/personal/react_admin_dashboard/outputs/seo-data-driven-report/seo-data-driven-report.md)

## Regeneración

```bash
node backend/tools/seo/build-data-driven-seo-report.mjs
```

## Criterios

- No usa raw events ni CSV manual como verdad operativa.
- Clasifica oportunidades por señal real, quick wins, contenido nuevo, estructura y sinergia SEO + Ads.
- Mantiene explícito cuando Ads no tiene conversión validada.
