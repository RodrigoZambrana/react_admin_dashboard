import { CanActivate, ExecutionContext, Injectable, NotFoundException, Inject } from '@nestjs/common'
import { CLIENT_CONFIG_TOKEN } from '../config/client-config.constants'
import type { ClientVariantConfig } from '../config/client-config.types'

@Injectable()
export class ParametricFeatureGuard implements CanActivate {
  constructor(
    @Inject(CLIENT_CONFIG_TOKEN)
    private readonly clientConfig: ClientVariantConfig,
  ) {}

  canActivate(_context: ExecutionContext): boolean {
    const enabled =
      this.clientConfig?.slug === 'urucortinas' &&
      Boolean(this.clientConfig?.featureFlags?.PARAMETRIC_PRODUCTS)
    if (!enabled) {
      throw new NotFoundException()
    }
    return true
  }
}
