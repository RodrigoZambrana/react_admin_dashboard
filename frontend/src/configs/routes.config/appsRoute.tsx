import { lazy } from 'react'
import { APP_PREFIX_PATH } from '@/constants/route.constant'
import { FEATURES, getRolesForFeature } from '@/constants/roleAccess.constant'
import type { Routes } from '@/@types/routes'
import { applyClientRouteOverrides, clientConfig } from '../clientConfig'

const isUrucortinas = clientConfig.slug === 'urucortinas'

const baseAppsRoute: Routes = [
    // Calendar
    {
        key: 'appsCalendar.activities',
        path: `${APP_PREFIX_PATH}/calendar/activities`,
        component: lazy(() => import('@/views/calendar/Activities')),
        authority: getRolesForFeature(FEATURES.CALENDAR),
        meta: {
            header: 'Activities',
        },
    },
    {
        key: 'appsActivities.dashboard',
        path: `${APP_PREFIX_PATH}/activities`,
        component: lazy(() => import('@/views/project/ScrumBoard')),
        authority: getRolesForFeature(FEATURES.ACTIVITIES),
        meta: {
            header: 'Activities',
        },
    },
    {
        key: 'appsCalendar.schedule',
        path: `${APP_PREFIX_PATH}/calendar/schedule`,
        component: lazy(() => import('@/views/crm/Calendar')),
        authority: getRolesForFeature(FEATURES.CALENDAR),
        meta: {
            header: lazy(() => import('@/views/crm/Calendar/HeaderTitle')),
        },
    },
    {
        key: 'appsCalendar.activityDetails',
        path: `${APP_PREFIX_PATH}/calendar/activities/details`,
        component: lazy(() => import('@/views/calendar/ActivitiesDetail')),
        authority: getRolesForFeature(FEATURES.CALENDAR),
        meta: {
            header: lazy(() => import('@/views/calendar/ActivitiesDetail/HeaderTitle')),
            headerContainer: true,
        },
    },
    {
        key: 'appsAccount.resetPassword',
        path: `${APP_PREFIX_PATH}/account/reset-password`,
        component: lazy(() => import('@/views/account/ResetPasswordInApp')),
        authority: getRolesForFeature(FEATURES.ACCOUNT),
    },
    {
        key: 'appsProject.scrumBoard',
        path: `${APP_PREFIX_PATH}/project/scrum-board`,
        component: lazy(() => import('@/views/project/ScrumBoard')),
        authority: getRolesForFeature(FEATURES.ACTIVITIES),
        meta: {
            pageContainerType: 'gutterless',
        },
    },
    {
        key: 'appsCrm.customers',
        path: `${APP_PREFIX_PATH}/crm/customers`,
        component: lazy(() => import('@/views/crm/Customers')),
        authority: getRolesForFeature(FEATURES.CUSTOMERS),
        meta: {
            header: lazy(() => import('@/views/crm/Customers/HeaderTitle')),
        },
    },
    {
        key: 'appsCrm.customerDetails',
        path: `${APP_PREFIX_PATH}/crm/customer-details`,
        component: lazy(() => import('@/views/crm/CustomerDetail')),
        authority: getRolesForFeature(FEATURES.CUSTOMERS),
        meta: {
            header: lazy(() => import('@/views/crm/CustomerDetail/HeaderTitle')),
            headerContainer: true,
        },
    },
    {
        key: 'appsCrm.mail',
        path: `${APP_PREFIX_PATH}/crm/mail`,
        component: lazy(() => import('@/views/crm/Mail')),
        authority: getRolesForFeature(FEATURES.CUSTOMERS),
        meta: {
            pageContainerType: 'gutterless',
            footer: false,
        },
    },
    {
        key: 'appsCrm.mail',
        path: `${APP_PREFIX_PATH}/crm/mail/:category`,
        component: lazy(() => import('@/views/crm/Mail')),
        authority: getRolesForFeature(FEATURES.CUSTOMERS),
        meta: {
            pageContainerType: 'gutterless',
            footer: false,
        },
    },
    {
        key: 'appsSales.dashboard',
        path: `${APP_PREFIX_PATH}/sales/dashboard`,
        component: lazy(() => import('@/views/sales/SalesDashboard')),
        authority: getRolesForFeature(FEATURES.SALES),
    },
    {
        key: 'appsAccounting.dashboard',
        path: `${APP_PREFIX_PATH}/accounting/dashboard`,
        component: lazy(() => import('@/views/accounting/AccountingDashboard')),
        authority: getRolesForFeature(FEATURES.ACCOUNTING),
    },
    {
        key: 'appsAccounting.payments',
        path: `${APP_PREFIX_PATH}/accounting/payments`,
        component: lazy(() => import('@/views/accounting/Payments')),
        authority: getRolesForFeature(FEATURES.ACCOUNTING),
        meta: {
            header: 'Payments',
        },
    },
    {
        key: 'appsExpenses.dashboard',
        path: `${APP_PREFIX_PATH}/expenses/dashboard`,
        component: lazy(() => import('@/views/expenses/ExpensesDashboard/ExpensesDashboard')),
        authority: getRolesForFeature(FEATURES.EXPENSES),
    },
    {
        key: 'appsProducts.productList',
        path: `${APP_PREFIX_PATH}/products/list`,
        component: lazy(() => import('@/views/sales/ProductList')),
        authority: getRolesForFeature(FEATURES.PRODUCTS),
    },
    {
        key: 'appsProducts.productEdit',
        path: `${APP_PREFIX_PATH}/products/edit/:productId`,
        component: lazy(() => import('@/views/sales/ProductEdit')),
        authority: getRolesForFeature(FEATURES.PRODUCTS),
        meta: {
            header: 'Edit Product',
        },
    },
    {
        key: 'appsSales.orderList',
        path: `${APP_PREFIX_PATH}/sales/order-list`,
        component: lazy(() => import('@/views/sales/OrderList')),
        authority: getRolesForFeature(FEATURES.SALES),
    },
    {
        key: 'appsSales.budgetQuick',
        path: `${APP_PREFIX_PATH}/sales/budget-quick`,
        component: lazy(() => import('@/views/sales/BudgetSummary')),
        authority: getRolesForFeature(FEATURES.SALES),
        meta: {
            header: 'Quick Budget',
        },
    },
    {
        key: 'appsSales.orderNew',
        path: `${APP_PREFIX_PATH}/sales/order-new`,
        component: lazy(() => import('@/views/sales/OrderNew')),
        authority: getRolesForFeature(FEATURES.SALES),
        meta: {
            header: 'New Order',
        },
    },
    {
        key: 'appsSales.orderEdit',
        path: `${APP_PREFIX_PATH}/sales/order-edit/:orderId`,
        component: lazy(() => import('@/views/sales/OrderEdit')),
        authority: getRolesForFeature(FEATURES.SALES),
        meta: {
            header: 'Edit Order',
        },
    },
    {
        key: 'appsSales.orderDetails',
        path: `${APP_PREFIX_PATH}/sales/order-details/:orderId`,
        component: lazy(() => import('@/views/sales/OrderDetails')),
        authority: getRolesForFeature(FEATURES.SALES),
    },

    ...(isUrucortinas
        ? [
              {
                  key: 'appsSales.productionOrders',
                  path: `${APP_PREFIX_PATH}/sales/production-orders`,
                  component: lazy(() => import('@/views/sales/ProductionOrders')),
                  authority: getRolesForFeature(FEATURES.SALES),
                  meta: {
                      header: 'Production Orders',
                  },
              },
          ]
        : []),
    {
        key: 'appsExpenses.expenseList',
        path: `${APP_PREFIX_PATH}/expenses/expense-list`,
        component: lazy(() => import('@/views/expenses/ExpenseList')),
        authority: getRolesForFeature(FEATURES.EXPENSES),
    },
    {
        key: 'appsExpenses.expenseNew',
        path: `${APP_PREFIX_PATH}/expenses/expense-new`,
        component: lazy(() => import('@/views/expenses/ExpenseNew')),
        authority: getRolesForFeature(FEATURES.EXPENSES),
    },
    {
        key: 'appsExpenses.expenseDetail',
        path: `${APP_PREFIX_PATH}/expenses/expense-detail/:expenseId`,
        component: lazy(() => import('@/views/expenses/ExpenseDetail')),
        authority: getRolesForFeature(FEATURES.EXPENSES),
        meta: {
            header: lazy(() => import('@/views/expenses/ExpenseDetail/HeaderTitle')),
        },
    },
    {
        key: 'appsExpenses.expenseEdit',
        path: `${APP_PREFIX_PATH}/expenses/expense-edit/:expenseId`,
        component: lazy(() => import('@/views/expenses/ExpenseEdit')),
        authority: getRolesForFeature(FEATURES.EXPENSES),
        meta: {
            header: 'Edit Expense',
        },
    },
    {
        key: 'appsExpenses.categories',
        path: `${APP_PREFIX_PATH}/expenses/categories`,
        component: lazy(() => import('@/views/expenses/Categories')),
        authority: getRolesForFeature(FEATURES.EXPENSES),
    },
    
    
    {
        key: 'appsAccount.settings',
        path: `${APP_PREFIX_PATH}/account/settings/:tab`,
        component: lazy(() => import('@/views/account/Settings')),
        authority: getRolesForFeature(FEATURES.ACCOUNT),
        meta: {
            header: 'Settings',
            headerContainer: true,
        },
    },
    {
        key: 'appsAccount.invoice',
        path: `${APP_PREFIX_PATH}/account/invoice/:id`,
        component: lazy(() => import('@/views/account/Invoice')),
        authority: getRolesForFeature(FEATURES.ACCOUNT),
    },
    {
        key: 'appsAccount.activityLog',
        path: `${APP_PREFIX_PATH}/account/activity-log`,
        component: lazy(() => import('@/views/account/ActivityLog')),
        authority: getRolesForFeature(FEATURES.ACCOUNT),
    },
    {
        key: 'appsAccount.kycForm',
        path: `${APP_PREFIX_PATH}/account/kyc-form`,
        component: lazy(() => import('@/views/account/KycForm')),
        authority: getRolesForFeature(FEATURES.ACCOUNT),
    },
    // Settings
    {
        key: 'appsSettings.companyProfile',
        path: `${APP_PREFIX_PATH}/settings/company-profile`,
        component: lazy(() => import('@/views/settings/CompanyProfile')),
        authority: getRolesForFeature(FEATURES.SETTINGS),
    },
    {
        key: 'appsSettings.orderStatuses',
        path: `${APP_PREFIX_PATH}/settings/order-statuses`,
        component: lazy(() => import('@/views/settings/OrderStatuses')),
        authority: getRolesForFeature(FEATURES.SETTINGS),
    },
    {
        key: 'appsSettings.products',
        path: `${APP_PREFIX_PATH}/settings/products`,
        component: lazy(() => import('@/views/settings/ProductSettings')),
        authority: getRolesForFeature(FEATURES.SETTINGS),
    },
    {
        key: 'appsSettings.customerStatuses',
        path: `${APP_PREFIX_PATH}/settings/customer-statuses`,
        component: lazy(() => import('@/views/settings/CustomerStatuses')),
        authority: getRolesForFeature(FEATURES.SETTINGS),
    },
    {
        key: 'appsSettings.expenses',
        path: `${APP_PREFIX_PATH}/settings/expenses`,
        component: lazy(() => import('@/views/settings/ExpenseSettings')),
        authority: getRolesForFeature(FEATURES.SETTINGS),
    },
    {
        key: 'appsSettings.paymentMethods',
        path: `${APP_PREFIX_PATH}/settings/payment-methods`,
        component: lazy(() => import('@/views/settings/PaymentMethods')),
        authority: getRolesForFeature(FEATURES.SETTINGS),
    },
    {
        key: 'appsSettings.google',
        path: `${APP_PREFIX_PATH}/settings/google`,
        component: lazy(() => import('@/views/settings/GoogleSettings')),
        authority: getRolesForFeature(FEATURES.SETTINGS),
    },
    {
        key: 'appsSettings.shippingOptions',
        path: `${APP_PREFIX_PATH}/settings/shipping-options`,
        component: lazy(() => import('@/views/settings/ShippingOptions')),
        authority: getRolesForFeature(FEATURES.SETTINGS),
    },
    {
        key: 'appsSettings.mercadoPago',
        path: `${APP_PREFIX_PATH}/settings/mercado-pago`,
        component: lazy(() => import('@/views/settings/MercadoPagoSettings')),
        authority: getRolesForFeature(FEATURES.SETTINGS),
    },
    {
        key: 'appsSettings.systemConfig',
        path: `${APP_PREFIX_PATH}/settings/system-config`,
        component: lazy(() => import('@/views/settings/SystemConfig')),
        authority: getRolesForFeature(FEATURES.SETTINGS),
    },
    {
        key: 'appsSettings.email',
        path: `${APP_PREFIX_PATH}/settings/email`,
        component: lazy(() => import('@/views/settings/EmailSettings')),
        authority: getRolesForFeature(FEATURES.SETTINGS),
    },
    {
        key: 'appsSettings.calendarEventTypes',
        path: `${APP_PREFIX_PATH}/settings/calendar-event-types`,
        component: lazy(() => import('@/views/settings/CalendarEventTypes')),
        authority: getRolesForFeature(FEATURES.SETTINGS),
    },
    // Users
    {
        key: 'appsUsers.userList',
        path: `${APP_PREFIX_PATH}/users/list`,
        component: lazy(() => import('@/views/users/UsersList/UsersList')),
        authority: getRolesForFeature(FEATURES.USERS),
    },
    {
        key: 'appsUsers.userNew',
        path: `${APP_PREFIX_PATH}/users/new`,
        component: lazy(() => import('@/views/users/UserNew/UserNew')),
        authority: getRolesForFeature(FEATURES.USERS),
        meta: {
            header: lazy(() => import('@/views/users/UserNew/HeaderTitle')),
        },
    },
]

const appsRoute: Routes = applyClientRouteOverrides(
    baseAppsRoute,
    'protected',
)

export default appsRoute
