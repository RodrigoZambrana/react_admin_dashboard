import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import JSZip from 'jszip'
import { parse } from 'csv-parse/sync'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..', '..', '..')
const dataRoot = '/Users/rodrigo/Personal/Proyectos/urucortinas/analitycs'
const outputDir = path.join(repoRoot, 'outputs', 'seo-data-driven-report')
const outputJson = path.join(outputDir, 'seo-data-driven-report.json')
const outputMd = path.join(outputDir, 'seo-data-driven-report.md')

const SOURCES = {
  ga4Panoramic: path.join(dataRoot, 'Informe_panorámico.csv'),
  gscZip: path.join(dataRoot, 'https___urucortinas.com.uy_-Performance-on-Search-2026-04-28.zip'),
  adsKeywords: path.join(dataRoot, 'google ads', 'Palabras_clave_de_búsqueda(2020.07.14-2026.04.28).csv'),
  adsSearchTerms: path.join(dataRoot, 'google ads', 'Búsquedas(Buscar_2020.07.14-2026.04.28).csv'),
  adsCampaigns: path.join(dataRoot, 'google ads', 'Campañas(2020.07.14-2026.04.28).csv'),
  semrushRankings: path.join(
    dataRoot,
    'semrush',
    'urucortinas.com.uy_ Rankings Distribution, Position Tracking.mhtml',
  ),
  semrushCompetitors: path.join(
    dataRoot,
    'semrush',
    'urucortinas.com.uy_ Competitors Discovery, Position Tracking.mhtml',
  ),
}

const BRAND_TERMS = [
  'urucortinas',
  'uru cortinas',
  'uru-cortinas',
  'bork',
  'cortifast',
  'gala',
]

const PRODUCT_FAMILIES = [
  {
    family: 'cortinas de enrollar',
    slug: '/productos/cortinas-de-enrollar.html',
    content: 'materiales, tipos, medidas, instalación, precios orientativos, diferencias pvc/aluminio y FAQ',
    result: 'capturar la demanda principal y bajar dependencia de Ads',
  },
  {
    family: 'persianas',
    slug: '/productos/persianas-de-enrollar.html',
    content: 'tipos de persianas, uso exterior/interior, pvc/aluminio, automatización y mantenimiento',
    result: 'cubrir el gap de intención genérica con una landing propia',
  },
  {
    family: 'aberturas de aluminio',
    slug: '/productos/aberturas-aluminio.html',
    content: 'ventanas, puertas, medidas, precios, terminaciones y ventajas por tipo de abertura',
    result: 'apropiar la intención de compra transaccional',
  },
  {
    family: 'cerramientos',
    slug: '/productos/cerramientos-y-toldos.html',
    content: 'cerramientos de aluminio, toldos exteriores, usos, materiales, instalación y casos',
    result: 'ampliar cobertura de una familia de alto valor comercial',
  },
  {
    family: 'reparación',
    slug: '/servicios/reparacion-cortinas-y-persianas.html',
    content: 'servicios, tiempos de respuesta, tipos de falla, cobertura geográfica y urgencia',
    result: 'capturar búsquedas de servicio con intención inmediata',
  },
]

const parseNumber = (value) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value !== 'string') return null
  const normalized = value
    .replace(/\u00a0/g, '')
    .replace(/\s/gu, '')
    .replace(/[A-Z$]/gu, '')
    .replace(/\./gu, '')
    .replace(',', '.')
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

const parsePosition = (value) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value !== 'string') return 0
  const normalized = value.replace(/\u00a0/g, '').replace(/\s/gu, '').replace(',', '.')
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : 0
}

const parseInteger = (value) => {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.trunc(value)
  if (typeof value !== 'string') return 0
  const normalized = value.replace(/\./gu, '').replace(/\u00a0/g, '').replace(/\s/gu, '')
  const parsed = Number(normalized.replace(',', '.'))
  return Number.isFinite(parsed) ? Math.trunc(parsed) : 0
}

const parsePercent = (value) => {
  if (typeof value !== 'string') return 0
  const normalized = value.replace('%', '').replace(',', '.').trim()
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : 0
}

