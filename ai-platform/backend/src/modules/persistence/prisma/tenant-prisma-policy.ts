type PrismaAction =
  | 'findMany'
  | 'findFirst'
  | 'count'
  | 'aggregate'
  | 'create'
  | 'createMany'
  | 'update'
  | 'updateMany'
  | 'delete'
  | 'deleteMany'
  | 'upsert';

type PrismaParams = {
  action: PrismaAction | string;
  model?: string;
  args?: Record<string, unknown>;
};

const TENANT_MODELS = new Set([
  'Conversation',
  'Message',
  'ChatLog',
  'PromptVersion',
  'Knowledge',
]);

export function isTenantScopedModel(model?: string): boolean {
  return Boolean(model && TENANT_MODELS.has(model));
}

export function mergeTenantWhere(
  where: Record<string, unknown> | undefined,
  tenantId: string,
) {
  if (!where || Object.keys(where).length === 0) {
    return { tenantId };
  }

  if ('tenantId' in where) {
    return where;
  }

  return {
    AND: [where, { tenantId }],
  };
}

function injectTenantIntoData(
  data: Record<string, unknown> | Record<string, unknown>[] | undefined,
  tenantId: string,
) {
  if (!data) {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map((item) => ({
      tenantId,
      ...item,
    }));
  }

  return {
    tenantId,
    ...data,
  };
}

export function applyTenantScope<T extends PrismaParams>(
  params: T,
  tenantId: string,
): T {
  if (!isTenantScopedModel(params.model)) {
    return params;
  }

  const nextArgs = { ...(params.args ?? {}) };

  switch (params.action) {
    case 'findMany':
    case 'findFirst':
    case 'count':
    case 'aggregate':
    case 'update':
    case 'updateMany':
    case 'delete':
    case 'deleteMany':
      nextArgs.where = mergeTenantWhere(
        nextArgs.where as Record<string, unknown> | undefined,
        tenantId,
      );
      break;
    case 'create':
      nextArgs.data = injectTenantIntoData(
        nextArgs.data as Record<string, unknown> | undefined,
        tenantId,
      );
      break;
    case 'createMany':
      nextArgs.data = injectTenantIntoData(
        nextArgs.data as Record<string, unknown>[] | undefined,
        tenantId,
      );
      break;
    case 'upsert':
      nextArgs.where = mergeTenantWhere(
        nextArgs.where as Record<string, unknown> | undefined,
        tenantId,
      );
      nextArgs.create = injectTenantIntoData(
        nextArgs.create as Record<string, unknown> | undefined,
        tenantId,
      );
      nextArgs.update = injectTenantIntoData(
        nextArgs.update as Record<string, unknown> | undefined,
        tenantId,
      );
      break;
    default:
      break;
  }

  return {
    ...params,
    args: nextArgs,
  } as T;
}
