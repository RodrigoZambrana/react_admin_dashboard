import { Injectable, UnauthorizedException } from '@nestjs/common'
import { PassportStrategy } from '@nestjs/passport'
import { ExtractJwt, Strategy } from 'passport-jwt'
import type { FastifyRequest } from 'fastify'
import { resolveRequiredEnv } from '../common/config/runtime-env'

export interface StorefrontJwtPayload {
  sub: number
  email?: string
  firstName?: string
  lastName?: string
  scope: 'storefront'
  tokenType: 'access'
  iat?: number
  exp?: number
}

const cookieExtractor = (req: FastifyRequest) => req?.cookies?.storefront_access_token

@Injectable()
export class StorefrontJwtStrategy extends PassportStrategy(Strategy, 'storefront-jwt') {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        cookieExtractor,
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: resolveRequiredEnv('JWT_SECRET', {
        developmentFallback: 'local-dev-jwt-secret-change-me',
      }),
    })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async validate(payload: any): Promise<StorefrontJwtPayload> {
    if (!payload?.sub || payload.scope !== 'storefront' || payload.tokenType !== 'access') {
      throw new UnauthorizedException()
    }
    return payload as StorefrontJwtPayload
  }
}