const normalizeText = (value) =>
  String(value ?? '')
    .normalize('NFKD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim()

const readCsv = async (filePath) => {
  const content = await fs.readFile(filePath, 'utf8')
  return parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  })
}

const readZipCsv = async (zipPath, matcher) => {
  const zip = await JSZip.loadAsync(await fs.readFile(zipPath))
  const fileName = Object.keys(zip.files).find((name) => matcher(name))
  if (!fileName) {
    throw new Error(`No se encontró un CSV esperado dentro de ${zipPath}`)
  }
  const content = await zip.files[fileName].async('string')
  return parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  })
}

const extractGa4ChannelMix = async () => {
  const content = await fs.readFile(SOURCES.ga4Panoramic, 'utf8')
  const lines = content.split(/\r?\n/)
  const headerIndex = lines.findIndex((line) =>
    line.startsWith('Grupo de canales principal de la sesión (Grupo de canales predeterminado),Sesiones'),
  )
  if (headerIndex < 0) {
    return []
  }
  const csvLines = [lines[headerIndex]]
  for (let index = headerIndex + 1; index < lines.length; index += 1) {
    const line = lines[index]
    if (!line.trim()) break
    if (line.startsWith('# ')) break
    csvLines.push(line)
  }
  return parse(csvLines.join('\n'), {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }).map((row) => ({
    channel: row['Grupo de canales principal de la sesión (Grupo de canales predeterminado)'],
    sessions: parseInteger(row.Sesiones),
  }))
}

const extractCompetitorDomains = async (filePath) => {
  const content = await fs.readFile(filePath, 'utf8')
  const matches = [...content.matchAll(/data-ui-name=3D"Ellipsis">([^<]+)<\/div>/gu)].map((match) =>
    String(match[1]).trim(),
  )
  const domains = matches.filter((value) => /\./u.test(value) && !/\s/u.test(value))
  return [...new Set(domains)].filter((domain) => !domain.includes('semrush') && !domain.includes('urucortinas'))
}

const coverageState = (query, pages) => {
  const queryNorm = normalizeText(query)
  const matchedPage = pages.find((page) => {
    const slug = normalizeText(page.page)
    return queryNorm
      .split(/\s+/u)
      .filter(Boolean)
      .some((token) => slug.includes(token))
  })

  if (matchedPage) {
    return 'cubierta'
  }

  const familyHit = PRODUCT_FAMILIES.some((family) => queryNorm.includes(normalizeText(family.family).split(' ')[0]))
  return familyHit ? 'parcialmente cubierta' : 'no cubierta'
}

const sourceQuality = [
  {
    source: 'GA4',
    status: 'ok',
    confidence: 0.9,
    note: 'Mix de canales y volumen histórico disponibles en el reporte panorámico.',
  },
  {
    source: 'Search Console',
    status: 'ok',
    confidence: 0.95,
    note: 'Queries, clicks, impresiones, CTR y posición a nivel de página y consulta.',
  },
  {
    source: 'Google Ads',
    status: 'warning',
    confidence: 0.7,
    note: 'Las conversiones exportadas aparecen en cero; no usarlas como pérdida confirmada si la medición no está validada.',
  },
  {
    source: 'Semrush',
    status: 'reference',
    confidence: 0.55,
    note: 'Snapshot local para competencia y oportunidades semánticas; no es verdad operativa.',
  },
]

