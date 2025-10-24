import { Injectable, Logger } from '@nestjs/common'
import { InboxChannelType } from '@prisma/client'
import { ChannelAdapter } from '../types/channel-adapter'

@Injectable()
export class ChannelRegistry {
  private readonly logger = new Logger(ChannelRegistry.name)
  private readonly adapters = new Map<InboxChannelType, ChannelAdapter>()

  register(adapter: ChannelAdapter) {
    if (this.adapters.has(adapter.type)) {
      this.logger.warn(
        `Replacing channel adapter for ${adapter.type}. Check duplicate providers.`,
      )
    }
    this.adapters.set(adapter.type, adapter)
  }

  getAdapter(type: InboxChannelType): ChannelAdapter {
    const adapter = this.adapters.get(type)
    if (!adapter) {
      throw new Error(
        `No channel adapter registered for ${type}. Ensure providers are configured.`,
      )
    }
    return adapter
  }

  listAdapters(): ChannelAdapter[] {
    return Array.from(this.adapters.values())
  }
}
