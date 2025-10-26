"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const config = {
    slug: 'urucortinas',
    displayName: 'UruCortinas',
    description: 'Variante particular para el cliente UruCortinas, basada en el core con posibilidad de overrides.',
    shared: {
        locale: 'es-UY',
        currency: 'UYU',
        timezone: 'America/Montevideo',
    },
    featureFlags: {
        SALES: true,
        CUSTOMERS: true,
        PRODUCTS: true,
        CALENDAR: true,
        ACTIVITIES: true,
        EXPENSES: true,
        ACCOUNTING: true,
        ACCOUNT: true,
        USERS: true,
        SETTINGS: true,
        BUDGETS: true,
    },
    backend: {
        rateLimit: {
            ttlMs: 60_000,
            limit: 120,
        },
        modules: {
            accounting: true,
            expenses: true,
            notifications: true,
        },
    },
    frontend: {
        routes: {
            protected: {
                disabledRouteKeys: [],
            },
            public: {
                disabledRouteKeys: [],
            },
        },
    },
};
exports.default = config;
//# sourceMappingURL=config.js.map