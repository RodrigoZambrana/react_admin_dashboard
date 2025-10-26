import { CanActivate, ExecutionContext } from '@nestjs/common';
import type { ClientVariantConfig } from '../../config/client-config.types';
export declare class BudgetsFeatureGuard implements CanActivate {
    private readonly clientConfig;
    constructor(clientConfig: ClientVariantConfig);
    canActivate(_context: ExecutionContext): boolean;
}
