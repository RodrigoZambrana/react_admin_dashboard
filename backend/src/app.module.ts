import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler'
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core'
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
import { NotificationsModule } from './notifications/notifications.module'
import { HealthModule } from './health/health.module'
import { ActivitiesModule } from './activities/activities.module'
import { CurrencyModule } from './common/currency/currency.module'
import { ClientConfigModule } from './config/client-config.module'
import { InboxModule } from './inbox/inbox.module'
import { ProductionOrdersModule } from './production-orders/production-orders.module'
import { StorefrontModule } from './storefront/storefront.module'
import { EmailModule } from './email/email.module'
import { SecureConfigModule } from './common/security/secure-config.module'
import { CatalogModule } from './catalog/catalog.module'
import { PricingModule } from './pricing/pricing.module'
import { AberturasGlossaryModule } from './aberturas/aberturas-glossary.module'
import { CmsModule } from './cms/cms.module'
import { QaModule } from './qa/qa.module'
import { ConversationsModule } from './conversations/conversations.module'
import { AiModule } from './ai/ai.module'
import { KnowledgeModule } from './knowledge/knowledge.module'
import { WhatsappQrModule } from './channels/whatsapp-qr/whatsapp-qr.module'
import { GlobalExceptionFilter } from './common/filters/global-exception.filter'
import { CorrelationIdMiddleware } from './common/middleware/correlation-id.middleware'
import { TimeoutInterceptor } from './common/interceptors/timeout.interceptor'
import { ObservabilityService } from './common/observability/observability.service'

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
    NotificationsModule,
    HealthModule,
    ActivitiesModule,
    InboxModule,
    ProductionOrdersModule,
    StorefrontModule,
    EmailModule,
    SecureConfigModule,
    CatalogModule,
    PricingModule,
    AberturasGlossaryModule,
    CmsModule,
    QaModule,
    ConversationsModule,
    AiModule,
    KnowledgeModule,
    WhatsappQrModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: TimeoutInterceptor,
    },
    ObservabilityService,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*')
  }
}
