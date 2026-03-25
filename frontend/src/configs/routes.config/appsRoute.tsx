import { lazy } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { APP_PREFIX_PATH } from '@/constants/route.constant'
import { FEATURES, getRolesForFeature } from '@/constants/roleAccess.constant'
import type { Routes } from '@/@types/routes'
import { applyClientRouteOverrides, clientConfig } from '../clientConfig'

const createRedirect = (path: string) => () => <Navigate replace to={path} />

const LegacyExpenseDetailRedirect = () => {
    const { expenseId = '' } = useParams<{ expenseId?: string }>()
    return (
        <Navigate
            replace
            to={`${APP_PREFIX_PATH}/accounting/expenses/detail/${expenseId}`}
        />
    )
}

const LegacyExpenseEditRedirect = () => {
    const { expenseId = '' } = useParams<{ expenseId?: string }>()
    return (
        <Navigate
            replace
            to={`${APP_PREFIX_PATH}/accounting/expenses/edit/${expenseId}`}
        />
    )
}

const isUrucortinas = clientConfig.slug === 'urucortinas'
const hasParametricProducts = Boolean(
    clientConfig.featureFlags?.PARAMETRIC_PRODUCTS,
)

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
        key: 'appsCrm.conversations',
        path: `${APP_PREFIX_PATH}/crm/conversations`,
        component: lazy(() => import('@/views/crm/ConversationsV2')),
        authority: getRolesForFeature(FEATURES.CUSTOMERS),
        meta: {
            pageContainerType: 'gutterless',
            footer: false,
            header: 'Conversations',
        },
    },
    {
        key: 'appsCrm.conversationDetails',
        path: `${APP_PREFIX_PATH}/crm/conversations/:conversationId`,
        component: lazy(() => import('@/views/crm/ConversationsV2')),
        authority: getRolesForFeature(FEATURES.CUSTOMERS),
        meta: {
            pageContainerType: 'gutterless',
            footer: false,
            header: 'Conversations',
        },
    },
    {
        key: 'appsCrm.conversationsLegacy',
        path: `${APP_PREFIX_PATH}/crm/conversations-v2`,
        component: lazy(() => import('@/views/crm/Conversations')),
        authority: getRolesForFeature(FEATURES.CUSTOMERS),
        meta: {
            pageContainerType: 'gutterless',
            footer: false,
            header: 'Conversations V2',
        },
    },
    {
        key: 'appsCrm.conversationDetailsLegacy',
        path: `${APP_PREFIX_PATH}/crm/conversations-v2/:conversationId`,
        component: lazy(() => import('@/views/crm/Conversations')),
        authority: getRolesForFeature(FEATURES.CUSTOMERS),
        meta: {
            pageContainerType: 'gutterless',
            footer: false,
            header: 'Conversations V2',
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
            header: lazy(() => import('@/views/accounting/Payments/HeaderTitle')),
        },
    },
    {
        key: 'appsProducts.productList',
        path: `${APP_PREFIX_PATH}/products/list`,
        component: lazy(() => import('@/views/sales/ProductList')),
        authority: getRolesForFeature(FEATURES.PRODUCTS),
        meta: {
            header: 'Product List',
        },
    },
    {
        key: 'appsProducts.config',
        path: `${APP_PREFIX_PATH}/products/config`,
        component: lazy(() => import('@/views/settings/ProductSettings')),
        authority: getRolesForFeature(FEATURES.PRODUCTS),
        meta: {
            header: lazy(() => import('@/views/settings/ProductSettings/HeaderTitle')),
        },
    },
    {
        key: 'appsSettings.qa',
        path: `${APP_PREFIX_PATH}/settings/qa`,
        component: lazy(() => import('@/views/settings/QaCenter')),
        authority: getRolesForFeature(FEATURES.SETTINGS),
        meta: {
            header: 'QA Center',
        },
    },
    {
        key: 'appsSettings.ai',
        path: `${APP_PREFIX_PATH}/settings/ai`,
        component: lazy(() => import('@/views/settings/AiRuntimeSettings')),
        authority: getRolesForFeature(FEATURES.SETTINGS),
        meta: {
            header: 'AI Runtime',
        },
    },
    ...(hasParametricProducts
        ? isUrucortinas
            ? [
                  {
                      key: 'appsAberturas.list',
                      path: `${APP_PREFIX_PATH}/aberturas/list`,
                      component: lazy(() => import('@/views/sales/ProductList')),
                      authority: getRolesForFeature(FEATURES.PRODUCTS),
                      meta: {
                          header: 'Aberturas',
                      },
                  },
                  {
                      key: 'appsAberturas.quote',
                      path: `${APP_PREFIX_PATH}/aberturas/quote`,
                      component: lazy(() => import('@/views/sales/AberturasQuote')),
                      authority: getRolesForFeature(FEATURES.PRODUCTS),
                      meta: {
                          header: 'Presupuestar Aberturas',
                      },
                  },
                  {
                      key: 'appsAberturas.config',
                      path: `${APP_PREFIX_PATH}/aberturas/config`,
                      component: lazy(() => import('@/views/settings/AberturasGlossary')),
                      authority: getRolesForFeature(FEATURES.PRODUCTS),
                      meta: {
                          header: 'Aberturas',
                      },
                  },
              ]
            : [
                  {
                      key: 'appsProducts.parametric',
                      path: `${APP_PREFIX_PATH}/products/parametric`,
                      component: lazy(() => import('@/views/sales/ProductList')),
                      authority: getRolesForFeature(FEATURES.PRODUCTS),
                      meta: {
                          header: 'Parametric Products',
                      },
                  },
                  {
                      key: 'appsProducts.parametricQuote',
                      path: `${APP_PREFIX_PATH}/products/parametric/quote`,
                      component: lazy(() => import('@/views/sales/AberturasQuote')),
                      authority: getRolesForFeature(FEATURES.PRODUCTS),
                      meta: {
                          header: 'Presupuestar Aberturas',
                      },
                  },
              ]
        : []),
    {
        key: 'appsProducts.productEdit',
        path: `${APP_PREFIX_PATH}/products/edit/:productId`,
        component: lazy(() => import('@/views/sales/ProductEdit')),
        authority: getRolesForFeature(FEATURES.PRODUCTS),
        meta: {
            header: 'Edit Product',
        },
    },
    ...(isUrucortinas && hasParametricProducts
        ? [
              {
                  key: 'appsProducts.parametricLegacy',
                  path: `${APP_PREFIX_PATH}/products/parametric`,
                  component: lazy(() => import('@/views/sales/ProductList')),
                  authority: getRolesForFeature(FEATURES.PRODUCTS),
                  meta: {
                      header: 'Aberturas',
                  },
              },
              {
                  key: 'appsProducts.parametricQuoteLegacy',
                  path: `${APP_PREFIX_PATH}/products/parametric/quote`,
                  component: lazy(() => import('@/views/sales/AberturasQuote')),
                  authority: getRolesForFeature(FEATURES.PRODUCTS),
                  meta: {
                      header: 'Presupuestar Aberturas',
                  },
              },
              {
                  key: 'appsSettings.aberturasGlossaryLegacy',
                  path: `${APP_PREFIX_PATH}/settings/aberturas`,
                  component: lazy(() => import('@/views/settings/AberturasGlossary')),
                  authority: getRolesForFeature(FEATURES.PRODUCTS),
                  meta: {
                      header: 'Aberturas',
                  },
              },
          ]
        : []),
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
    {
        key: 'appsSales.shippingOptions',
        path: `${APP_PREFIX_PATH}/sales/shipping-options`,
        component: lazy(() => import('@/views/settings/ShippingOptions')),
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
        key: 'appsAccounting.expensesBase',
        path: `${APP_PREFIX_PATH}/accounting/expenses`,
        component: createRedirect(`${APP_PREFIX_PATH}/accounting/expenses/list`),
        authority: getRolesForFeature(FEATURES.EXPENSES),
    },
    {
        key: 'appsAccounting.expensesDashboard',
        path: `${APP_PREFIX_PATH}/accounting/expenses/dashboard`,
        component: lazy(() => import('@/views/expenses/ExpensesDashboard/ExpensesDashboard')),
        authority: getRolesForFeature(FEATURES.EXPENSES),
    },
    {
        key: 'appsAccounting.expensesList',
        path: `${APP_PREFIX_PATH}/accounting/expenses/list`,
        component: lazy(() => import('@/views/expenses/ExpenseList')),
        authority: getRolesForFeature(FEATURES.EXPENSES),
    },
    {
        key: 'appsAccounting.expensesNew',
        path: `${APP_PREFIX_PATH}/accounting/expenses/new`,
        component: lazy(() => import('@/views/expenses/ExpenseNew')),
        authority: getRolesForFeature(FEATURES.EXPENSES),
    },
    {
        key: 'appsAccounting.expensesDetail',
        path: `${APP_PREFIX_PATH}/accounting/expenses/detail/:expenseId`,
        component: lazy(() => import('@/views/expenses/ExpenseDetail')),
        authority: getRolesForFeature(FEATURES.EXPENSES),
        meta: {
            header: lazy(() => import('@/views/expenses/ExpenseDetail/HeaderTitle')),
        },
    },
    {
        key: 'appsAccounting.expensesEdit',
        path: `${APP_PREFIX_PATH}/accounting/expenses/edit/:expenseId`,
        component: lazy(() => import('@/views/expenses/ExpenseEdit')),
        authority: getRolesForFeature(FEATURES.EXPENSES),
        meta: {
            header: 'Edit Expense',
        },
    },
    {
        key: 'appsAccounting.expensesCategories',
        path: `${APP_PREFIX_PATH}/accounting/expenses/categories`,
        component: lazy(() => import('@/views/expenses/Categories')),
        authority: getRolesForFeature(FEATURES.EXPENSES),
    },
    {
        key: 'appsAccounting.expensesConfig',
        path: `${APP_PREFIX_PATH}/accounting/expenses/config`,
        component: lazy(() => import('@/views/settings/ExpenseSettings')),
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
    // Legacy redirects
    {
        key: 'legacy.settings.products',
        path: `${APP_PREFIX_PATH}/settings/products`,
        component: createRedirect(`${APP_PREFIX_PATH}/products/config`),
        authority: getRolesForFeature(FEATURES.SETTINGS),
    },
    {
        key: 'legacy.settings.expenses',
        path: `${APP_PREFIX_PATH}/settings/expenses`,
        component: createRedirect(`${APP_PREFIX_PATH}/accounting/expenses/config`),
        authority: getRolesForFeature(FEATURES.SETTINGS),
    },
    {
        key: 'legacy.settings.shippingOptions',
        path: `${APP_PREFIX_PATH}/settings/shipping-options`,
        component: createRedirect(`${APP_PREFIX_PATH}/sales/shipping-options`),
        authority: getRolesForFeature(FEATURES.SETTINGS),
    },
    {
        key: 'legacy.settings.customerStatuses',
        path: `${APP_PREFIX_PATH}/settings/customer-statuses`,
        component: createRedirect(`${APP_PREFIX_PATH}/crm/customers`),
        authority: getRolesForFeature(FEATURES.SETTINGS),
    },
    {
        key: 'legacy.expenses.list',
        path: `${APP_PREFIX_PATH}/expenses/expense-list`,
        component: createRedirect(`${APP_PREFIX_PATH}/accounting/expenses/list`),
        authority: getRolesForFeature(FEATURES.EXPENSES),
    },
    {
        key: 'legacy.expenses.new',
        path: `${APP_PREFIX_PATH}/expenses/expense-new`,
        component: createRedirect(`${APP_PREFIX_PATH}/accounting/expenses/new`),
        authority: getRolesForFeature(FEATURES.EXPENSES),
    },
    {
        key: 'legacy.expenses.detail',
        path: `${APP_PREFIX_PATH}/expenses/expense-detail/:expenseId`,
        component: LegacyExpenseDetailRedirect,
        authority: getRolesForFeature(FEATURES.EXPENSES),
    },
    {
        key: 'legacy.expenses.edit',
        path: `${APP_PREFIX_PATH}/expenses/expense-edit/:expenseId`,
        component: LegacyExpenseEditRedirect,
        authority: getRolesForFeature(FEATURES.EXPENSES),
    },
    {
        key: 'legacy.expenses.categories',
        path: `${APP_PREFIX_PATH}/expenses/categories`,
        component: createRedirect(`${APP_PREFIX_PATH}/accounting/expenses/categories`),
        authority: getRolesForFeature(FEATURES.EXPENSES),
    },
    {
        key: 'legacy.expenses.dashboard',
        path: `${APP_PREFIX_PATH}/expenses/dashboard`,
        component: createRedirect(`${APP_PREFIX_PATH}/accounting/expenses/dashboard`),
        authority: getRolesForFeature(FEATURES.EXPENSES),
    },
    // Settings
    {
        key: 'appsSettings.companyProfile',
        path: `${APP_PREFIX_PATH}/settings/company-profile`,
        component: lazy(() => import('@/views/settings/CompanyProfile')),
        authority: getRolesForFeature(FEATURES.SETTINGS),
    },
    {
        key: 'appsSettings.google',
        path: `${APP_PREFIX_PATH}/settings/google`,
        component: lazy(() => import('@/views/settings/EmailSettings/GoogleSettingsRedirect')),
        authority: getRolesForFeature(FEATURES.SETTINGS),
    },
    {
        key: 'appsSettings.mercadoPago',
        path: `${APP_PREFIX_PATH}/settings/mercado-pago`,
        component: lazy(() => import('@/views/settings/EmailSettings/MercadoPagoSettingsRedirect')),
        authority: getRolesForFeature(FEATURES.SETTINGS),
    },
    {
        key: 'appsSettings.systemConfig',
        path: `${APP_PREFIX_PATH}/settings/system-config`,
        component: lazy(() => import('@/views/settings/SystemConfig')),
        authority: getRolesForFeature(FEATURES.SETTINGS),
    },
    {
        key: 'appsSettings.emailRoot',
        path: `${APP_PREFIX_PATH}/settings/email`,
        component: lazy(() => import('@/views/settings/EmailSettings/EmailSettingsRedirect')),
        authority: getRolesForFeature(FEATURES.SETTINGS),
    },
    {
        key: 'appsSettings.emailConfig',
        path: `${APP_PREFIX_PATH}/settings/email/config`,
        component: lazy(() => import('@/views/settings/Email')),
        authority: getRolesForFeature(FEATURES.SETTINGS),
    },
    {
        key: 'appsSettings.emailTemplates',
        path: `${APP_PREFIX_PATH}/settings/email/templates`,
        component: lazy(() => import('@/views/settings/EmailSettings/EmailTemplatesRedirect')),
        authority: getRolesForFeature(FEATURES.SETTINGS),
    },
    {
        key: 'appsSettings.calendarEventTypes',
        path: `${APP_PREFIX_PATH}/settings/calendar-event-types`,
        component: lazy(() => import('@/views/settings/CalendarEventTypes')),
        authority: getRolesForFeature(FEATURES.SETTINGS),
    },
    {
        key: 'appsCms.content',
        path: `${APP_PREFIX_PATH}/cms/content`,
        component: lazy(() => import('@/views/cms/ContentManager')),
        authority: getRolesForFeature(FEATURES.SETTINGS),
        meta: {
            header: 'CMS Content',
        },
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
