"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const throttler_1 = require("@nestjs/throttler");
const core_1 = require("@nestjs/core");
const prisma_module_1 = require("./prisma/prisma.module");
const auth_module_1 = require("./auth/auth.module");
const users_module_1 = require("./users/users.module");
const customers_module_1 = require("./customers/customers.module");
const sales_module_1 = require("./sales/sales.module");
const settings_module_1 = require("./settings/settings.module");
const expenses_module_1 = require("./expenses/expenses.module");
const account_module_1 = require("./account/account.module");
const accounting_module_1 = require("./accounting/accounting.module");
const project_module_1 = require("./project/project.module");
const orders_module_1 = require("./orders/orders.module");
const calendar_module_1 = require("./calendar/calendar.module");
const tasks_module_1 = require("./tasks/tasks.module");
const notification_module_1 = require("./notification/notification.module");
const health_module_1 = require("./health/health.module");
const activities_module_1 = require("./activities/activities.module");
const currency_module_1 = require("./common/currency/currency.module");
const client_config_module_1 = require("./config/client-config.module");
const inbox_module_1 = require("./inbox/inbox.module");
const production_orders_module_1 = require("./production-orders/production-orders.module");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot({ isGlobal: true }),
            client_config_module_1.ClientConfigModule,
            throttler_1.ThrottlerModule.forRootAsync({
                inject: [config_1.ConfigService],
                useFactory: (config) => [
                    {
                        ttl: Number(config.get('RATE_LIMIT_TTL_MS') ?? 60_000),
                        limit: Number(config.get('RATE_LIMIT_MAX') ?? 120),
                    },
                ],
            }),
            prisma_module_1.PrismaModule,
            currency_module_1.CurrencyModule,
            auth_module_1.AuthModule,
            users_module_1.UsersModule,
            customers_module_1.CustomersModule,
            sales_module_1.SalesModule,
            settings_module_1.SettingsModule,
            expenses_module_1.ExpensesModule,
            account_module_1.AccountModule,
            accounting_module_1.AccountingModule,
            project_module_1.ProjectModule,
            orders_module_1.OrdersModule,
            calendar_module_1.CalendarModule,
            tasks_module_1.TasksModule,
            notification_module_1.NotificationModule,
            health_module_1.HealthModule,
            activities_module_1.ActivitiesModule,
            inbox_module_1.InboxModule,
            production_orders_module_1.ProductionOrdersModule,
        ],
        providers: [
            {
                provide: core_1.APP_GUARD,
                useClass: throttler_1.ThrottlerGuard,
            },
        ],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map