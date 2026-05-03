import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common'
import { createHash } from 'crypto'
import { Reflector } from '@nestjs/core'
import { JwtService } from '@nestjs/jwt'
import { ConfigService } from '@nestjs/config'
import { SecureConfigService } from '../common/security/secure-config.service'
import { INSIGHTS_SCOPES_KEY } from './insights-scopes.decorator'
import type {
  InsightsApiAuthConfig,
  InsightsPrincipal,
  InsightsScope,
  InsightsRequest,
  InsightsApiKeyCredential,
} from './insights.types'

const DEFAULT_API_KEY_CONFIG_KEY = 'INSIGHTS_API_AUTH'

const splitScopes = (value: unknown): InsightsScope[] => {
  if (Array.isArray(value)) {
    return value
      .map((item) => String(item).trim())
      .filter(Boolean) as InsightsScope[]
  }
  if (typeof value !== 'string') {
    return []
  }
  return value
    .split(/[,\s]+/u)
    .map((item) => item.trim())
    .filter(Boolean) as InsightsScope[]
}

const hasWildcardScope = (scopes: string[]) =>
  scopes.includes('*') || scopes.includes('admin') || scopes.includes('read:*')

const hashToken = (value: string) =>
  createHash('sha256').update(value, 'utf8').digest('hex')

@Injectable()
export class InsightsAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
    private readonly secureConfig: SecureConfigService,
    private readonly config: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredScopes =
      this.reflector.getAllAndOverride<InsightsScope[]>(INSIGHTS_SCOPES_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? []

    const request = context.switchToHttp().getRequest<InsightsRequest & { headers?: Record<string, string | string[] | undefined> }>()
    const token = this.extractBearerToken(request.headers?.authorization)
    if (!token) {
      throw new UnauthorizedException('missing_bearer_token')
    }

    const principal =
      (await this.tryResolveJwtPrincipal(token)) ??
      (await this.tryResolveApiKeyPrincipal(token))

    if (!principal) {
      throw new UnauthorizedException('invalid_insights_token')
    }

    if (!this.hasRequiredScopes(principal.scopes, requiredScopes)) {
      throw new UnauthorizedException('insufficient_insights_scope')
    }

    request.insightsPrincipal = principal
    return true
  }

  private extractBearerToken(value?: string | string[] | undefined) {
    if (typeof value !== 'string') {
      return null
    }
    const match = value.trim().match(/^Bearer\s+(.+)$/iu)
    return match?.[1]?.trim() || null
  }

  private async tryResolveJwtPrincipal(token: string): Promise<InsightsPrincipal | null> {
    try {
      const payload = (await this.jwtService.verifyAsync(token)) as {
        sub?: string | number
        scope?: string
        scopes?: string[] | string
        authority?: string[]
      }
      if (!payload?.sub) {
        return null
      }

      const scopes = splitScopes(payload.scopes ?? payload.scope ?? payload.authority ?? [])
      const principal: InsightsPrincipal = {
        type: 'jwt',
        subject: String(payload.sub),
        scopes: scopes.length ? scopes : ['admin'],
        userId: String(payload.sub),
      }

      return principal
    } catch {
      return null
    }
  }

  private async tryResolveApiKeyPrincipal(token: string): Promise<InsightsPrincipal | null> {
    const configKey = this.config.get<string>('INSIGHTS_API_AUTH_KEY')?.trim() || DEFAULT_API_KEY_CONFIG_KEY
    let stored: { value: InsightsApiAuthConfig } | null = null
    try {
      stored = await this.secureConfig.getJson<InsightsApiAuthConfig>(configKey)
    } catch {
      stored = null
    }

    const credentials: InsightsApiKeyCredential[] = stored?.value?.credentials?.length
      ? stored.value.credentials
      : this.buildEnvCredentials()

    const credential = credentials.find(
      (entry) =>
        entry.enabled !== false &&
        (
          (entry.tokenHash ? entry.tokenHash.trim() === hashToken(token) : false) ||
          (entry.token ? entry.token.trim() === token : false)
        ) &&
        (!entry.expiresAt || Number.isNaN(new Date(entry.expiresAt).getTime()) || new Date(entry.expiresAt).getTime() > Date.now()),
    )

    if (!credential) {
      return null
    }

    return {
      type: 'api_key',
      subject: credential.name,
      scopes: credential.scopes,
      tokenName: credential.name,
    }
  }

  private buildEnvCredentials() {
    const token =
      this.config.get<string>('INSIGHTS_API_KEY')?.trim() ||
      this.config.get<string>('ANALYTICS_INSIGHTS_API_KEY')?.trim() ||
      ''
    if (!token) {
      return []
    }
    const scopes = splitScopes(
      this.config.get<string>('INSIGHTS_API_SCOPES')?.trim() ||
        'read:products read:search read:analytics read:ads read:funnels',
    )
    const name = this.config.get<string>('INSIGHTS_API_KEY_NAME')?.trim() || 'default'
    const expiresAt = this.config.get<string>('INSIGHTS_API_KEY_EXPIRES_AT')?.trim() || null
    return [{ name, token, scopes, enabled: true, expiresAt }]
  }

  private hasRequiredScopes(scopes: string[], requiredScopes: InsightsScope[]) {
    if (!requiredScopes.length) {
      return true
    }
    if (hasWildcardScope(scopes)) {
      return true
    }
    const normalized = new Set(scopes.map((scope) => scope.trim()))
    return requiredScopes.every((scope) => normalized.has(scope))
  }
}
