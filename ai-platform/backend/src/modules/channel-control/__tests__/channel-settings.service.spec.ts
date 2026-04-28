import { ChannelSettingsService } from '../channel-settings.service';

function createService() {
  const channelControlService = {
    getOverview: jest.fn(),
  } as any;
  const channelAdapterAdminClient = {
    getMetaStatus: jest.fn().mockRejectedValue(new Error('offline')),
    getWhatsappQrStatus: jest.fn().mockRejectedValue(new Error('offline')),
  } as any;
  const criticalConfigService = {} as any;
  const channelSecretStoreService = {
    resolveSecretRef: jest.fn(),
  } as any;

  return {
    service: new ChannelSettingsService(
      channelControlService,
      channelAdapterAdminClient,
      criticalConfigService,
      channelSecretStoreService,
    ),
    channelControlService,
  };
}

describe('ChannelSettingsService', () => {
  it('does not expose email password secrets in inbox config responses', async () => {
    const { service, channelControlService } = createService();
    channelControlService.getOverview.mockResolvedValue({
      managedVersion: { createdAt: new Date('2026-04-27T00:00:00.000Z') },
      resource: {
        email: {
          imapHost: 'imap.example.com',
          imapPort: 993,
          imapSecurity: 'SSL_TLS',
          smtpHost: 'smtp.example.com',
          smtpPort: 587,
          smtpSecurity: 'STARTTLS',
          usernameRef: { strategy: 'local', ref: 'local:email.username' },
          fromAddress: 'support@example.com',
          fromName: 'Support',
          maxAttachmentSizeMb: 25,
          ratePerMinute: 60,
          pollIntervalMs: 30000,
          pollBatchSize: 20,
          passwordRef: { strategy: 'local', ref: 'local:email.password' },
        },
        meta: {},
        whatsappQr: {},
        webchat: {},
      },
      connectionStates: {},
    });

    const response = await service.getEmailInboxConfig();

    expect(response.passwordSet).toBe(true);
    expect((response as Record<string, unknown>).password).toBeUndefined();
    expect(response.username).toBe('');
  });

  it('redacts meta secrets in overview payloads', async () => {
    const { service, channelControlService } = createService();
    channelControlService.getOverview.mockResolvedValue({
      managedVersion: { createdAt: new Date('2026-04-27T00:00:00.000Z') },
      resource: {
        meta: {
          enabled: true,
          messengerEnabled: true,
          instagramEnabled: true,
          publicBaseUrl: 'https://example.com',
          pageId: 'page-1',
          instagramBusinessAccountId: 'ig-1',
          appId: 'app-1',
          verifyTokenRef: { strategy: 'local', ref: 'local:meta.verify' },
          appSecretRef: { strategy: 'local', ref: 'local:meta.secret' },
          pageAccessTokenRef: { strategy: 'local', ref: 'local:meta.page' },
          messengerPageAccessTokenRef: { strategy: 'local', ref: 'local:meta.messenger' },
          instagramAccessTokenRef: { strategy: 'local', ref: 'local:meta.instagram' },
          route: null,
        },
        email: {},
        whatsappQr: {},
        webchat: {},
      },
      connectionStates: {},
    });

    const response = await service.getMetaOverview();

    expect(response.config.verifyToken).toBeNull();
    expect(response.config.appSecret).toBeNull();
    expect(response.config.pageAccessToken).toBeNull();
    expect(response.config.messengerPageAccessToken).toBeNull();
    expect(response.config.instagramAccessToken).toBeNull();
  });
});
