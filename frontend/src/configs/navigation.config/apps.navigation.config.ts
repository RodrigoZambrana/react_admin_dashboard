import { APP_PREFIX_PATH } from '@/constants/route.constant'
import {
    NAV_ITEM_TYPE_TITLE,
    NAV_ITEM_TYPE_COLLAPSE,
    NAV_ITEM_TYPE_ITEM,
} from '@/constants/navigation.constant'
import { ROLE_HIERARCHY } from '@/constants/roles.constant'
import { FEATURES, getRolesForFeature } from '@/constants/roleAccess.constant'
import type { NavigationTree } from '@/@types/navigation'
import { clientConfig } from '@/configs/clientConfig'

const hasBudgetsFeature = Boolean(clientConfig.featureFlags?.BUDGETS)
const isUrucortinas = clientConfig.slug === 'urucortinas'

const salesSubMenu: NavigationTree[] = [
    {
        key: 'appsSales.dashboard',
        path: `${APP_PREFIX_PATH}/sales/dashboard`,
        title: 'Dashboard',
        translateKey: 'nav.appsSales.dashboard',
        icon: '',
        type: NAV_ITEM_TYPE_ITEM,
        authority: getRolesForFeature(FEATURES.SALES),
        subMenu: [],
    },
    {
        key: 'appsSales.orderList',
        path: `${APP_PREFIX_PATH}/sales/order-list`,
        title: 'Order List',
        translateKey: 'nav.appsSales.orderList',
        icon: '',
        type: NAV_ITEM_TYPE_ITEM,
        authority: getRolesForFeature(FEATURES.SALES),
        subMenu: [],
    },
    {
        key: 'appsSales.orderNew',
        path: `${APP_PREFIX_PATH}/sales/order-new`,
        title: 'Add Order',
        translateKey: 'nav.appsSales.addOrder',
        icon: '',
        type: NAV_ITEM_TYPE_ITEM,
        authority: getRolesForFeature(FEATURES.SALES),
        subMenu: [],
    },
]

if (hasBudgetsFeature && !isUrucortinas) {
    salesSubMenu.splice(
        2,
        0,
        {
            key: 'appsSales.budgetList',
            path: `${APP_PREFIX_PATH}/sales/budget-list`,
            title: 'Budgets',
            translateKey: 'nav.appsSales.budgetList',
            icon: '',
            type: NAV_ITEM_TYPE_ITEM,
            authority: getRolesForFeature(FEATURES.SALES),
            subMenu: [],
        },
        {
            key: 'appsSales.budgetQuick',
            path: `${APP_PREFIX_PATH}/sales/budget-quick`,
            title: 'Quick Budget',
            translateKey: 'nav.appsSales.budgetQuick',
            icon: '',
            type: NAV_ITEM_TYPE_ITEM,
            authority: getRolesForFeature(FEATURES.SALES),
            subMenu: [],
        },
        {
            key: 'appsSales.budgetNew',
            path: `${APP_PREFIX_PATH}/sales/budget-new`,
            title: 'New Budget',
            translateKey: 'nav.appsSales.budgetNew',
            icon: '',
            type: NAV_ITEM_TYPE_ITEM,
            authority: getRolesForFeature(FEATURES.SALES),
            subMenu: [],
        },
    )
}


let budgetsNavigation: NavigationTree | null = null

if (isUrucortinas && hasBudgetsFeature) {
    budgetsNavigation = {
        key: 'apps.budgets',
        path: '',
        title: 'Budgets',
        translateKey: 'nav.appsBudgets.budgets',
        icon: 'budgets',
        type: NAV_ITEM_TYPE_COLLAPSE,
        authority: getRolesForFeature(FEATURES.SALES),
        subMenu: [
            {
                key: 'appsSales.budgetList',
                path: `${APP_PREFIX_PATH}/sales/budget-list`,
                title: 'Budget List',
                translateKey: 'nav.appsBudgets.list',
                icon: '',
                type: NAV_ITEM_TYPE_ITEM,
                authority: getRolesForFeature(FEATURES.SALES),
                subMenu: [],
            },
            {
                key: 'appsBudgets.summary',
                path: `${APP_PREFIX_PATH}/sales/budget-quick`,
                title: 'Budget Summary',
                translateKey: 'nav.appsBudgets.summary',
                icon: '',
                type: NAV_ITEM_TYPE_ITEM,
                authority: getRolesForFeature(FEATURES.SALES),
                subMenu: [],
            },
            {
                key: 'appsSales.budgetNew',
                path: `${APP_PREFIX_PATH}/sales/budget-new`,
                title: 'New Budget',
                translateKey: 'nav.appsBudgets.new',
                icon: '',
                type: NAV_ITEM_TYPE_ITEM,
                authority: getRolesForFeature(FEATURES.SALES),
                subMenu: [],
            },
        ],
    }
}

