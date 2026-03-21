import { Injectable, UnauthorizedException } from '@nestjs/common'
import { PassportStrategy } from '@nestjs/passport'
import { ExtractJwt, Strategy } from 'passport-jwt'
import type { FastifyRequest } from 'fastify'
import { resolveRequiredEnv } from '../common/config/runtime-env'

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req: FastifyRequest) => req?.cookies?.access_token,
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: resolveRequiredEnv('JWT_SECRET', {
        developmentFallback: 'local-dev-jwt-secret-change-me',
      }),
    })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async validate(payload: any) {
    if (!payload?.sub) throw new UnauthorizedException()
    if (payload?.scope && payload.scope !== 'admin') {
      throw new UnauthorizedException()
    }
    return payload
  }
}
