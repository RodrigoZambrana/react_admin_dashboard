import { Injectable } from '@nestjs/common';

import { CriticalConfigService } from '../critical-config/critical-config.service';
import { ChannelControlService } from './channel-control.service';
import {
  ChannelConnectionState,
  MetaChannelControl,
  WhatsappQrChannelControl,
} from './channel-control.types';
import { ChannelAdapterAdminClient } from './channel-adapter-admin.client';
import { UpdateMetaChannelSettingsDto } from './dto/update-meta-channel-settings.dto';
import { UpdateWhatsappQrChannelControlDto } from './dto/update-whatsapp-qr-channel-control.dto';
import { UpdateEmailInboxSettingsDto } from './dto/update-email-inbox-settings.dto';
import { ChannelSecretStoreService } from './channel-secret-store.service';

type MetaStatusShape = {
  driver: string;
  enabled: boolean;
  messengerEnabled: boolean;
  instagramEnabled: boolean;
  appId: string | null;
  graphVersion: string;
  graphBaseUrl: string;
  publicBaseUrl: string | null;
  publicWebhookUrl: string | null;
  verifyTokenPresent: boolean;
  appSecretPresent: boolean;
  webhookVerificationReady: boolean;
  signatureValidationReady: boolean;
  webhookInboundReady: boolean;
  messenger: {
    enabled: boolean;
    pageId: string | null;
    pageAccessTokenPresent: boolean;
    outboundReady: boolean;
  };
  instagram: {
    enabled: boolean;
    businessAccountId: string | null;
    accessTokenPresent: boolean;
    outboundReady: boolean;
  };
  capabilities: {
    text: boolean;
    attachments: boolean;
    postbacks: boolean;
    quickReplies: boolean;
  };
};

type WhatsappQrStatusShape = {
  enabled: boolean;
  state: string;
  driver: string;
  qrCodeDataUrl: string | null;
  qrCodeExpiresAt: string | null;
  connectedPhone: string | null;
  connectedAt: string | null;
  lastDisconnectAt: string | null;
  lastError: string | null;
  reconnectScheduledAt: string | null;
  outboundCounters?: {
    lastHour: number;
    lastDay: number;
  } | null;
  capabilities?: {
    typing: boolean;
    reactions: boolean;
    presence: boolean;
    media: boolean;
  } | null;
  history?: {
    knownChatsCount: number;
    bufferedMessagesCount: number;
    lastBackfillResult?: {
      importedMessages: number;
      importedConversations: number;
      duplicateMessages: number;
      skippedMessages: number;
      authBootstrapCandidates: number;
      bootstrappedFromAuth: number;
      completedAt?: string | null;
    } | null;
  } | null;
};

@Injectable()
export class ChannelSettingsService {
  constructor(
    private readonly channelControlService: ChannelControlService,
    private readonly channelAdapterAdminClient: ChannelAdapterAdminClient,
    private readonly criticalConfigService: CriticalConfigService,
    private readonly channelSecretStoreService: ChannelSecretStoreService,
  ) {}

  async getMetaOverview() {
    const overview = await this.channelControlService.getOverview();
    const config = overview.resource.meta;
    const connectionState = this.resolveConnectionState(
      overview.connectionStates?.meta,
    );
    const status = await this.resolveMetaStatus(config, connectionState);

    return {
      config: {
        enabled: config.enabled,
        messengerEnabled: config.messengerEnabled,
        instagramEnabled: config.instagramEnabled,
        publicBaseUrl: config.publicBaseUrl,
        pageId: config.pageId,
        instagramBusinessAccountId: config.instagramBusinessAccountId,
        appId: config.appId,
        verifyToken: null,
        appSecret: null,
        pageAccessToken: null,
        messengerPageAccessToken: null,
        instagramAccessToken: null,
      },
      meta: {
        source: overview.managedVersion ? 'database' : 'environment',
        updatedAt: overview.managedVersion?.createdAt ?? null,
      },
      status,
      inboxAccounts: {
        messenger: config.messengerEnabled
          ? {
              id: `meta:messenger:${config.pageId || 'default'}`,
              displayName: 'Messenger',
              address: config.pageId,
              active: config.enabled && config.messengerEnabled,
              metadata: { transport: 'meta_messenger' },
            }
          : null,
        instagram: config.instagramEnabled
          ? {
              id: `meta:instagram:${config.instagramBusinessAccountId || 'default'}`,
              displayName: 'Instagram',
              address: config.instagramBusinessAccountId,
              active: config.enabled && config.instagramEnabled,
              metadata: { transport: 'meta_instagram' },
            }
          : null,
      },
      consistency: {
        adapterReachable: status.driver !== 'unreachable',
        messengerInboxPresent: config.messengerEnabled,
        instagramInboxPresent: config.instagramEnabled,
        messengerInboxActiveMatchesConfig: true,
        instagramInboxActiveMatchesConfig: true,
        messengerInboxAddressMatchesConfig: true,
        instagramInboxAddressMatchesConfig: true,
        messengerInboxTransportMatches: true,
        instagramInboxTransportMatches: true,
      },
    };
  }

