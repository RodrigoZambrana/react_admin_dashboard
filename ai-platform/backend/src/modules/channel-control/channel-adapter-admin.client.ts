import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

type RequestOptions = {
  method?: 'GET' | 'POST';
  body?: unknown;
};

@Injectable()
export class ChannelAdapterAdminClient {
  constructor(private readonly configService: ConfigService) {}

  async getMetaStatus() {
    return this.requestJson('/channels/meta/status');
  }

  async getWhatsappQrStatus() {
    return this.requestJson('/channels/whatsapp-qr/status');
  }

  async startWhatsappQrSession() {
    return this.requestJson('/channels/whatsapp-qr/session/start', {
      method: 'POST',
    });
  }

  async stopWhatsappQrSession() {
    return this.requestJson('/channels/whatsapp-qr/session/stop', {
      method: 'POST',
    });
  }

  async reconnectWhatsappQrSession() {
    return this.requestJson('/channels/whatsapp-qr/session/reconnect', {
      method: 'POST',
    });
  }

  async resetWhatsappQrSession() {
    return this.requestJson('/channels/whatsapp-qr/session/reset', {
      method: 'POST',
    });
  }

  async backfillWhatsappQrHistory() {
    return this.requestJson('/channels/whatsapp-qr/backfill', {
      method: 'POST',
      body: {},
    });
  }

  private async requestJson(path: string, options: RequestOptions = {}) {
    const response = await fetch(`${this.getBaseUrl()}${path}`, {
      method: options.method ?? 'GET',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        'x-ai-internal-token': this.getInternalToken(),
      },
      body:
        options.body === undefined ? undefined : JSON.stringify(options.body),
    });

    if (!response.ok) {
      throw new Error(
        `channel-adapter ${options.method ?? 'GET'} ${path} failed with ${response.status}`,
      );
    }

    return response.json();
  }

  private getBaseUrl() {
    const explicit = this.configService
      .get<string>('CHANNEL_ADAPTER_BASE_URL')
      ?.trim();

    return explicit && explicit.length > 0
      ? explicit.replace(/\/$/, '')
      : 'http://localhost:4200';
  }

  private getInternalToken() {
    return (
      this.configService.get<string>('AI_INTERNAL_TOKEN')?.trim() ||
      'local-ai-internal-token'
    );
  }
}
