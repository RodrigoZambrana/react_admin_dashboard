import type { ClientVariantConfig } from '@/configs/clientConfig'

const config: ClientVariantConfig = {
    slug: 'urucortinas',
    displayName: 'UruCortinas',
    description:
        'Configuración particular para el cliente UruCortinas, mantiene la base actual y permite personalizaciones futuras.',
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
    },
    frontend: {
        app: {
            locale: 'es',
        },
        theme: {
            themeColor: 'teal',
            primaryColorLevel: 500,
        },
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