const appsNavigationConfig: NavigationTree[] = [
    {
        key: 'apps',
        path: '',
        title: 'APPS',
        translateKey: 'nav.apps',
        icon: 'apps',
        type: NAV_ITEM_TYPE_TITLE,
        authority: ROLE_HIERARCHY,
        subMenu: [
            // Ventas
            {
                key: 'apps.sales',
                path: '',
                title: 'Sales',
                translateKey: 'nav.appsSales.sales',
                icon: 'sales',
                type: NAV_ITEM_TYPE_COLLAPSE,
                authority: getRolesForFeature(FEATURES.SALES),
                subMenu: salesSubMenu,
            },
            // Clientes
            {
                key: 'apps.crm',
                path: '',
                title: 'Clients',
                translateKey: 'nav.appsCrm.crm',
                icon: 'crm',
                type: NAV_ITEM_TYPE_COLLAPSE,
                authority: getRolesForFeature(FEATURES.CUSTOMERS),
                subMenu: [
                    {
                        key: 'appsCrm.customers',
                        path: `${APP_PREFIX_PATH}/crm/customers`,
                        title: 'Customers',
                        translateKey: 'nav.appsCrm.customers',
                        icon: '',
                        type: NAV_ITEM_TYPE_ITEM,
                        authority: getRolesForFeature(FEATURES.CUSTOMERS),
                        subMenu: [],
                    },
                    {
                        key: 'appsCrm.mail',
                        path: `${APP_PREFIX_PATH}/crm/mail`,
                        title: 'Inbox',
                        translateKey: 'nav.appsCrm.mail',
                        icon: '',
                        type: NAV_ITEM_TYPE_ITEM,
                        authority: getRolesForFeature(FEATURES.CUSTOMERS),
                        subMenu: [],
                    },
                ],
            },
            // Productos (nuevo menú)
            {
                key: 'appsProducts.productList',
                path: `${APP_PREFIX_PATH}/products/list`,
                title: 'Products',
                translateKey: 'nav.appsProducts.products',
                icon: 'products',
                type: NAV_ITEM_TYPE_ITEM,
                authority: getRolesForFeature(FEATURES.PRODUCTS),
                subMenu: [],
            },
            // Agenda
            {
                key: 'apps.calendar',
                path: '',
                title: 'Calendar',
                translateKey: 'nav.appsCalendar.calendar',
                icon: 'calendar',
                type: NAV_ITEM_TYPE_COLLAPSE,
                authority: getRolesForFeature(FEATURES.CALENDAR),
                subMenu: [
                    {
                        key: 'appsCalendar.activities',
                        path: `${APP_PREFIX_PATH}/calendar/activities`,
                        title: 'Activities',
                        translateKey: 'nav.appsCalendar.activities',
                        icon: '',
                        type: NAV_ITEM_TYPE_ITEM,
                        authority: getRolesForFeature(FEATURES.CALENDAR),
                        subMenu: [],
                    },
                    {
                        key: 'appsCalendar.schedule',
                        path: `${APP_PREFIX_PATH}/calendar/schedule`,
                        title: 'Schedule',
                        translateKey: 'nav.appsCalendar.schedule',
                        icon: '',
                        type: NAV_ITEM_TYPE_ITEM,
                        authority: getRolesForFeature(FEATURES.CALENDAR),
                        subMenu: [],
                    },
                ],
            },
            // Gastos
            {
                key: 'apps.expenses',
                path: '',
                title: 'Expenses',
                translateKey: 'nav.appsExpenses.expenses',
                icon: 'expenses',
                type: NAV_ITEM_TYPE_COLLAPSE,
                authority: getRolesForFeature(FEATURES.EXPENSES),
                subMenu: [
                    {
                        key: 'appsExpenses.dashboard',
                        path: `${APP_PREFIX_PATH}/expenses/dashboard`,
                        title: 'Dashboard',
                        translateKey: 'nav.appsExpenses.dashboard',
                        icon: '',
                        type: NAV_ITEM_TYPE_ITEM,
                        authority: getRolesForFeature(FEATURES.EXPENSES),
                        subMenu: [],
                    },
                    {
                        key: 'appsExpenses.expenseList',
                        path: `${APP_PREFIX_PATH}/expenses/expense-list`,
                        title: 'Expense List',
                        translateKey: 'nav.appsExpenses.expenseList',
                        icon: '',
                        type: NAV_ITEM_TYPE_ITEM,
                        authority: getRolesForFeature(FEATURES.EXPENSES),
                        subMenu: [],
                    },
                    {
                        key: 'appsExpenses.expenseNew',
                        path: `${APP_PREFIX_PATH}/expenses/expense-new`,
                        title: 'New Expense',
                        translateKey: 'nav.appsExpenses.expenseNew',
                        icon: '',
                        type: NAV_ITEM_TYPE_ITEM,
                        authority: getRolesForFeature(FEATURES.EXPENSES),
                        subMenu: [],
                    },
                ],
            },
            // Contabilidad
            {
                key: 'appsAccounting.dashboard',
                path: `${APP_PREFIX_PATH}/accounting/dashboard`,
                title: 'Contabilidad',
                translateKey: 'nav.appsAccounting.accounting',
                icon: 'accounting',
                type: NAV_ITEM_TYPE_ITEM,
                authority: getRolesForFeature(FEATURES.ACCOUNTING),
                subMenu: [],
            },
            // Actividades
            {
                key: 'appsActivities.dashboard',
                path: `${APP_PREFIX_PATH}/activities`,
                title: 'Activities',
                translateKey: 'nav.appsCalendar.activities',
                icon: 'project',
                type: NAV_ITEM_TYPE_ITEM,
                authority: getRolesForFeature(FEATURES.ACTIVITIES),
                subMenu: [],
            },
            // Usuarios
            {
                key: 'appsUsers.userList',
                path: `${APP_PREFIX_PATH}/users/list`,
                title: 'Users',
                translateKey: 'nav.appsUsers.users',
                icon: 'signUp',
                type: NAV_ITEM_TYPE_ITEM,
                authority: getRolesForFeature(FEATURES.USERS),
                subMenu: [],
            },
            // Configuración
            {
                key: 'apps.settings',
                path: '',
                title: 'Settings',
                translateKey: 'nav.appsSettings.settings',
                icon: 'settings',
                type: NAV_ITEM_TYPE_COLLAPSE,
                authority: getRolesForFeature(FEATURES.SETTINGS),
                subMenu: [
                    {
                        key: 'appsSettings.companyProfile',
                        path: `${APP_PREFIX_PATH}/settings/company-profile`,
                        title: 'Company Profile',
                        translateKey: 'nav.appsSettings.companyProfile',
                        icon: '',
                        type: NAV_ITEM_TYPE_ITEM,
                        authority: getRolesForFeature(FEATURES.SETTINGS),
                        subMenu: [],
                    },
                    {
                        key: 'appsSettings.orderStatuses',
                        path: `${APP_PREFIX_PATH}/settings/order-statuses`,
                        title: 'Order Statuses',
                        translateKey: 'nav.appsSettings.orderStatuses',
                        icon: '',
                        type: NAV_ITEM_TYPE_ITEM,
                        authority: getRolesForFeature(FEATURES.SETTINGS),
                        subMenu: [],
                    },
                    {
                        key: 'appsSettings.products',
                        path: `${APP_PREFIX_PATH}/settings/products`,
                        title: 'Products',
                        translateKey: 'nav.appsSettings.products',
                        icon: '',
                        type: NAV_ITEM_TYPE_ITEM,
                        authority: getRolesForFeature(FEATURES.SETTINGS),
                        subMenu: [],
                    },
                    {
                        key: 'appsSettings.customerStatuses',
                        path: `${APP_PREFIX_PATH}/settings/customer-statuses`,
                        title: 'Customer Statuses',
                        translateKey: 'nav.appsSettings.customerStatuses',
                        icon: '',
                        type: NAV_ITEM_TYPE_ITEM,
                        authority: getRolesForFeature(FEATURES.SETTINGS),
                        subMenu: [],
                    },
                    {
                        key: 'appsSettings.expenses',
                        path: `${APP_PREFIX_PATH}/settings/expenses`,
                        title: 'Expenses',
                        translateKey: 'nav.appsSettings.expenses',
                        icon: '',
                        type: NAV_ITEM_TYPE_ITEM,
                        authority: getRolesForFeature(FEATURES.SETTINGS),
                        subMenu: [],
                    },
                    {
                        key: 'appsSettings.paymentMethods',
                        path: `${APP_PREFIX_PATH}/settings/payment-methods`,
                        title: 'Payment Methods',
                        translateKey: 'nav.appsSettings.paymentMethods',
                        icon: '',
                        type: NAV_ITEM_TYPE_ITEM,
                        authority: getRolesForFeature(FEATURES.SETTINGS),
                        subMenu: [],
                    },
                    {
                        key: 'appsSettings.shippingOptions',
                        path: `${APP_PREFIX_PATH}/settings/shipping-options`,
                        title: 'Shipping Options',
                        translateKey: 'nav.appsSettings.shippingOptions',
                        icon: '',
                        type: NAV_ITEM_TYPE_ITEM,
                        authority: getRolesForFeature(FEATURES.SETTINGS),
                        subMenu: [],
                    },
                    {
                        key: 'appsSettings.systemConfig',
                        path: `${APP_PREFIX_PATH}/settings/system-config`,
                        title: 'System Config',
                        translateKey: 'nav.appsSettings.systemConfig',
                        icon: '',
                        type: NAV_ITEM_TYPE_ITEM,
                        authority: getRolesForFeature(FEATURES.SETTINGS),
                        subMenu: [],
                    },
                    {
                        key: 'appsSettings.calendarEventTypes',
                        path: `${APP_PREFIX_PATH}/settings/calendar-event-types`,
                        title: 'Calendar Event Types',
                        translateKey: 'nav.appsSettings.calendarEventTypes',
                        icon: '',
                        type: NAV_ITEM_TYPE_ITEM,
                        authority: getRolesForFeature(FEATURES.SETTINGS),
                        subMenu: [],
                    },
                ],
            },
            // Cuenta
            {
                key: 'apps.account',
                path: '',
                title: 'Account',
                translateKey: 'nav.appsAccount.account',
                icon: 'account',
                type: NAV_ITEM_TYPE_COLLAPSE,
                authority: getRolesForFeature(FEATURES.ACCOUNT),
                subMenu: [
                    {
                        key: 'appsAccount.settings',
                        path: `${APP_PREFIX_PATH}/account/settings/profile`,
                        title: 'Settings',
                        translateKey: 'nav.appsAccount.settings',
                        icon: '',
                        type: NAV_ITEM_TYPE_ITEM,
                        authority: getRolesForFeature(FEATURES.ACCOUNT),
                        subMenu: [],
                    },
                    {
                        key: 'appsAccount.activityLog',
                        path: `${APP_PREFIX_PATH}/account/activity-log`,
                        title: 'Activity Log',
                        translateKey: 'nav.appsAccount.activityLog',
                        icon: '',
                        type: NAV_ITEM_TYPE_ITEM,
                        authority: getRolesForFeature(FEATURES.ACCOUNT),
                        subMenu: [],
                    },
                    {
                        key: 'appsAccount.signOut',
                        path: `/sign-out`,
                        title: 'Sign out',
                        translateKey: 'nav.signOut',
                        icon: 'signOut',
                        type: NAV_ITEM_TYPE_ITEM,
                        authority: getRolesForFeature(FEATURES.ACCOUNT),
                        subMenu: [],
                    },
                ],
            },
        ],
    },
]

if (budgetsNavigation) {
    const appsRoot = appsNavigationConfig[0]
    if (appsRoot?.subMenu) {
        const salesIndex = appsRoot.subMenu.findIndex(
            (item) => item.key === 'apps.sales',
        )
        const insertIndex = salesIndex >= 0 ? salesIndex + 1 : appsRoot.subMenu.length
        appsRoot.subMenu.splice(insertIndex, 0, budgetsNavigation)
    }
}

export default appsNavigationConfig
