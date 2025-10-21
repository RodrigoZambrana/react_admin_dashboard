import {
  CanActivate,
  ExecutionContext,
  Injectable,
  NotFoundException,
  Inject,
} from '@nestjs/common'
import { CLIENT_CONFIG_TOKEN } from '../../config/client-config.constants'
import type { ClientVariantConfig } from '../../config/client-config.types'

@Injectable()
export class BudgetsFeatureGuard implements CanActivate {
  constructor(
    @Inject(CLIENT_CONFIG_TOKEN)
    private readonly clientConfig: ClientVariantConfig,
  ) {}

  canActivate(_context: ExecutionContext): boolean {
    const enabled = Boolean(this.clientConfig?.featureFlags?.BUDGETS)
    if (!enabled) {
      throw new NotFoundException()
    }
    return true
  }
}
