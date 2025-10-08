import { Module } from '@nestjs/common'
import { AccountController } from './account.controller'
import { UserActivityModule } from '../user-activity/user-activity.module'

@Module({
  imports: [UserActivityModule],
  controllers: [AccountController],
})
export class AccountModule {}
