import { Module } from '@nestjs/common';

import { CriticalConfigModule } from '../critical-config/critical-config.module';
import { ChannelAdapterAdminClient } from './channel-adapter-admin.client';
import { ChannelControlController } from './channel-control.controller';
import { ChannelControlInternalController } from './channel-control-internal.controller';
import { ChannelSettingsController } from './channel-settings.controller';
import { ChannelSettingsService } from './channel-settings.service';
import { ChannelSecretStoreService } from './channel-secret-store.service';
import { ChannelControlService } from './channel-control.service';

@Module({
  imports: [CriticalConfigModule],
  controllers: [
    ChannelControlController,
    ChannelControlInternalController,
    ChannelSettingsController,
  ],
  providers: [
    ChannelControlService,
    ChannelAdapterAdminClient,
    ChannelSettingsService,
    ChannelSecretStoreService,
  ],
  exports: [ChannelControlService],
})
export class ChannelControlModule {}