  async updateMetaConfig(input: UpdateMetaChannelSettingsDto) {
    const [
      verifyTokenRef,
      appSecretRef,
      pageAccessTokenRef,
      messengerPageAccessTokenRef,
      instagramAccessTokenRef,
    ] = await Promise.all([
      this.toLocalSecretRef('meta.verify_token', input.verifyToken),
      this.toLocalSecretRef('meta.app_secret', input.appSecret),
      this.toLocalSecretRef('meta.page_access_token', input.pageAccessToken),
      this.toLocalSecretRef(
        'meta.messenger_page_access_token',
        input.messengerPageAccessToken,
      ),
      this.toLocalSecretRef(
        'meta.instagram_access_token',
        input.instagramAccessToken,
      ),
    ]);

    await this.channelControlService.updateMeta(
      {
        enabled: input.enabled,
        messengerEnabled: input.messengerEnabled,
        instagramEnabled: input.instagramEnabled,
        publicBaseUrl: input.publicBaseUrl,
        pageId: input.pageId,
        instagramBusinessAccountId: input.instagramBusinessAccountId,
        appId: input.appId,
        verifyTokenRef,
        appSecretRef,
        pageAccessTokenRef,
        messengerPageAccessTokenRef,
        instagramAccessTokenRef,
      },
      'settings:channels:meta',
    );

    return this.getMetaOverview();
  }

  async syncMetaConfig() {
    try {
      await this.channelAdapterAdminClient.getMetaStatus();
    } catch {
      // The overview builder already falls back to the latest projected state.
    }

    return this.getMetaOverview();
  }

  async getWhatsappQrOverview() {
    const overview = await this.channelControlService.getOverview();
    const config = overview.resource.whatsappQr;
    const connectionState = this.resolveConnectionState(
      overview.connectionStates?.whatsapp_qr,
    );
    const status = await this.resolveWhatsappQrStatus(config, connectionState);

    return {
      config,
      status,
      inboxAccount: {
        id: `whatsapp_qr:${config.address || 'default'}`,
        displayName: config.displayName,
        address: status.connectedPhone || config.address,
        active: config.enabled,
        metadata: {
          transport: 'whatsapp_qr',
        },
      },
      consistency: {
        inboxAccountPresent: true,
        channel: 'whatsapp',
        transport: 'qr',
        adapterReachable: status.state !== 'unreachable',
        adapterEnabledMatchesConfig: status.enabled === config.enabled,
        inboxActiveMatchesConfig: true,
        inboxAddressMatchesConfig: true,
        inboxTransportMatches: true,
      },
    };
  }

