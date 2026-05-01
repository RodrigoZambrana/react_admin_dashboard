import { Module } from '@nestjs/common'
import { MediaController } from './media.controller'
import { PrismaModule } from '../prisma/prisma.module'

@Module({
  imports: [PrismaModule],
  controllers: [MediaController],
})
export class MediaModule {}
