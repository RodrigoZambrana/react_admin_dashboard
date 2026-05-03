import { clientConfig } from './clientConfig'
import { APP_PREFIX_PATH } from '@/constants/route.constant'

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

const baseAppConfig: AppConfig = {
    apiPrefix: '/api',
    authenticatedEntryPath: `${APP_PREFIX_PATH}/sales/dashboard`,
    unAuthenticatedEntryPath: '/sign-in',
    tourPath: `${APP_PREFIX_PATH}/account/kyc-form`,
    locale: 'en',
    enableMock: false,
    recaptchaSiteKey: siteKey,
}

const overrideAppConfig = clientConfig.frontend?.app ?? {}
const cleanedOverrides = Object.fromEntries(
    Object.entries(overrideAppConfig).filter(([, value]) => value !== undefined),
) as Partial<AppConfig>

const appConfig: AppConfig = {
    ...baseAppConfig,
    ...cleanedOverrides,
}

export default appConfig
