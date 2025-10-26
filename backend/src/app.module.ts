import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler'
import { APP_GUARD } from '@nestjs/core'
import { PrismaModule } from './prisma/prisma.module'
import { AuthModule } from './auth/auth.module'
import { UsersModule } from './users/users.module'
import { CustomersModule } from './customers/customers.module'
import { SalesModule } from './sales/sales.module'
import { SettingsModule } from './settings/settings.module'
import { ExpensesModule } from './expenses/expenses.module'
import { AccountModule } from './account/account.module'
import { AccountingModule } from './accounting/accounting.module'
import { ProjectModule } from './project/project.module'
import { OrdersModule } from './orders/orders.module'
import { CalendarModule } from './calendar/calendar.module'
import { TasksModule } from './tasks/tasks.module'
import { NotificationModule } from './notification/notification.module'
import { HealthModule } from './health/health.module'
import { ActivitiesModule } from './activities/activities.module'
import { CurrencyModule } from './common/currency/currency.module'
import { ClientConfigModule } from './config/client-config.module'
import { InboxModule } from './inbox/inbox.module'
import { ProductionOrdersModule } from './production-orders/production-orders.module'
import { StorefrontModule } from './storefront/storefront.module'

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ClientConfigModule,
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [
        {
          ttl: Number(config.get('RATE_LIMIT_TTL_MS') ?? 60_000),
          limit: Number(config.get('RATE_LIMIT_MAX') ?? 120),
        },
      ],
    }),
    PrismaModule,
    CurrencyModule,
    AuthModule,
    UsersModule,
    CustomersModule,
    SalesModule,
    SettingsModule,
    ExpensesModule,
    AccountModule,
    AccountingModule,
    ProjectModule,
    OrdersModule,
    CalendarModule,
    TasksModule,
    NotificationModule,
    HealthModule,
    ActivitiesModule,
    InboxModule,
    ProductionOrdersModule,
    StorefrontModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