  async updateWhatsappQrConfig(input: UpdateWhatsappQrChannelControlDto) {
    await this.channelControlService.updateWhatsappQr(
      {
        enabled: input.enabled,
        displayName: input.displayName ?? undefined,
        address: input.address ?? undefined,
        autoStart: input.autoStart,
        typingIndicatorEnabled: input.typingIndicatorEnabled,
        presenceIndicatorEnabled: input.presenceIndicatorEnabled,
        humanDelayEnabled: input.humanDelayEnabled,
        minReplyDelayMs: input.minReplyDelayMs ?? undefined,
        maxReplyDelayMs: input.maxReplyDelayMs ?? undefined,
        maxOutboundPerHour: input.maxOutboundPerHour ?? undefined,
        maxOutboundPerDay: input.maxOutboundPerDay ?? undefined,
        reactionsEnabled: input.reactionsEnabled,
        readReceiptsEnabled: input.readReceiptsEnabled,
        allowProactiveOutbound: input.allowProactiveOutbound,
        quietHoursStart: input.quietHoursStart ?? undefined,
        quietHoursEnd: input.quietHoursEnd ?? undefined,
      },
      'settings:channels:whatsapp-qr',
    );

    return this.getWhatsappQrOverview();
  }

  async startWhatsappQrSession() {
    await this.channelAdapterAdminClient.startWhatsappQrSession();
    return this.getWhatsappQrOverview();
  }

  async stopWhatsappQrSession() {
    await this.channelAdapterAdminClient.stopWhatsappQrSession();
    return this.getWhatsappQrOverview();
  }

  async reconnectWhatsappQrSession() {
    await this.channelAdapterAdminClient.reconnectWhatsappQrSession();
    return this.getWhatsappQrOverview();
  }

  async resetWhatsappQrSession() {
    await this.channelAdapterAdminClient.resetWhatsappQrSession();
    return this.getWhatsappQrOverview();
  }

  async syncWhatsappQrConfig() {
    try {
      await this.channelAdapterAdminClient.getWhatsappQrStatus();
    } catch {
      // The overview builder already falls back to the latest projected state.
    }

    return this.getWhatsappQrOverview();
  }

  async backfillWhatsappQrHistory() {
    const backfill = await this.channelAdapterAdminClient.backfillWhatsappQrHistory();
    return {
      overview: await this.getWhatsappQrOverview(),
      backfill,
      cleanup: {
        deletedConversations: 0,
        deletedInboxAccounts: 0,
      },
    };
  }

  async getEmailInboxConfig() {
    const overview = await this.channelControlService.getOverview();
    const config = overview.resource.email;

    return {
      source: overview.managedVersion ? 'database' : 'environment',
      updatedAt: overview.managedVersion?.createdAt ?? null,
      imapHost: config.imapHost ?? '',
      imapPort: config.imapPort ?? 993,
      imapSecurity: config.imapSecurity,
      smtpHost: config.smtpHost ?? '',
      smtpPort: config.smtpPort ?? 587,
      smtpSecurity: config.smtpSecurity,
      username: this.resolveSecretValue(config.usernameRef) ?? '',
      fromAddress: config.fromAddress ?? '',
      fromName: config.fromName ?? null,
      maxAttachmentSizeMb: config.maxAttachmentSizeMb,
      ratePerMinute: config.ratePerMinute,
      pollIntervalMs: config.pollIntervalMs,
      pollBatchSize: config.pollBatchSize,
      passwordSet: Boolean(config.passwordRef?.ref),
    };
  }

  async updateEmailInboxConfig(input: UpdateEmailInboxSettingsDto) {
    const [usernameRef, passwordRef] = await Promise.all([
      input.username === undefined
        ? undefined
        : this.toLocalSecretRef('email.username', input.username),
      input.password === undefined
        ? undefined
        : this.toLocalSecretRef('email.password', input.password),
    ]);

    await this.channelControlService.updateEmail(
      {
        imapHost: input.imapHost ?? undefined,
        imapPort: input.imapPort ?? undefined,
        imapSecurity: input.imapSecurity ?? undefined,
        smtpHost: input.smtpHost ?? undefined,
        smtpPort: input.smtpPort ?? undefined,
        smtpSecurity: input.smtpSecurity ?? undefined,
        usernameRef,
        passwordRef,
        fromAddress: input.fromAddress ?? undefined,
        fromName: input.fromName ?? undefined,
        maxAttachmentSizeMb: input.maxAttachmentSizeMb ?? undefined,
        ratePerMinute: input.ratePerMinute ?? undefined,
        pollIntervalMs: input.pollIntervalMs ?? undefined,
        pollBatchSize: input.pollBatchSize ?? undefined,
      },
      'settings:channels:email',
    );

    return this.getEmailInboxConfig();
  }

