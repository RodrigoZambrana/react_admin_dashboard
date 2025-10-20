import type { ClientVariantConfig } from '../../config/client-config.types'

const config: ClientVariantConfig = {
  slug: 'core',
  displayName: 'Base Core',
  description:
    'Configuración base compartida por todos los despliegues y clientes.',
  shared: {
    locale: 'en-US',
    currency: 'USD',
    timezone: 'America/Chicago',
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
}

export default config
