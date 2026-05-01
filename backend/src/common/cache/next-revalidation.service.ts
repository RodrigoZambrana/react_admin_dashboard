import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

type NextRevalidationPayload = {
  secret?: string
  paths?: string[]
  tags?: string[]
}

const normalizePath = (value: string | null | undefined) => {
  if (!value) {
    return null
  }
  const trimmed = value.trim()
  if (!trimmed) {
    return null
  }
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`
}

const normalizeTag = (value: string | null | undefined) => {
  if (!value) {
    return null
  }
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

@Injectable()
export class NextRevalidationService {
  private readonly logger = new Logger(NextRevalidationService.name)
  private readonly baseUrl: string | null
  private readonly secret: string | null

  constructor(private readonly config: ConfigService) {
    this.baseUrl =
      this.config.get<string>('NEXT_REVALIDATE_URL') ||
      this.config.get<string>('STOREFRONT_WEB_URL') ||
      this.config.get<string>('NEXT_PUBLIC_SITE_URL') ||
      this.config.get<string>('SITE_URL') ||
      null
    this.secret =
      this.config.get<string>('NEXT_REVALIDATE_SECRET') ||
      this.config.get<string>('STOREFRONT_REVALIDATE_SECRET') ||
      null
  }

  async revalidateProduct(input: {
    productId: number
    slug?: string | null
    categorySlugs?: Array<string | null | undefined>
  }) {
    const paths = [
      normalizePath(`/product/${input.slug}`),
      normalizePath(`/products/${input.slug}`),
      normalizePath(`/product/${input.productId}`),
    ].filter((value): value is string => Boolean(value))

    const tags = [
      normalizeTag(input.slug ? `product:${input.slug}` : null),
      normalizeTag(`product:${input.productId}`),
      normalizeTag('products'),
      ...Array.from(
        new Set(
          (input.categorySlugs ?? [])
            .map((value) => normalizeTag(value ? `category:${value}` : null))
            .filter((value): value is string => Boolean(value)),
        ),
      ),
    ].filter((value): value is string => Boolean(value))

    await this.revalidate({ paths, tags })
  }

  async revalidate(input: NextRevalidationPayload) {
    if (!this.baseUrl || !this.secret) {
      this.logger.debug('Next revalidation skipped because base URL or secret is not configured.')
      return
    }

    const paths = Array.from(new Set((input.paths ?? []).map(normalizePath).filter((value): value is string => Boolean(value))))
    const tags = Array.from(new Set((input.tags ?? []).map(normalizeTag).filter((value): value is string => Boolean(value))))

    if (!paths.length && !tags.length) {
      return
    }

    const endpoint = new URL('/api/revalidate', this.baseUrl.endsWith('/') ? this.baseUrl : `${this.baseUrl}/`)
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-revalidate-secret': this.secret,
      },
      body: JSON.stringify({
        paths,
        tags,
      }),
    })

    if (!response.ok) {
      const body = await response.text().catch(() => '')
      this.logger.warn(
        `Next revalidation failed with status ${response.status}: ${body.slice(0, 240)}`,
      )
      return
    }

    this.logger.log(
      `Next revalidated paths=${paths.length} tags=${tags.length} via ${endpoint.origin}`,
    )
  }
}