  private async resolveMetaStatus(
    config: MetaChannelControl,
    projectedState: ChannelConnectionState | null,
  ): Promise<MetaStatusShape> {
    const adapterStatus = await this.tryGetMetaAdapterStatus();
    const payload =
      projectedState?.payload && typeof projectedState.payload === 'object'
        ? (projectedState.payload as Partial<MetaStatusShape>)
        : null;
    const verifyTokenPresent = Boolean(config.verifyTokenRef?.ref);
    const appSecretPresent = Boolean(config.appSecretRef?.ref);
    const messengerTokenPresent = Boolean(
      config.pageAccessTokenRef?.ref || config.messengerPageAccessTokenRef?.ref,
    );
    const instagramTokenPresent = Boolean(
      config.instagramAccessTokenRef?.ref || config.pageAccessTokenRef?.ref,
    );
    const publicWebhookUrl = config.publicBaseUrl
      ? `${config.publicBaseUrl.replace(/\/$/, '')}/webhooks/meta`
      : null;

    return {
      driver:
        adapterStatus?.driver || payload?.driver || projectedState?.driver || 'unreachable',
      enabled: adapterStatus?.enabled ?? payload?.enabled ?? config.enabled,
      messengerEnabled:
        adapterStatus?.messengerEnabled ??
        payload?.messengerEnabled ??
        config.messengerEnabled,
      instagramEnabled:
        adapterStatus?.instagramEnabled ??
        payload?.instagramEnabled ??
        config.instagramEnabled,
      appId: adapterStatus?.appId ?? payload?.appId ?? config.appId,
      graphVersion:
        adapterStatus?.graphVersion ?? payload?.graphVersion ?? 'v23.0',
      graphBaseUrl:
        adapterStatus?.graphBaseUrl ??
        payload?.graphBaseUrl ??
        'https://graph.facebook.com',
      publicBaseUrl:
        adapterStatus?.publicBaseUrl ??
        payload?.publicBaseUrl ??
        config.publicBaseUrl,
      publicWebhookUrl:
        adapterStatus?.publicWebhookUrl ??
        payload?.publicWebhookUrl ??
        publicWebhookUrl,
      verifyTokenPresent:
        adapterStatus?.verifyTokenPresent ??
        payload?.verifyTokenPresent ??
        verifyTokenPresent,
      appSecretPresent:
        adapterStatus?.appSecretPresent ??
        payload?.appSecretPresent ??
        appSecretPresent,
      webhookVerificationReady:
        adapterStatus?.webhookVerificationReady ??
        payload?.webhookVerificationReady ??
        Boolean(publicWebhookUrl && verifyTokenPresent),
      signatureValidationReady:
        adapterStatus?.signatureValidationReady ??
        payload?.signatureValidationReady ??
        appSecretPresent,
      webhookInboundReady:
        adapterStatus?.webhookInboundReady ??
        payload?.webhookInboundReady ??
        Boolean(publicWebhookUrl && verifyTokenPresent && appSecretPresent),
      messenger: {
        enabled:
          adapterStatus?.messenger?.enabled ??
          payload?.messenger?.enabled ??
          config.messengerEnabled,
        pageId:
          adapterStatus?.messenger?.pageId ??
          payload?.messenger?.pageId ??
          config.pageId,
        pageAccessTokenPresent:
          adapterStatus?.messenger?.pageAccessTokenPresent ??
          payload?.messenger?.pageAccessTokenPresent ??
          messengerTokenPresent,
        outboundReady:
          adapterStatus?.messenger?.outboundReady ??
          payload?.messenger?.outboundReady ??
          Boolean(config.messengerEnabled && config.pageId && messengerTokenPresent),
      },
      instagram: {
        enabled:
          adapterStatus?.instagram?.enabled ??
          payload?.instagram?.enabled ??
          config.instagramEnabled,
        businessAccountId:
          adapterStatus?.instagram?.businessAccountId ??
          payload?.instagram?.businessAccountId ??
          config.instagramBusinessAccountId,
        accessTokenPresent:
          adapterStatus?.instagram?.accessTokenPresent ??
          payload?.instagram?.accessTokenPresent ??
          instagramTokenPresent,
        outboundReady:
          adapterStatus?.instagram?.outboundReady ??
          payload?.instagram?.outboundReady ??
          Boolean(
            config.instagramEnabled &&
              config.instagramBusinessAccountId &&
              instagramTokenPresent,
          ),
      },
      capabilities: {
        text: adapterStatus?.capabilities?.text ?? payload?.capabilities?.text ?? true,
        attachments:
          adapterStatus?.capabilities?.attachments ??
          payload?.capabilities?.attachments ??
          true,
        postbacks:
          adapterStatus?.capabilities?.postbacks ??
          payload?.capabilities?.postbacks ??
          true,
        quickReplies:
          adapterStatus?.capabilities?.quickReplies ??
          payload?.capabilities?.quickReplies ??
          true,
      },
    };
  }

