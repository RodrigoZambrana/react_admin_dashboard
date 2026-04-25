import { Injectable } from '@nestjs/common';

import { ChannelSecretRepository } from '../persistence/repositories/channel-secret.repository';
import type { ChannelSecretRef } from './channel-control.types';

@Injectable()
export class ChannelSecretStoreService {
  constructor(private readonly channelSecretRepository: ChannelSecretRepository) {}

  async storeLocalSecret(input: {
    key: string;
    value?: string | null;
    label?: string | null;
  }): Promise<ChannelSecretRef | null | undefined> {
    if (input.value === undefined) {
      return undefined;
    }

    const value = input.value?.trim();

    if (!value) {
      return null;
    }

    const key = this.toLocalKey(input.key);
    await this.channelSecretRepository.upsert({
      key,
      value,
      label: input.label ?? key,
    });

    return {
      strategy: 'local',
      ref: key,
    };
  }

  async resolveSecretRef(secretRef: ChannelSecretRef | null | undefined) {
    if (!secretRef) {
      return null;
    }

    if (secretRef.strategy === 'local') {
      const secret = await this.channelSecretRepository.findByKey(secretRef.ref);
      return secret?.value?.trim() || null;
    }

    return null;
  }

  private toLocalKey(key: string) {
    const normalized = key
      .trim()
      .replace(/[^a-zA-Z0-9_.:-]+/g, '_')
      .replace(/^_+|_+$/g, '');

    return normalized.startsWith('local:') ? normalized : `local:${normalized}`;
  }
}
