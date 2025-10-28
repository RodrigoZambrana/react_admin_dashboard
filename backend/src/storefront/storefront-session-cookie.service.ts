import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { FastifyReply } from 'fastify'
import type { StorefrontAuthSession } from './types'

type SameSiteOption = 'lax' | 'strict' | 'none'

const ACCESS_TOKEN_MAX_AGE_SECONDS = 15 * 60 // 15 minutes
const REFRESH_TOKEN_MAX_AGE_SECONDS = 7 * 24 * 60 * 60 // 7 days

@Injectable()
export class StorefrontSessionCookieService {
  private readonly secure: boolean
  private readonly sameSite: SameSiteOption
  private readonly domain?: string
  private readonly path = '/'

  constructor(private readonly config: ConfigService) {
    const secureOverride = (this.config.get<string>('STOREFRONT_COOKIE_SECURE') ?? '').trim().toLowerCase()
    if (secureOverride === 'true') {
      this.secure = true
    } else if (secureOverride === 'false') {
      this.secure = false
    } else {
      this.secure = (this.config.get<string>('NODE_ENV') ?? '').toLowerCase() === 'production'
    }

    const sameSiteOverride = (this.config.get<string>('STOREFRONT_COOKIE_SAMESITE') ?? '').trim().toLowerCase()
    if (sameSiteOverride === 'strict' || sameSiteOverride === 'none' || sameSiteOverride === 'lax') {
      this.sameSite = sameSiteOverride
    } else {
      this.sameSite = 'lax'
    }

    const domainValue = (this.config.get<string>('STOREFRONT_COOKIE_DOMAIN') ?? '').trim()
    this.domain = domainValue.length ? domainValue : undefined
  }

  setSessionCookies(reply: FastifyReply, session: StorefrontAuthSession) {
    reply.setCookie('storefront_access_token', session.accessToken, {
      httpOnly: true,
      sameSite: this.sameSite,
      secure: this.secure,
      path: this.path,
      maxAge: ACCESS_TOKEN_MAX_AGE_SECONDS,
      domain: this.domain,
    })

    if (session.refreshToken) {
      reply.setCookie('storefront_refresh_token', session.refreshToken, {
        httpOnly: true,
        sameSite: this.sameSite,
        secure: this.secure,
        path: this.path,
        maxAge: REFRESH_TOKEN_MAX_AGE_SECONDS,
        domain: this.domain,
      })
    } else {
      reply.clearCookie('storefront_refresh_token', { path: this.path, domain: this.domain })
    }
  }

  clearSessionCookies(reply: FastifyReply) {
    reply.clearCookie('storefront_access_token', { path: this.path, domain: this.domain })
    reply.clearCookie('storefront_refresh_token', { path: this.path, domain: this.domain })
  }
}