  private async resolveWhatsappQrStatus(
    config: WhatsappQrChannelControl,
    projectedState: ChannelConnectionState | null,
  ): Promise<WhatsappQrStatusShape> {
    const adapterStatus = await this.tryGetWhatsappQrAdapterStatus();
    const payload =
      projectedState?.payload && typeof projectedState.payload === 'object'
        ? (projectedState.payload as Partial<WhatsappQrStatusShape>)
        : null;

    return {
      enabled: adapterStatus?.enabled ?? payload?.enabled ?? config.enabled,
      state:
        adapterStatus?.state ??
        payload?.state ??
        projectedState?.connectionState ??
        (config.enabled ? 'idle' : 'disabled'),
      driver:
        adapterStatus?.driver ?? payload?.driver ?? projectedState?.driver ?? 'whatsapp_qr',
      qrCodeDataUrl:
        adapterStatus?.qrCodeDataUrl ?? payload?.qrCodeDataUrl ?? null,
      qrCodeExpiresAt:
        adapterStatus?.qrCodeExpiresAt ?? payload?.qrCodeExpiresAt ?? null,
      connectedPhone:
        adapterStatus?.connectedPhone ??
        payload?.connectedPhone ??
        config.address ??
        null,
      connectedAt:
        adapterStatus?.connectedAt ?? payload?.connectedAt ?? null,
      lastDisconnectAt:
        adapterStatus?.lastDisconnectAt ?? payload?.lastDisconnectAt ?? null,
      lastError: adapterStatus?.lastError ?? payload?.lastError ?? null,
      reconnectScheduledAt:
        adapterStatus?.reconnectScheduledAt ??
        payload?.reconnectScheduledAt ??
        null,
      outboundCounters:
        adapterStatus?.outboundCounters ?? payload?.outboundCounters ?? null,
      capabilities:
        adapterStatus?.capabilities ??
        payload?.capabilities ?? {
          typing: config.typingIndicatorEnabled,
          reactions: config.reactionsEnabled,
          presence: config.presenceIndicatorEnabled,
          media: true,
        },
      history: adapterStatus?.history ?? payload?.history ?? null,
    };
  }

  private async tryGetMetaAdapterStatus() {
    try {
      return (await this.channelAdapterAdminClient.getMetaStatus()) as MetaStatusShape;
    } catch {
      return null;
    }
  }

  private async tryGetWhatsappQrAdapterStatus() {
    try {
      return (await this.channelAdapterAdminClient.getWhatsappQrStatus()) as WhatsappQrStatusShape;
    } catch {
      return null;
    }
  }

  private resolveConnectionState(
    state: ChannelConnectionState | null | undefined,
  ) {
    return state ?? null;
  }

  private toLocalSecretRef(key: string, value: string | null | undefined) {
    return this.channelSecretStoreService.storeLocalSecret({
      key,
      value,
      label: key,
    });
  }

  private resolveSecretValue(secretRef: { ref: string } | null | undefined) {
    if (!secretRef) {
      return null;
    }

    return secretRef.ref.startsWith('local:') ? '' : String(secretRef.ref || '').trim();
  }
}
