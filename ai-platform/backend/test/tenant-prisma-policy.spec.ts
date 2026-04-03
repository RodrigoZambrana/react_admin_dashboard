import {
  applyTenantScope,
  mergeTenantWhere,
} from '../src/modules/persistence/prisma/tenant-prisma-policy';

describe('tenant prisma policy', () => {
  describe('mergeTenantWhere', () => {
    it('adds tenantId to empty where clauses', () => {
      expect(mergeTenantWhere(undefined, 'tenant-a')).toEqual({
        tenantId: 'tenant-a',
      });
    });

    it('wraps where clauses without overriding non-tenant filters', () => {
      expect(mergeTenantWhere({ id: 'conv-1' }, 'tenant-a')).toEqual({
        AND: [{ id: 'conv-1' }, { tenantId: 'tenant-a' }],
      });
    });

    it('ignores matching caller-supplied tenantId filters and keeps other filters', () => {
      expect(
        mergeTenantWhere(
          {
            id: 'conv-1',
            tenantId: 'tenant-a',
          },
          'tenant-a',
        ),
      ).toEqual({
        AND: [{ id: 'conv-1' }, { tenantId: 'tenant-a' }],
      });
    });

    it('ignores mismatching caller-supplied tenantId filters and keeps other filters', () => {
      expect(
        mergeTenantWhere(
          {
            id: 'conv-1',
            tenantId: 'tenant-b',
          },
          'tenant-a',
        ),
      ).toEqual({
        AND: [{ id: 'conv-1' }, { tenantId: 'tenant-a' }],
      });
    });
  });

  describe('applyTenantScope', () => {
    it('injects tenant scope into create operations and overwrites caller tenantId', () => {
      expect(
        applyTenantScope(
          {
            action: 'create',
            model: 'Conversation',
            args: {
              data: {
                tenantId: 'tenant-b',
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

    it('injects tenant scope into createMany operations and overwrites caller tenantId', () => {
      expect(
        applyTenantScope(
          {
            action: 'createMany',
            model: 'Message',
            args: {
              data: [
                {
                  tenantId: 'tenant-b',
                  content: 'hola',
                },
                {
                  content: 'chau',
                },
              ],
            },
          },
          'tenant-a',
        ),
      ).toMatchObject({
        args: {
          data: [
            {
              tenantId: 'tenant-a',
              content: 'hola',
            },
            {
              tenantId: 'tenant-a',
              content: 'chau',
            },
          ],
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

    it('scopes conversation state reads and overwrites caller tenantId on create', () => {
      expect(
        applyTenantScope(
          {
            action: 'findFirst',
            model: 'ConversationState',
            args: {
              where: {
                conversationId: 'conv-1',
                tenantId: 'tenant-b',
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

      expect(
        applyTenantScope(
          {
            action: 'create',
            model: 'ConversationState',
            args: {
              data: {
                tenantId: 'tenant-b',
                conversationId: 'conv-1',
                lane: 'booking',
              },
            },
          },
          'tenant-a',
        ),
      ).toMatchObject({
        args: {
          data: {
            tenantId: 'tenant-a',
            conversationId: 'conv-1',
            lane: 'booking',
          },
        },
      });
    });

    it('overwrites caller tenantId in update data while forcing tenant scope in where', () => {
      expect(
        applyTenantScope(
          {
            action: 'updateMany',
            model: 'Message',
            args: {
              where: {
                conversationId: 'conv-1',
                tenantId: 'tenant-b',
              },
              data: {
                tenantId: 'tenant-b',
                content: 'actualizado',
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
          data: {
            tenantId: 'tenant-a',
            content: 'actualizado',
          },
        },
      });
    });

    it('forces tenant scope in upsert where and overwrites caller tenantId in create/update', () => {
      expect(
        applyTenantScope(
          {
            action: 'upsert',
            model: 'PromptVersion',
            args: {
              where: {
                key: 'interpretation',
                tenantId: 'tenant-b',
              },
              create: {
                tenantId: 'tenant-b',
                key: 'interpretation',
                version: 1,
              },
              update: {
                tenantId: 'tenant-b',
                status: 'ACTIVE',
              },
            },
          },
          'tenant-a',
        ),
      ).toMatchObject({
        args: {
          where: {
            AND: [{ key: 'interpretation' }, { tenantId: 'tenant-a' }],
          },
          create: {
            tenantId: 'tenant-a',
            key: 'interpretation',
            version: 1,
          },
          update: {
            tenantId: 'tenant-a',
            status: 'ACTIVE',
          },
        },
      });
    });
  });
});
