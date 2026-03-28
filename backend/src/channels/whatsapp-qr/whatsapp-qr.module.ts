import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { PrismaModule } from '../../prisma/prisma.module'
import { SecureConfigModule } from '../../common/security/secure-config.module'
import { WhatsappQrController } from './whatsapp-qr.controller'
import { WhatsappQrService } from './whatsapp-qr.service'

@Module({
  imports: [ConfigModule, PrismaModule, SecureConfigModule],
  controllers: [WhatsappQrController],
  providers: [WhatsappQrService],
  exports: [WhatsappQrService],
})
export class WhatsappQrModule {}
