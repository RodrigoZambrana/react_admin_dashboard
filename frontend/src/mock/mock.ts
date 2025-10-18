import { createServer } from 'miragejs'
import appConfig from '@/configs/app.config'
import { notificationListData, searchQueryPoolData } from './data/commonData'
import {
    projectList,
    scrumboardData,
    issueData,
    projectDashboardData,
} from './data/projectData'
import { usersData, userDetailData } from './data/usersData'
import { mailData, crmDashboardData } from './data/crmData'
import { eventsData, activityDetailData } from './data/calendarData'
import {
    productsData,
    ordersData,
    orderDetailsData,
    salesDashboardData,
} from './data/salesData'
import {
    expensesData,
    expensesDashboardData,
    expenseCategoriesData,
} from './data/expensesData'
import {
    portfolioData,
    walletsData,
    marketData,
    transactionHistoryData,
    cryptoDashboardData,
} from './data/cryptoData'
import {
    settingData,
    settingIntergrationData,
    settingBillingData,
    invoiceData,
    logData,
    accountFormData,
} from './data/accountData'
import {
    helpCenterCategoriesData,
    helpCenterArticleListData,
} from './data/knowledgeBaseData'
import { signInUserData } from './data/authData'
import {
    orderStatusesData,
    customerStatusesData,
    expenseStatusesData,
    productCategoriesData,
    paymentMethodsData,
} from './data/settingsData'

import {
    commonFakeApi,
    projectFakeApi,
    crmFakeApi,
    salesFakeApi,
    expensesFakeApi,
    accountingFakeApi,
    accountFakeApi,
    cryptoFakeApi,
    authFakeApi,
    knowledgeBaseFakeApi,
    usersFakeApi,
    calendarFakeApi,
    settingsFakeApi,
} from './fakeApi'

const { apiPrefix } = appConfig

export function mockServer({ environment = 'test' }) {
    return createServer({
        environment,
        seeds(server) {
            server.db.loadData({
                notificationListData,
                searchQueryPoolData,
                projectList,
                scrumboardData,
                issueData,
                usersData,
                userDetailData,
                eventsData,
                mailData,
                productsData,
                ordersData,
                orderDetailsData,
                settingData,
                settingIntergrationData,
                settingBillingData,
                invoiceData,
                logData,
                accountFormData,
                portfolioData,
                walletsData,
                marketData,
                transactionHistoryData,
                helpCenterCategoriesData,
                helpCenterArticleListData,
                signInUserData,
                salesDashboardData,
                expensesDashboardData,
                expenseCategoriesData,
                orderStatusesData,
                customerStatusesData,
                expenseStatusesData,
                productCategoriesData,
                paymentMethodsData,
                crmDashboardData,
                projectDashboardData,
                cryptoDashboardData,
                activityDetailData,
                expensesData,
            })
        },
        routes() {
            this.urlPrefix = ''
            this.namespace = ''
            this.passthrough((request) => {
                const isExternal = request.url.startsWith('http')
                const isResource = request.url.startsWith('data:text')
                return isExternal || isResource
            })
            this.passthrough()

            commonFakeApi(this, apiPrefix)
            projectFakeApi(this, apiPrefix)
            crmFakeApi(this, apiPrefix)
            salesFakeApi(this, apiPrefix)
            expensesFakeApi(this, apiPrefix)
            accountingFakeApi(this, apiPrefix)
            settingsFakeApi(this, apiPrefix)
            accountFakeApi(this, apiPrefix)
            authFakeApi(this, apiPrefix)
            cryptoFakeApi(this, apiPrefix)
            knowledgeBaseFakeApi(this, apiPrefix)
            usersFakeApi(this, apiPrefix)
            calendarFakeApi(this, apiPrefix)
        },
    })
}
