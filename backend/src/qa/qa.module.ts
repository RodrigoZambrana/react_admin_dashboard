import { Module } from '@nestjs/common'
import { QaController } from './qa.controller'
import { QaResultsService } from './qa-results.service'

@Module({
  controllers: [QaController],
  providers: [QaResultsService],
})
export class QaModule {}