const buildReport = async () => {
  const [gscQueries, gscPages, adsKeywords, adsSearchTerms, adsCampaigns, ga4Channels] =
    await Promise.all([
      readZipCsv(SOURCES.gscZip, (name) => name.endsWith('Consultas.csv')),
      readZipCsv(SOURCES.gscZip, (name) => name.endsWith('Páginas.csv') || /ginas\.csv$/iu.test(name)),
      readCsv(SOURCES.adsKeywords),
      readCsv(SOURCES.adsSearchTerms),
      readCsv(SOURCES.adsCampaigns),
      extractGa4ChannelMix(),
    ])

  const semrushCompetitors = await extractCompetitorDomains(SOURCES.semrushCompetitors)

  const queries = gscQueries
    .map((row) => ({
      keyword: row['Consultas principales'],
      clicks: parseInteger(row.Clics),
      impressions: parseInteger(row.Impresiones),
      ctr: parsePercent(row.CTR),
      position: parsePosition(row.Posición),
    }))
    .filter((row) => row.keyword)
    .sort((a, b) => b.impressions - a.impressions)

  const pages = gscPages
    .map((row) => ({
      page: row['Páginas principales'],
      clicks: parseInteger(row.Clics),
      impressions: parseInteger(row.Impresiones),
      ctr: parsePercent(row.CTR),
      position: parsePosition(row.Posición),
    }))
    .filter((row) => row.page)
    .sort((a, b) => b.impressions - a.impressions)

  const adsTerms = adsKeywords
    .map((row) => ({
      keyword: row['Palabra clave de búsqueda'],
      cost: parseNumber(row.Coste) ?? 0,
      clicks: parseInteger(row.Clics),
      impressions: parseInteger(row.Impresiones),
      ctr: parsePercent(row.CTR),
      conversions: parseNumber(row.Conversiones) ?? 0,
    }))
    .filter((row) => row.keyword)
    .sort((a, b) => b.cost - a.cost)

  const adsSearch = adsSearchTerms
    .map((row) => ({
      keyword: row.Palabra ?? row.Buscar ?? '',
      cost: parseNumber(row.Coste) ?? 0,
      clicks: parseInteger(row.Clics),
      impressions: parseInteger(row.Impresiones),
      conversions: parseNumber(row.Conversiones) ?? 0,
      queries: String(row['Consultas principales que incluyen la palabra'] ?? '')
        .replace(/[()]/gu, '')
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean),
    }))
    .filter((row) => row.keyword)
    .sort((a, b) => b.cost - a.cost)

  const campaigns = adsCampaigns
    .map((row) => ({
      campaign: row['Nombre de la campaña'],
      cost: parseNumber(row.Coste) ?? 0,
      clicks: parseInteger(row.Clics),
      ctr: parsePercent(row.CTR),
    }))
    .filter((row) => row.campaign)

  const brandQuery = queries.find((row) => normalizeText(row.keyword).includes('urucortinas'))
  const genericQuickWins = queries.filter(
    (row) => row.impressions >= 400 && row.position >= 5 && row.position <= 20 && row.ctr < 3,
  )

  const topPages = pages.slice(0, 8)
  const pageImprovements = topPages
    .filter((row) => row.impressions >= 1000 && row.ctr < 5)
    .map((row) => ({
      page: row.page,
      issue: `CTR bajo para el volumen que recibe (${row.ctr.toFixed(2)}%)`,
      action: 'Reescribir title/meta y reforzar el bloque de intención principal arriba del fold.',
      expectedResult: 'Mejorar el porcentaje de clics sin perder posición.',
    }))

  const keywordOpportunities = [
    ...genericQuickWins.slice(0, 6).map((row) => ({
      keyword: row.keyword,
      volumen_estimado: row.impressions,
      fuente: 'GSC',
      intencion: 'transaccional',
      estado_actual: coverageState(row.keyword, pages),
      recomendacion: `Crear o mejorar una landing específica para "${row.keyword}" con foco en comparación, precio y uso.`,
      impacto_estimated: 'alto',
      esfuerzo_estimated: 'medio',
      prioridad: 1,
    })),
    ...adsSearch
      .filter((row) => row.cost >= 20)
      .slice(0, 6)
      .map((row) => ({
        keyword: row.keyword,
        volumen_estimado: row.impressions,
        fuente: 'Ads',
        intencion: 'transaccional',
        estado_actual: 'no cubierta',
        recomendacion: `Llevar esta intención a SEO con una página dedicada o una mejora fuerte de la landing existente para reducir dependencia del pago.`,
        impacto_estimated: 'alto',
        esfuerzo_estimated: 'medio',
        prioridad: 2,
      })),
  ]

  const contentProposals = [
    {
      objetivo: 'Capturar búsquedas de persianas y sus variantes',
      keywords_target: ['persianas', 'persianas de enrollar', 'persianas de pvc', 'persianas de aluminio'],
      tipo_contenido: 'landing de categoría + FAQ',
      por_que: 'La demanda existe en Search Console y hoy está parcialmente absorbida por páginas vecinas.',
      pagina_sugerida: '/productos/persianas-de-enrollar.html',
      contenido_incluir: 'tipos, usos, materiales, precios, medidas, instalación y mantenimiento',
      resultado_esperado: 'Más CTR orgánico y más landings alineadas con intención transaccional.',
    },
    {
      objetivo: 'Apropiar la intención de cortinas de enrollar PVC',
      keywords_target: [
        'cortinas de enrollar pvc',
        'cortinas de enrollar pvc precios',
        'cortinas de enrollar pvc sin albañilería',
      ],
      tipo_contenido: 'landing de producto + comparativa',
      por_que: 'Hay impresiones y la posición ya está cerca del quick win; falta una página con foco semántico claro.',
      pagina_sugerida: '/productos/cortinas-de-enrollar-pvc.html',
      contenido_incluir: 'beneficios del PVC, comparativa con aluminio, instalación, medidas, precios y casos de uso',
      resultado_esperado: 'Subir CTR y convertir la página en destino natural de Ads y SEO.',
    },
    {
      objetivo: 'Cerrar el gap de aberturas de aluminio',
      keywords_target: ['aberturas de aluminio', 'ventanas de aluminio', 'ventanas de aluminio precios y medidas'],
      tipo_contenido: 'landing comercial + guía de compra',
      por_que: 'La intención es claramente transaccional y ya aparece tanto en Search Console como en Ads.',
      pagina_sugerida: '/productos/aberturas-aluminio.html',
      contenido_incluir: 'tipos de abertura, medidas, terminaciones, precios, instalación y preguntas frecuentes',
      resultado_esperado: 'Más cobertura de una familia de alto valor comercial y menor fuga a competidores.',
    },
    {
      objetivo: 'Capturar búsquedas de reparación',
      keywords_target: ['reparacion de cortinas', 'arreglo de persianas', 'mantenimiento de cortinas'],
      tipo_contenido: 'landing de servicio',
      por_que: 'Es una intención de urgencia con alto valor de conversión cuando la persona busca solución inmediata.',
      pagina_sugerida: '/servicios/reparacion-cortinas-y-persianas.html',
      contenido_incluir: 'tipos de falla, cobertura, tiempos de respuesta, disponibilidad y FAQs',
      resultado_esperado: 'Aumentar leads de servicio y evitar que esa demanda termine en marcas competidoras.',
    },
    {
      objetivo: 'Extender la cobertura de cerramientos y toldos',
      keywords_target: ['cerramientos de aluminio', 'toldos de enrollar exterior', 'toldos', 'cerramientos'],
      tipo_contenido: 'landing de categoría + casos de uso',
      por_que: 'La demanda existe en Ads y en búsquedas relacionadas; hoy conviene agruparla en una arquitectura propia.',
      pagina_sugerida: '/productos/cerramientos-y-toldos.html',
      contenido_incluir: 'materiales, aplicaciones, exteriores, instalación, mantenimiento y comparativas',
      resultado_esperado: 'Mejor relevancia semántica y mejor linking interno entre familias de producto.',
    },
  ]

  const structureImprovements = [
    {
      cambio: 'Reorganizar Productos por familias',
      detalle: 'Cortinas de enrollar, Persianas, Aberturas, Toldos y cerramientos, Reparación y mantenimiento.',
      por_que: 'Las queries y campañas se agrupan por intención; la navegación debería reflejar esa estructura.',
    },
    {
      cambio: 'Crear interlinking por intención',
      detalle: 'Cada landing principal debe enlazar a FAQs, servicios y páginas vecinas de la misma familia.',
      por_que: 'El usuario llega por una query específica, pero necesita contexto de materiales, precio, instalación y servicio.',
    },
    {
      cambio: 'Agregar módulos de comparación y FAQ',
      detalle: 'Comparativas pvc vs aluminio, precios orientativos, instalación sin albañilería y mantenimiento.',
      por_que: 'El propio lenguaje de búsqueda delata la intención de compra y las dudas previas a la conversión.',
    },
  ]

  const seoAdsSynergy = {
    migrar_a_organico: adsSearch
      .filter((row) => row.cost >= 20)
      .slice(0, 8)
      .map((row) => row.keyword),
    mantener_en_ads: [
      'urucortinas',
      'uru cortinas',
      'bork cortinas',
      'cortifast',
      'gala',
    ],
    observacion:
      'Las conversiones exportadas aparecen en cero; esto se debe tratar como issue de medición o baja confianza hasta validar el tracking.',
  }

  const quickWins = [
    {
      accion: 'Actualizar title/meta del top page de cortinas de enrollar',
      por_que:
        'Es la página con más impresiones del sitio en Search Console y CTR bajo para el volumen que recibe.',
      impacto: 'alto',
      esfuerzo: 'bajo',
    },
    {
      accion: 'Reforzar el primer bloque visible en la homepage con enlaces a familias principales',
      por_que:
        'La homepage recibe tracción y puede funcionar como hub para transferir autoridad a las landings de mayor intención.',
      impacto: 'alto',
      esfuerzo: 'bajo',
    },
    {
      accion: 'Añadir FAQ y schema de preguntas frecuentes en páginas de producto',
      por_que:
        'Las queries muestran dudas repetidas sobre precios, medidas, instalación y materiales.',
      impacto: 'medio',
      esfuerzo: 'bajo',
    },
    {
      accion: 'Crear una landing de persianas si no existe una dedicada',
      por_que:
        'La query genérica tiene impresiones relevantes y la posición está en ventana de quick win.',
      impacto: 'alto',
      esfuerzo: 'medio',
    },
  ]

  const offDataOpportunities = [
    {
      idea: 'Páginas por material y uso',
      detalle: 'PVC, aluminio, black out, exterior, sin albañilería, a medida.',
    },
    {
      idea: 'Páginas por presupuesto y decisión',
      detalle: 'Precios, medidas, comparativas, instalación y mantenimiento.',
    },
    {
      idea: 'Páginas por servicio inmediato',
      detalle: 'Reparación, urgencias, cobertura geográfica y tiempos de respuesta.',
    },
    {
      idea: 'Páginas por geografía',
      detalle: 'Montevideo, Canelones y Maldonado como clusters cuando la operación lo justifique.',
    },
  ]

  const summary = [
    `La demanda orgánica está concentrada en familias de producto claras: ${keywordOpportunities
      .slice(0, 4)
      .map((item) => item.keyword)
      .join(', ')}.`,
    brandQuery
      ? `La marca está bien posicionada: "${brandQuery.keyword}" marca posición media ${brandQuery.position.toFixed(2)} y CTR de ${brandQuery.ctr.toFixed(2)}%, por lo que el problema no es de visibilidad de marca sino de cobertura de intención genérica.`
      : 'No aparece una señal de marca dominante en el top de queries, por lo que conviene fortalecer brand y navegación interna.',
    'Ads concentra gasto en términos con intención clara, pero las conversiones exportadas siguen en cero: eso debe tratarse como un problema de medición o baja confianza, no como pérdida confirmada.',
    `GA4 muestra un mix todavía fuertemente pagado: ${ga4Channels
      .slice(0, 4)
      .map((row) => `${row.channel} ${row.sessions.toLocaleString('es-UY')}`)
      .join(', ')}.`,
    `Semrush snapshot local detecta competidores visibles como ${semrushCompetitors.slice(0, 3).join(', ')}; la brecha principal no parece de marca sino de arquitectura y cobertura semántica.`,
  ].join(' ')

  return {
    meta: {
      generatedAt: new Date().toISOString(),
      scope: 'seo-data-driven-report',
      sources: Object.fromEntries(
        Object.entries(SOURCES).map(([key, value]) => [key, value]),
      ),
    },
    resumen_ejecutivo: summary,
    calidad_por_fuente: sourceQuality,
    oportunidades_keywords: keywordOpportunities,
    propuestas_contenido: contentProposals,
    mejoras_contenido_existente: pageImprovements,
    mejoras_estructura_sitio: structureImprovements,
    sinergia_seo_ads: seoAdsSynergy,
    quick_wins: quickWins,
    oportunidades_fuera_de_la_data: offDataOpportunities,
    datos_base: {
      gsc_queries: queries.slice(0, 15),
      gsc_pages: pages.slice(0, 10),
      ads_keywords: adsTerms.slice(0, 12),
      ads_search_terms: adsSearch.slice(0, 12),
      ads_campaigns: campaigns,
      ga4_channel_mix: ga4Channels,
      semrush_competitors: semrushCompetitors.slice(0, 10),
    },
  }
}

