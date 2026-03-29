import { Module } from '@nestjs/common'
import { CmsController } from './cms.controller'
import { CmsService } from './cms.service'
import { CmsPagesService } from './cms-pages.service'

@Module({
  controllers: [CmsController],
  providers: [CmsService, CmsPagesService],
  exports: [CmsService, CmsPagesService],
})
export class CmsModule {}
