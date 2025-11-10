import { Module } from '@nestjs/common'
import { StorefrontModule } from '../storefront/storefront.module'
import { SettingsController } from './settings.controller'
@Module({ imports: [StorefrontModule], controllers: [SettingsController] })
export class SettingsModule {}