const renderMarkdown = (report) => {
  const keywordRows = report.oportunidades_keywords
    .map(
      (item) =>
        `| ${item.keyword} | ${item.volumen_estimado} | ${item.fuente} | ${item.intencion} | ${item.estado_actual} | ${item.recomendacion} |`,
    )
    .join('\n')

  const proposals = report.propuestas_contenido
    .map(
      (item) =>
        `- **${item.objetivo}**\n  - URL sugerida: \`${item.pagina_sugerida}\`\n  - Keywords: ${item.keywords_target.join(', ')}\n  - Contenido: ${item.contenido_incluir}\n  - Resultado esperado: ${item.resultado_esperado}`,
    )
    .join('\n')

  const quickWins = report.quick_wins
    .map(
      (item) =>
        `- **${item.accion}**\n  - Por qué: ${item.por_que}\n  - Impacto: ${item.impacto}\n  - Esfuerzo: ${item.esfuerzo}`,
    )
    .join('\n')

  return `# Informe SEO data-driven

## Resumen ejecutivo
${report.resumen_ejecutivo}

## Calidad por fuente
${report.calidad_por_fuente
  .map((item) => `- **${item.source}**: ${item.status} (${Math.round(item.confidence * 100)}%) - ${item.note}`)
  .join('\n')}

## Oportunidades de keywords
| Keyword | Volumen estimado | Fuente | Intención | Estado actual | Recomendación |
| --- | ---: | --- | --- | --- | --- |
${keywordRows}

## Propuestas de contenido
${proposals}

## Mejoras sobre contenido existente
${report.mejoras_contenido_existente
  .map(
    (item) =>
      `- **${item.page}**: ${item.issue}. Acción: ${item.action}. Resultado esperado: ${item.expectedResult}.`,
  )
  .join('\n')}

## Mejoras de estructura
${report.mejoras_estructura_sitio
  .map((item) => `- **${item.cambio}**: ${item.detalle}. ${item.por_que}`)
  .join('\n')}

## Sinergia SEO + Ads
- Migrar a orgánico: ${report.sinergia_seo_ads.migrar_a_organico.join(', ')}
- Mantener en Ads: ${report.sinergia_seo_ads.mantener_en_ads.join(', ')}
- Nota: ${report.sinergia_seo_ads.observacion}

## Quick wins
${quickWins}

## Oportunidades fuera de la data
${report.oportunidades_fuera_de_la_data
  .map((item) => `- **${item.idea}**: ${item.detalle}`)
  .join('\n')}

## Datos base
- Querys GSC: ${report.datos_base.gsc_queries.length}
- Páginas GSC: ${report.datos_base.gsc_pages.length}
- Keywords Ads: ${report.datos_base.ads_keywords.length}
- Search terms Ads: ${report.datos_base.ads_search_terms.length}
- Mix GA4: ${report.datos_base.ga4_channel_mix.map((item) => `${item.channel} ${item.sessions}`).join(', ')}
- Competidores Semrush: ${report.datos_base.semrush_competitors.join(', ')}
`
}

const main = async () => {
  const report = await buildReport()
  await fs.mkdir(outputDir, { recursive: true })
  await fs.writeFile(outputJson, `${JSON.stringify(report, null, 2)}\n`)
  await fs.writeFile(outputMd, `${renderMarkdown(report)}\n`)
  console.log(`SEO report generated:\n- ${outputJson}\n- ${outputMd}`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
