import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler'
import { APP_GUARD } from '@nestjs/core'
import { PrismaModule } from './prisma/prisma.module'
import { AuthModule } from './auth/auth.module'
import { UsersModule } from './users/users.module'
import { CrmModule } from './crm/crm.module'
import { SalesModule } from './sales/sales.module'
import { SettingsModule } from './settings/settings.module'
import { ExpensesModule } from './expenses/expenses.module'
import { AccountModule } from './account/account.module'
import { ProjectModule } from './project/project.module'
import { RolesGuard } from './auth/roles.guard'
import { CalendarModule } from './calendar/calendar.module'
import { TasksModule } from './tasks/tasks.module'
import { NotificationModule } from './notification/notification.module'
import { HealthModule } from './health/health.module'

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([
      {
        ttl: 60_000,
        limit: 120,
      },
    ]),
    PrismaModule,
    AuthModule,
    UsersModule,
    CrmModule,
    SalesModule,
    SettingsModule,
    ExpensesModule,
    AccountModule,
    ProjectModule,
    CalendarModule,
    TasksModule,
    NotificationModule,
    HealthModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
})
export class AppModule {}
