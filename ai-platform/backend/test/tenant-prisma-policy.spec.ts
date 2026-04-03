import { applyTenantScope, mergeTenantWhere } from '../src/modules/persistence/prisma/tenant-prisma-policy';

describe('tenant prisma policy', () => {
  it('adds tenantId to empty where clauses', () => {
    expect(mergeTenantWhere(undefined, 'tenant-a')).toEqual({
      tenantId: 'tenant-a',
    });
  });

  it('wraps where clauses without overriding filters', () => {
    expect(mergeTenantWhere({ id: 'conv-1' }, 'tenant-a')).toEqual({
      AND: [{ id: 'conv-1' }, { tenantId: 'tenant-a' }],
    });
  });

  it('injects tenant scope into create operations', () => {
    expect(
      applyTenantScope(
        {
          action: 'create',
          model: 'Conversation',
          args: {
            data: {
              language: 'es',
            },
          },
        },
        'tenant-a',
      ),
    ).toMatchObject({
      args: {
        data: {
          tenantId: 'tenant-a',
          language: 'es',
        },
      },
    });
  });

  it('injects tenant scope into read operations', () => {
    expect(
      applyTenantScope(
        {
          action: 'findMany',
          model: 'Message',
          args: {
            where: {
              conversationId: 'conv-1',
            },
          },
        },
        'tenant-a',
      ),
    ).toMatchObject({
      args: {
        where: {
          AND: [{ conversationId: 'conv-1' }, { tenantId: 'tenant-a' }],
        },
      },
    });
  });
});
