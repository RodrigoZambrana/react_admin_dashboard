import { lazy } from 'react'
import type { ClientVariantConfig } from '@/configs/clientConfig'
import { APP_PREFIX_PATH } from '@/constants/route.constant'

const config: ClientVariantConfig = {
    slug: 'retail',
    displayName: 'Retail Plus',
    description:
        'Ejemplo de configuración para un cliente del vertical retail con branding y rutas ajustadas.',
    featureFlags: {
        ACCOUNTING: false,
        EXPENSES: true,
        CALENDAR: true,
        CUSTOMERS: true,
        SALES: true,
    },
    frontend: {
        app: {
            locale: 'es',
        },
        theme: {
            themeColor: 'orange',
            primaryColorLevel: 500,
        },
        routes: {
            protected: {
                disabledRouteKeys: ['appsAccounting.dashboard'],
                additionalRoutes: [
                    {
                        key: 'appsRetail.loyaltyDashboard',
                        path: `${APP_PREFIX_PATH}/retail/loyalty`,
                        component: lazy(() => import('@/views/sales/SalesDashboard')),
                        authority: [],
                        meta: {
                            header: 'Programa de Fidelización',
                        },
                    },
                ],
            },
        },
    },
}

export default config
