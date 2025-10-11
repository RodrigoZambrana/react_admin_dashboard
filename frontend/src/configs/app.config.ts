export type AppConfig = {
    apiPrefix: string
    authenticatedEntryPath: string
    unAuthenticatedEntryPath: string
    tourPath: string
    locale: string
    enableMock: boolean
    recaptchaSiteKey?: string
}

const isRecaptchaEnabled =
    String(import.meta.env.VITE_RECAPTCHA_ENABLED || '').toLowerCase() === 'true'
const siteKey = isRecaptchaEnabled ? import.meta.env.VITE_RECAPTCHA_SITE_KEY || '' : ''

const appConfig: AppConfig = {
    apiPrefix: '/api',
    authenticatedEntryPath: '/app/sales/dashboard',
    unAuthenticatedEntryPath: '/sign-in',
    tourPath: '/app/account/kyc-form',
    locale: 'en',
    enableMock: false,
    recaptchaSiteKey: siteKey,
}

export default appConfig
