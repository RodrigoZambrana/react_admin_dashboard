"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const config = {
    slug: 'retail',
    displayName: 'Retail Plus',
    description: 'Configuración ejemplo para un cliente del vertical retail con módulos personalizados.',
    shared: {
        locale: 'es-AR',
        currency: 'ARS',
        timezone: 'America/Argentina/Buenos_Aires',
    },
    featureFlags: {
        ACCOUNTING: false,
        EXPENSES: true,
        CUSTOMERS: true,
        SALES: true,
    },
    backend: {
        rateLimit: {
            ttlMs: 30_000,
            limit: 90,
        },
        modules: {
            accounting: false,
            expenses: true,
            notifications: true,
        },
    },
    frontend: {
        routes: {
            protected: {
                disabledRouteKeys: [
                    'appsAccounting.dashboard',
                    'appsExpenses.categories',
                ],
            },
        },
    },
};
exports.default = config;
//# sourceMappingURL=config.js.map