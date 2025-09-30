import { lazy } from 'react'
import { APP_PREFIX_PATH } from '@/constants/route.constant'
import { ADMIN, USER } from '@/constants/roles.constant'
import type { Routes } from '@/@types/routes'

const appsRoute: Routes = [
    // Calendar
    {
        key: 'appsCalendar.activities',
        path: `${APP_PREFIX_PATH}/calendar/activities`,
        component: lazy(() => import('@/views/calendar/Activities')),
        authority: [ADMIN, USER],
        meta: {
            header: 'Activities',
        },
    },
    {
        key: 'appsActivities.dashboard',
        path: `${APP_PREFIX_PATH}/activities/dashboard`,
        component: lazy(() => import('@/views/project/ScrumBoard')),
        authority: [ADMIN, USER],
        meta: {
            header: 'Activities',
        },
    },
    {
        key: 'appsCalendar.schedule',
        path: `${APP_PREFIX_PATH}/calendar/schedule`,
        component: lazy(() => import('@/views/crm/Calendar')),
        authority: [ADMIN, USER],
        meta: {
            header: lazy(() => import('@/views/crm/Calendar/HeaderTitle')),
        },
    },
    {
        key: 'appsCalendar.activityDetails',
        path: `${APP_PREFIX_PATH}/calendar/activities/details`,
        component: lazy(() => import('@/views/calendar/ActivitiesDetail')),
        authority: [ADMIN, USER],
        meta: {
            header: lazy(() => import('@/views/calendar/ActivitiesDetail/HeaderTitle')),
            headerContainer: true,
        },
    },
    {
        key: 'appsAccount.resetPassword',
        path: `${APP_PREFIX_PATH}/account/reset-password`,
        component: lazy(() => import('@/views/account/ResetPasswordInApp')),
        authority: [ADMIN, USER],
    },
    {
        key: 'appsProject.scrumBoard',
        path: `${APP_PREFIX_PATH}/project/scrum-board`,
        component: lazy(() => import('@/views/project/ScrumBoard')),
        authority: [ADMIN, USER],
        meta: {
            pageContainerType: 'gutterless',
        },
    },
    {
        key: 'appsCrm.customers',
        path: `${APP_PREFIX_PATH}/crm/customers`,
        component: lazy(() => import('@/views/crm/Customers')),
        authority: [ADMIN, USER],
        meta: {
            header: lazy(() => import('@/views/crm/Customers/HeaderTitle')),
        },
    },
    {
        key: 'appsCrm.customerDetails',
        path: `${APP_PREFIX_PATH}/crm/customer-details`,
        component: lazy(() => import('@/views/crm/CustomerDetail')),
        authority: [ADMIN, USER],
        meta: {
            header: lazy(() => import('@/views/crm/CustomerDetail/HeaderTitle')),
            headerContainer: true,
        },
    },
    {
        key: 'appsCrm.mail',
        path: `${APP_PREFIX_PATH}/crm/mail`,
        component: lazy(() => import('@/views/crm/Mail')),
        authority: [ADMIN, USER],
        meta: {
            pageContainerType: 'gutterless',
            footer: false,
        },
    },
    {
        key: 'appsCrm.mail',
        path: `${APP_PREFIX_PATH}/crm/mail/:category`,
        component: lazy(() => import('@/views/crm/Mail')),
        authority: [ADMIN, USER],
        meta: {
            pageContainerType: 'gutterless',
            footer: false,
        },
    },
    {
        key: 'appsSales.dashboard',
        path: `${APP_PREFIX_PATH}/sales/dashboard`,
        component: lazy(() => import('@/views/sales/SalesDashboard')),
        authority: [ADMIN, USER],
    },
    {
        key: 'appsExpenses.dashboard',
        path: `${APP_PREFIX_PATH}/expenses/dashboard`,
        component: lazy(() => import('@/views/expenses/ExpensesDashboard')),
        authority: [ADMIN, USER],
    },
    {
        key: 'appsSales.productList',
        path: `${APP_PREFIX_PATH}/sales/product-list`,
        component: lazy(() => import('@/views/sales/ProductList')),
        authority: [ADMIN, USER],
    },
    {
        key: 'appsSales.productEdit',
        path: `${APP_PREFIX_PATH}/sales/product-edit/:productId`,
        component: lazy(() => import('@/views/sales/ProductEdit')),
        authority: [ADMIN, USER],
        meta: {
            header: 'Edit Product',
        },
    },
    {
        key: 'appsSales.productNew',
        path: `${APP_PREFIX_PATH}/sales/product-new`,
        component: lazy(() => import('@/views/sales/ProductNew')),
        authority: [ADMIN, USER],
        meta: {
            header: lazy(() => import('@/views/sales/ProductNew/HeaderTitle')),
        },
    },
    {
        key: 'appsSales.orderList',
        path: `${APP_PREFIX_PATH}/sales/order-list`,
        component: lazy(() => import('@/views/sales/OrderList')),
        authority: [ADMIN, USER],
    },
    {
        key: 'appsSales.orderNew',
        path: `${APP_PREFIX_PATH}/sales/order-new`,
        component: lazy(() => import('@/views/sales/OrderNew')),
        authority: [ADMIN, USER],
        meta: {
            header: 'New Order',
        },
    },
    {
        key: 'appsSales.orderEdit',
        path: `${APP_PREFIX_PATH}/sales/order-edit/:orderId`,
        component: lazy(() => import('@/views/sales/OrderEdit')),
        authority: [ADMIN, USER],
        meta: {
            header: 'Edit Order',
        },
    },
    {
        key: 'appsSales.orderDetails',
        path: `${APP_PREFIX_PATH}/sales/order-details/:orderId`,
        component: lazy(() => import('@/views/sales/OrderDetails')),
        authority: [ADMIN, USER],
    },
    {
        key: 'appsExpenses.expenseList',
        path: `${APP_PREFIX_PATH}/expenses/expense-list`,
        component: lazy(() => import('@/views/expenses/ExpenseList')),
        authority: [ADMIN, USER],
    },
    {
        key: 'appsExpenses.expenseNew',
        path: `${APP_PREFIX_PATH}/expenses/expense-new`,
        component: lazy(() => import('@/views/expenses/ExpenseNew')),
        authority: [ADMIN, USER],
    },
    {
        key: 'appsExpenses.expenseEdit',
        path: `${APP_PREFIX_PATH}/expenses/expense-edit/:expenseId`,
        component: lazy(() => import('@/views/expenses/ExpenseEdit')),
        authority: [ADMIN, USER],
        meta: {
            header: 'Edit Expense',
        },
    },
    {
        key: 'appsExpenses.categories',
        path: `${APP_PREFIX_PATH}/expenses/categories`,
        component: lazy(() => import('@/views/expenses/Categories')),
        authority: [ADMIN, USER],
    },
    
    
    {
        key: 'appsAccount.settings',
        path: `${APP_PREFIX_PATH}/account/settings/:tab`,
        component: lazy(() => import('@/views/account/Settings')),
        authority: [ADMIN, USER],
        meta: {
            header: 'Settings',
            headerContainer: true,
        },
    },
    {
        key: 'appsAccount.invoice',
        path: `${APP_PREFIX_PATH}/account/invoice/:id`,
        component: lazy(() => import('@/views/account/Invoice')),
        authority: [ADMIN, USER],
    },
    {
        key: 'appsAccount.activityLog',
        path: `${APP_PREFIX_PATH}/account/activity-log`,
        component: lazy(() => import('@/views/account/ActivityLog')),
        authority: [ADMIN, USER],
    },
    {
        key: 'appsAccount.kycForm',
        path: `${APP_PREFIX_PATH}/account/kyc-form`,
        component: lazy(() => import('@/views/account/KycForm')),
        authority: [ADMIN, USER],
    },
    // Settings
    {
        key: 'appsSettings.orderStatuses',
        path: `${APP_PREFIX_PATH}/settings/order-statuses`,
        component: lazy(() => import('@/views/settings/OrderStatuses')),
        authority: [ADMIN, USER],
    },
    {
        key: 'appsSettings.products',
        path: `${APP_PREFIX_PATH}/settings/products`,
        component: lazy(() => import('@/views/settings/ProductSettings')),
        authority: [ADMIN, USER],
    },
    {
        key: 'appsSettings.customerStatuses',
        path: `${APP_PREFIX_PATH}/settings/customer-statuses`,
        component: lazy(() => import('@/views/settings/CustomerStatuses')),
        authority: [ADMIN, USER],
    },
    {
        key: 'appsSettings.expenses',
        path: `${APP_PREFIX_PATH}/settings/expenses`,
        component: lazy(() => import('@/views/settings/ExpenseSettings')),
        authority: [ADMIN, USER],
    },
    {
        key: 'appsSettings.paymentMethods',
        path: `${APP_PREFIX_PATH}/settings/payment-methods`,
        component: lazy(() => import('@/views/settings/PaymentMethods')),
        authority: [ADMIN, USER],
    },
    {
        key: 'appsSettings.systemConfig',
        path: `${APP_PREFIX_PATH}/settings/system-config`,
        component: lazy(() => import('@/views/settings/SystemConfig')),
        authority: [ADMIN, USER],
    },
    // Users
    {
        key: 'appsUsers.userList',
        path: `${APP_PREFIX_PATH}/users/list`,
        component: lazy(() => import('@/views/users/UsersList/UsersList')),
        authority: [ADMIN, USER],
    },
    {
        key: 'appsUsers.userNew',
        path: `${APP_PREFIX_PATH}/users/new`,
        component: lazy(() => import('@/views/users/UserNew/UserNew')),
        authority: [ADMIN, USER],
        meta: {
            header: lazy(() => import('@/views/users/UserNew/HeaderTitle')),
        },
    },
]

export default appsRoute
