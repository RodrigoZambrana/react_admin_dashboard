import { Module } from '@nestjs/common'
import { PrismaModule } from '../prisma/prisma.module'
import { CloudinaryController } from './cloudinary.controller'
import { CloudinarySignService } from './cloudinary-sign.service'

@Module({
  imports: [PrismaModule],
  controllers: [CloudinaryController],
  providers: [CloudinarySignService],
  exports: [CloudinarySignService],
})
export class CloudinaryModule {}
