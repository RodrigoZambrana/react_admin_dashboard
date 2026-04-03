import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'node:async_hooks';

export type TenantRequestContext = {
  tenantId: string;
  traceId: string;
};

@Injectable()
export class TenantContextService {
  private readonly storage = new AsyncLocalStorage<TenantRequestContext>();

  run<T>(context: TenantRequestContext, callback: () => T): T {
    return this.storage.run(context, callback);
  }

  getTenantId(): string {
    const context = this.storage.getStore();
    if (!context?.tenantId) {
      throw new Error('Tenant context is not available');
    }

    return context.tenantId;
  }

  tryGetTenantId(): string | null {
    return this.storage.getStore()?.tenantId ?? null;
  }

  getTraceId(): string {
    return this.storage.getStore()?.traceId ?? 'missing-trace-id';
  }
}
