import { lazy } from 'react'
import type { ClientVariantConfig } from '@/configs/clientConfig'
import { APP_PREFIX_PATH } from '@/constants/route.constant'

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
        BUDGETS: true,
        PARAMETRIC_PRODUCTS: true,
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
                additionalRoutes: [
                    {
                        key: 'appsSales.budgetList',
                        path: `${APP_PREFIX_PATH}/sales/budget-list`,
                        component: lazy(() => import('@/views/sales/BudgetList')),
                        authority: [],
                        meta: {
                            header: 'Presupuestos',
                        },
                    },
                    {
                        key: 'appsBudgets.summary',
                        path: `${APP_PREFIX_PATH}/sales/budget-quick`,
                        component: lazy(
                            () => import('@/views/sales/BudgetSummary'),
                        ),
                        authority: [],
                        meta: {
                            header: 'Presupuestos -Calculo Rápido',
                        },
                    },
                    {
                        key: 'appsSales.budgetNew',
                        path: `${APP_PREFIX_PATH}/sales/budget-new`,
                        component: lazy(() => import('@/views/sales/BudgetNew')),
                        authority: [],
                        meta: {
                            header: 'Presupuestos',
                        },
                    },
                    {
                        key: 'appsSales.budgetEdit',
                        path: `${APP_PREFIX_PATH}/sales/budget-edit/:orderId`,
                        component: lazy(() => import('@/views/sales/BudgetEdit')),
                        authority: [],
                        meta: {
                            header: 'Presupuestos',
                        },
                    },
                    {
                        key: 'appsSales.budgetDetails',
                        path: `${APP_PREFIX_PATH}/sales/budget-details/:orderId`,
                        component: lazy(() => import('@/views/sales/BudgetDetails')),
                        authority: [],
                        meta: {
                            header: 'Presupuestos',
                        },
                    },
                    {
                        key: 'appsSales.budgetDocument',
                        path: `${APP_PREFIX_PATH}/sales/budget-document/:orderId`,
                        component: lazy(
                            () => import('@/views/sales/BudgetDocument'),
                        ),
                        authority: [],
                        meta: {
                            header: 'Presupuestos',
                        },
                    },
                ],
            },
            public: {
                disabledRouteKeys: [],
            },
        },
    },
}

export default config
