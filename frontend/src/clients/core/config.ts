import type { ClientVariantConfig } from '@/configs/clientConfig'

const config: ClientVariantConfig = {
    slug: 'core',
    displayName: 'Base Core',
    description:
        'Configuración compartida para todos los entornos y clientes.',
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
    PARAMETRIC_PRODUCTS: false,
  },
    frontend: {
        app: {
            locale: 'en',
        },
        theme: {},
        routes: {
            protected: {
                disabledRouteKeys: [],
            },
            public: {
                disabledRouteKeys: [],
            },
        },
    },
}

export default config
