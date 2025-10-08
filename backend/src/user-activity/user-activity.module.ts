import { Module } from '@nestjs/common'
import { UserActivityService } from './user-activity.service'

@Module({
  providers: [UserActivityService],
  exports: [UserActivityService],
})
export class UserActivityModule {}
