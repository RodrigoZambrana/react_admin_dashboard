import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChannelConnectionState as ChannelConnectionStateRecord, Prisma } from '@prisma/client';

import { CriticalConfigService } from '../critical-config/critical-config.service';
import { ChannelConnectionStateRepository } from '../persistence/repositories/channel-connection-state.repository';
import {
  buildDefaultChannelControlResource,
  channelControlResourceSchema,
  channelConnectionStateSchema,
  ChannelConnectionState,
  ChannelControlResource,
  ChannelControlKey,
  EmailChannelControl,
  MetaChannelControl,
  SharedRoutingControl,
  toChannelAdapterKey,
  toChannelControlKey,
  WebchatChannelControl,
  WhatsappQrChannelControl,
} from './channel-control.types';
import { ChannelSecretStoreService } from './channel-secret-store.service';

@Injectable()
export class ChannelControlService {
  constructor(
    private readonly criticalConfigService: CriticalConfigService,
    private readonly channelConnectionStateRepository: ChannelConnectionStateRepository,
    private readonly channelSecretStoreService: ChannelSecretStoreService,
    private readonly configService: ConfigService,
  ) {}

  async getOverview() {
    const active = await this.criticalConfigService.getActiveConfig('channel_control');
    const value = active?.value ?? buildDefaultChannelControlResource();
    const connectionStates = await this.listConnectionStates();

    return {
      resource: value,
      connectionStates,
      managedVersion:
        active != null
          ? {
              id: active.id,
              key: active.key,
              version: active.version,
              status: active.status,
              createdAt: active.createdAt,
              createdBy: active.createdBy,
              metadata: active.metadata,
            }
          : null,
      extractionCoverage: {
        meta: 'modeled',
        whatsappQr: 'modeled',
        email: 'modeled',
        webchat: 'modeled',
        routing: 'modeled',
        connectionState: 'modeled',
        adapterCommandPlane: 'pending',
      },
    };
  }

  async getAdapterOverview() {
    const resource = await this.getCurrentValue();
    const active = await this.criticalConfigService.getActiveConfig('channel_control');
    const connectionStates = await this.listConnectionStates();

    return {
      managedVersion: active?.version ?? 0,
      channels: {
        meta: await this.buildAdapterChannelSnapshot('meta', resource, connectionStates),
        whatsapp_qr: await this.buildAdapterChannelSnapshot(
          'whatsappQr',
          resource,
          connectionStates,
        ),
        email: await this.buildAdapterChannelSnapshot('email', resource, connectionStates),
        webchat: await this.buildAdapterChannelSnapshot(
          'webchat',
          resource,
          connectionStates,
        ),
      },
    };
  }

  async getAdapterChannelSnapshot(channel: string) {
    const resource = await this.getCurrentValue();
    const connectionStates = await this.listConnectionStates();

    return this.buildAdapterChannelSnapshot(
      toChannelControlKey(channel),
      resource,
      connectionStates,
    );
  }

  async updateMeta(patch: Partial<MetaChannelControl>, createdBy?: string) {
    const current = await this.getCurrentValue();
    return this.persistNext(
      {
        ...current,
        meta: channelControlResourceSchema.shape.meta.parse({
          ...current.meta,
          ...patch,
          route: patch.route
            ? { ...current.meta.route, ...patch.route }
            : current.meta.route,
        }),
      },
      createdBy,
      'meta',
    );
  }

  async updateWhatsappQr(
    patch: Partial<WhatsappQrChannelControl>,
    createdBy?: string,
  ) {
    const current = await this.getCurrentValue();
    return this.persistNext(
      {
        ...current,
        whatsappQr: channelControlResourceSchema.shape.whatsappQr.parse({
          ...current.whatsappQr,
          ...patch,
          route: patch.route
            ? { ...current.whatsappQr.route, ...patch.route }
            : current.whatsappQr.route,
        }),
      },
      createdBy,
      'whatsapp_qr',
    );
  }

  async updateEmail(patch: Partial<EmailChannelControl>, createdBy?: string) {
    const current = await this.getCurrentValue();
    return this.persistNext(
      {
        ...current,
        email: channelControlResourceSchema.shape.email.parse({
          ...current.email,
          ...patch,
          route: patch.route
            ? { ...current.email.route, ...patch.route }
            : current.email.route,
        }),
      },
      createdBy,
      'email',
    );
  }

  async updateWebchat(
    patch: Partial<WebchatChannelControl>,
    createdBy?: string,
  ) {
    const current = await this.getCurrentValue();
    return this.persistNext(
      {
        ...current,
        webchat: channelControlResourceSchema.shape.webchat.parse({
          ...current.webchat,
          ...patch,
          route: patch.route
            ? { ...current.webchat.route, ...patch.route }
            : current.webchat.route,
        }),
      },
      createdBy,
      'webchat',
    );
  }

  async updateRouting(
    patch: Partial<SharedRoutingControl>,
    createdBy?: string,
  ) {
    const current = await this.getCurrentValue();
    return this.persistNext(
      {
        ...current,
        routing: channelControlResourceSchema.shape.routing.parse({
          ...current.routing,
          ...patch,
        }),
      },
      createdBy,
      'routing',
    );
  }

