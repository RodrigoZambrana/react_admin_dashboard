export type TenantKnowledgeRepoSource = {
  kind: 'repo_markdown'
  pathWithinDocs: string
  scope: 'customer_public' | 'admin_internal'
  sourceKey: string
  title?: string
  tags?: string[]
  metadata?: Record<string, unknown>
}

export type TenantKnowledgeWebSource = {
  kind: 'web_page'
  url: string
  scope: 'customer_public' | 'admin_internal'
  sourceKey: string
  title?: string
  tags?: string[]
  metadata?: Record<string, unknown>
}

export type TenantKnowledgeSource =
  | TenantKnowledgeRepoSource
  | TenantKnowledgeWebSource

const urucortinasSources: TenantKnowledgeSource[] = [
  {
    kind: 'web_page',
    url: 'https://urucortinas.com.uy/',
    scope: 'customer_public',
    sourceKey: 'tenant-site:urucortinas:home',
    title: 'UruCortinas · Inicio',
    tags: ['urucortinas', 'site', 'home', 'public'],
    metadata: {
      audience: 'public',
      section: 'home',
    },
  },
  {
    kind: 'web_page',
    url: 'https://urucortinas.com.uy/productos/cortinas-roller.html',
    scope: 'customer_public',
    sourceKey: 'tenant-site:urucortinas:cortinas-roller',
    title: 'UruCortinas · Cortinas Roller',
    tags: ['urucortinas', 'site', 'product', 'roller', 'public'],
    metadata: {
      audience: 'public',
      section: 'product',
    },
  },
  {
    kind: 'web_page',
    url: 'https://urucortinas.com.uy/productos/cortinas-de-enrollar.html',
    scope: 'customer_public',
    sourceKey: 'tenant-site:urucortinas:cortinas-enrollar',
    title: 'UruCortinas · Cortinas de Enrollar',
    tags: ['urucortinas', 'site', 'product', 'persianas', 'public'],
    metadata: {
      audience: 'public',
      section: 'product',
    },
  },
  {
    kind: 'web_page',
    url: 'https://urucortinas.com.uy/productos/aberturas-aluminio.html',
    scope: 'customer_public',
    sourceKey: 'tenant-site:urucortinas:aberturas-aluminio',
    title: 'UruCortinas · Aberturas de Aluminio',
    tags: ['urucortinas', 'site', 'product', 'aberturas', 'public'],
    metadata: {
      audience: 'public',
      section: 'product',
    },
  },
  {
    kind: 'web_page',
    url: 'https://urucortinas.com.uy/productos/toldos-y-cerramientos.html',
    scope: 'customer_public',
    sourceKey: 'tenant-site:urucortinas:toldos-cerramientos',
    title: 'UruCortinas · Toldos y Cerramientos',
    tags: ['urucortinas', 'site', 'product', 'toldos', 'public'],
    metadata: {
      audience: 'public',
      section: 'product',
    },
  },
  {
    kind: 'web_page',
    url: 'https://urucortinas.com.uy/servicios/reparacion-cortinas-y-persianas.html',
    scope: 'customer_public',
    sourceKey: 'tenant-site:urucortinas:servicios-reparacion',
    title: 'UruCortinas · Reparación de cortinas y persianas',
    tags: ['urucortinas', 'site', 'service', 'reparacion', 'public'],
    metadata: {
      audience: 'public',
      section: 'service',
    },
  },
  {
    kind: 'web_page',
    url: 'https://urucortinas.com.uy/contacto.html',
    scope: 'customer_public',
    sourceKey: 'tenant-site:urucortinas:contacto',
    title: 'UruCortinas · Contacto',
    tags: ['urucortinas', 'site', 'contacto', 'public'],
    metadata: {
      audience: 'public',
      section: 'contact',
    },
  },
  {
    kind: 'web_page',
    url: 'https://urucortinas.com.uy/catalogo/index.html',
    scope: 'customer_public',
    sourceKey: 'tenant-site:urucortinas:catalogo',
    title: 'UruCortinas · Catálogo',
    tags: ['urucortinas', 'site', 'catalogo', 'public'],
    metadata: {
      audience: 'public',
      section: 'catalog',
    },
  },
]

export function getTenantKnowledgeSources(
  tenantKey: string,
): TenantKnowledgeSource[] {
  switch (tenantKey) {
    case 'urucortinas':
      return urucortinasSources
    default:
      return []
  }
}
