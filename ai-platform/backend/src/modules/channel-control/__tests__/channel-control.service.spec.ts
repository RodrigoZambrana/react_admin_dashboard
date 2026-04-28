import { ChannelControlService } from '../channel-control.service';

type ActiveConfigStore = {
  active: any | null;
  versions: any[];
};

function createHarness(initialActive: any | null = null) {
  const activeStore: ActiveConfigStore = {
    active: initialActive,
    versions: [],
  };

  const connectionStateStore = new Map<string, any>();

  const criticalConfigService = {
    getActiveConfig: jest.fn(async () => activeStore.active),
    createVersion: jest.fn(async (input: any) => {
      const now = new Date('2026-04-27T00:00:00.000Z');
      const version = {
        id: `version-${activeStore.versions.length + 1}`,
        key: input.key,
        value: input.value,
        version: activeStore.versions.length + 1,
        status: input.activate === false ? 'DRAFT' : 'ACTIVE',
        metadata: input.metadata ?? null,
        createdBy: input.createdBy ?? null,
        createdAt: now,
        updatedAt: now,
      };

      activeStore.versions.push(version);
      if (input.activate !== false) {
        activeStore.active = version;
      }

      return version;
    }),
  } as any;

  const channelConnectionStateRepository = {
    listAll: jest.fn(async () => Array.from(connectionStateStore.values())),
    upsert: jest.fn(async (input: any) => {
      const now = new Date('2026-04-27T00:00:00.000Z');
      const record = {
        ...input,
        summary: input.summary ?? null,
        payload: input.payload ?? {},
        metadata: input.metadata ?? {},
        capabilities: input.capabilities ?? {},
        observedAt: input.observedAt ?? now,
        createdAt: now,
        updatedAt: now,
      };

      connectionStateStore.set(input.channelKey, record);
      return record;
    }),
  } as any;

  const channelSecretStoreService = {
    resolveSecretRef: jest.fn(async () => 'resolved-secret'),
  } as any;

  const configService = {
    get: jest.fn(),
  } as any;

  const service = () =>
    new ChannelControlService(
      criticalConfigService,
      channelConnectionStateRepository,
      channelSecretStoreService,
      configService,
    );

  return {
    service,
    criticalConfigService,
    channelConnectionStateRepository,
    channelSecretStoreService,
    configService,
    activeStore,
    connectionStateStore,
  };
}

describe('ChannelControlService', () => {
  it('persists channel control config across service re-instantiation', async () => {
    const harness = createHarness();
    const serviceA = harness.service();

    await serviceA.updateEmail(
      {
        enabled: true,
        imapHost: 'imap.example.com',
        imapPort: 993,
        smtpHost: 'smtp.example.com',
        smtpPort: 587,
        fromAddress: 'support@example.com',
        fromName: 'Support',
        usernameRef: { strategy: 'local', ref: 'local:email.username' },
        passwordRef: { strategy: 'local', ref: 'local:email.password' },
      },
      'qa',
    );

    expect(harness.criticalConfigService.createVersion).toHaveBeenCalledTimes(1);
    expect(harness.activeStore.active?.value?.email?.imapHost).toBe('imap.example.com');

    const serviceB = harness.service();
    const overview = await serviceB.getOverview();

    expect(overview.managedVersion?.version).toBe(1);
    expect(overview.resource.email.imapHost).toBe('imap.example.com');
    expect(overview.resource.email.fromAddress).toBe('support@example.com');
  });

  it('projects connection state in adapter snapshots and keeps routing state consistent', async () => {
    const harness = createHarness();
    const service = harness.service();

    await service.updateRouting(
      {
        defaultQueueKey: 'support',
        queueHeaderKey: 'x-queue-support',
        defaultScope: 'admin_internal',
      },
      'qa',
    );

    await service.upsertConnectionState(
      'whatsapp_qr',
      {
        channelKey: 'whatsappQr',
        driver: 'whatsapp_qr',
        enabled: true,
        connectionState: 'connected',
        health: 'healthy',
        summary: 'Connected and synced',
        capabilities: {
          typing: true,
          reactions: true,
        },
        payload: {
          state: 'connected',
          connectedPhone: '+59800000000',
        },
        metadata: {
          observedBy: 'adapter:test',
        },
        observedAt: '2026-04-27T00:00:00.000Z',
      } as any,
      'adapter:test',
    );

    const overview = await service.getAdapterOverview();
    const whatsapp = overview.channels.whatsapp_qr;

    expect(overview.managedVersion).toBe(1);
    expect(harness.channelConnectionStateRepository.upsert).toHaveBeenCalledTimes(1);
    expect(whatsapp.route).toEqual({
      inboxKey: 'support',
      queueKey: 'support',
      scope: 'customer_public',
      queueHeaderKey: 'x-queue-support',
    });
    expect(whatsapp.connectionState).toMatchObject({
      channelKey: 'whatsappQr',
      driver: 'whatsapp_qr',
      enabled: true,
      connectionState: 'connected',
      health: 'healthy',
      summary: 'Connected and synced',
      metadata: expect.objectContaining({
        observedBy: 'adapter:test',
      }),
    });

    const snapshot = await service.getAdapterChannelSnapshot('whatsapp_qr');
    expect(snapshot.connectionState).toMatchObject({
      connectionState: 'connected',
      health: 'healthy',
    });
    expect(snapshot.route).toEqual({
      inboxKey: 'support',
      queueKey: 'support',
      scope: 'customer_public',
      queueHeaderKey: 'x-queue-support',
    });
  });
});