  async listConnectionStates(): Promise<Record<string, ChannelConnectionState>> {
    const records = await this.channelConnectionStateRepository.listAll();

    return Object.fromEntries(
      records.map((record: ChannelConnectionStateRecord) => {
        const channelKey = toChannelControlKey(record.channelKey);

        return [
          toChannelAdapterKey(channelKey),
          channelConnectionStateSchema.parse({
            channelKey,
            driver: record.driver,
            enabled: record.enabled,
            connectionState: record.connectionState,
            health: record.health,
            summary: record.summary ?? null,
            capabilities:
              record.capabilities && typeof record.capabilities === 'object'
                ? (record.capabilities as Record<string, boolean>)
                : {},
            payload:
              record.payload && typeof record.payload === 'object'
                ? (record.payload as Record<string, unknown>)
                : {},
            metadata:
              record.metadata && typeof record.metadata === 'object'
                ? (record.metadata as Record<string, unknown>)
                : {},
            observedAt: record.observedAt.toISOString(),
            createdAt: record.createdAt.toISOString(),
            updatedAt: record.updatedAt.toISOString(),
          }),
        ];
      }),
    );
  }

  async upsertConnectionState(
    channel: string,
    input: Omit<ChannelConnectionState, 'channelKey'>,
    observedBy?: string,
  ) {
    const channelKey = toChannelControlKey(channel);
    const parsed = channelConnectionStateSchema.parse({
      ...input,
      channelKey,
      metadata: {
        ...(input.metadata ?? {}),
        ...(observedBy ? { observedBy } : {}),
      },
    });

    const saved = await this.channelConnectionStateRepository.upsert({
      channelKey: toChannelAdapterKey(channelKey),
      driver: parsed.driver,
      enabled: parsed.enabled,
      connectionState: parsed.connectionState,
      health: parsed.health,
      summary: parsed.summary ?? null,
      capabilities: parsed.capabilities as Prisma.InputJsonValue,
      payload: parsed.payload as Prisma.InputJsonValue,
      metadata: parsed.metadata as Prisma.InputJsonValue,
      observedAt: new Date(parsed.observedAt),
    });

    return channelConnectionStateSchema.parse({
      channelKey,
      driver: saved.driver,
      enabled: saved.enabled,
      connectionState: saved.connectionState,
      health: saved.health,
      summary: saved.summary ?? null,
      capabilities:
        saved.capabilities && typeof saved.capabilities === 'object'
          ? (saved.capabilities as Record<string, boolean>)
          : {},
      payload:
        saved.payload && typeof saved.payload === 'object'
          ? (saved.payload as Record<string, unknown>)
          : {},
      metadata:
        saved.metadata && typeof saved.metadata === 'object'
          ? (saved.metadata as Record<string, unknown>)
          : {},
      observedAt: saved.observedAt.toISOString(),
      createdAt: saved.createdAt.toISOString(),
      updatedAt: saved.updatedAt.toISOString(),
    });
  }

  private async getCurrentValue(): Promise<ChannelControlResource> {
    const active = await this.criticalConfigService.getActiveConfig('channel_control');
    return active?.value ?? buildDefaultChannelControlResource();
  }

  private async persistNext(
    next: ChannelControlResource,
    createdBy: string | undefined,
    section: string,
  ) {
    const value = channelControlResourceSchema.parse(next);
    const created = await this.criticalConfigService.createVersion({
      key: 'channel_control',
      value,
      createdBy,
      activate: true,
    });

    return {
      created,
      section,
      resource: value,
    };
  }

  private async buildAdapterChannelSnapshot(
    channelKey: ChannelControlKey,
    resource: ChannelControlResource,
    connectionStates: Record<string, ChannelConnectionState>,
  ) {
    const adapterKey = toChannelAdapterKey(channelKey);
    const route = this.resolveRoute(channelKey, resource);

    if (channelKey === 'meta') {
      const config = resource.meta;
      return {
        channelKey: adapterKey,
        route,
        config,
        resolvedSecrets: {
          verifyToken: await this.resolveSecretRef(config.verifyTokenRef),
          appSecret: await this.resolveSecretRef(config.appSecretRef),
          pageAccessToken: await this.resolveSecretRef(config.pageAccessTokenRef),
          messengerPageAccessToken: await this.resolveSecretRef(
            config.messengerPageAccessTokenRef,
          ),
          instagramAccessToken: await this.resolveSecretRef(
            config.instagramAccessTokenRef,
          ),
        },
        connectionState: connectionStates[adapterKey] ?? null,
      };
    }

    if (channelKey === 'whatsappQr') {
      return {
        channelKey: adapterKey,
        route,
        config: resource.whatsappQr,
        connectionState: connectionStates[adapterKey] ?? null,
      };
    }

    if (channelKey === 'email') {
      const config = resource.email;
      return {
        channelKey: adapterKey,
        route,
        config,
        resolvedSecrets: {
          username: await this.resolveSecretRef(config.usernameRef),
          password: await this.resolveSecretRef(config.passwordRef),
        },
        connectionState: connectionStates[adapterKey] ?? null,
      };
    }

    return {
      channelKey: adapterKey,
      route,
      config: resource.webchat,
      connectionState: connectionStates[adapterKey] ?? null,
    };
  }

  private resolveRoute(
    channelKey: ChannelControlKey,
    resource: ChannelControlResource,
  ) {
    const base =
      channelKey === 'meta'
        ? resource.meta.route
        : channelKey === 'whatsappQr'
          ? resource.whatsappQr.route
          : channelKey === 'email'
            ? resource.email.route
            : resource.webchat.route;

    return {
      inboxKey: base.inboxKey ?? resource.routing.defaultQueueKey ?? null,
      queueKey: base.queueKey ?? resource.routing.defaultQueueKey ?? null,
      scope: base.scope ?? resource.routing.defaultScope,
      queueHeaderKey: resource.routing.queueHeaderKey,
    };
  }

  private async resolveSecretRef(
    secretRef: { strategy: 'local' | 'env'; ref: string } | null | undefined,
  ) {
    if (!secretRef) {
      return null;
    }

    if (secretRef.strategy === 'env') {
      return this.configService.get<string>(secretRef.ref)?.trim() || null;
    }

    return this.channelSecretStoreService.resolveSecretRef(secretRef);
  }
}
