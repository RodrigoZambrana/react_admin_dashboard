import { Module } from '@nestjs/common'
import { CmsModule } from '../cms/cms.module'
import { PrismaModule } from '../prisma/prisma.module'
import { StoriesController } from './stories.controller'
import { StoriesService } from './stories.service'

@Module({
  imports: [PrismaModule, CmsModule],
  controllers: [StoriesController],
  providers: [StoriesService],
  exports: [StoriesService],
})
export class StoriesModule {}
