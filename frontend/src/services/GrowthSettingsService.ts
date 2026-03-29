import ApiService from './ApiService'

export type GrowthSettingsConfig = {
    googleAnalyticsEnabled: boolean
    googleAnalyticsMeasurementId: string
    googleTagManagerEnabled: boolean
    googleTagManagerContainerId: string
    googleAdsEnabled: boolean
    googleAdsConversionId: string
    googleAdsConversionLabel: string
    googleSearchConsoleVerificationToken: string
    metaPixelEnabled: boolean
    metaPixelId: string
    metaConversionsApiEnabled: boolean
    metaConversionsApiToken: string
    metaAdsAccountId: string
    contentInsightsEnabled: boolean
}

export type GrowthSettingsOverview = {
    config: {
        googleAnalyticsEnabled: boolean
        googleAnalyticsMeasurementId: string | null
        googleTagManagerEnabled: boolean
        googleTagManagerContainerId: string | null
        googleAdsEnabled: boolean
        googleAdsConversionId: string | null
        googleAdsConversionLabel: string | null
        googleSearchConsoleVerificationToken: string | null
        metaPixelEnabled: boolean
        metaPixelId: string | null
        metaConversionsApiEnabled: boolean
        metaConversionsApiToken: string | null
        metaAdsAccountId: string | null
        contentInsightsEnabled: boolean
    }
    meta: {
        source: 'environment' | 'database'
        updatedAt: string | null
    }
    readiness: {
        googleAnalyticsReady: boolean
        googleTagManagerReady: boolean
        googleAdsReady: boolean
        googleSearchConsoleReady: boolean
        metaPixelReady: boolean
        metaConversionsApiReady: boolean
    }
    publicConfig: {
        google: {
            analytics: {
                enabled: boolean
                measurementId: string | null
            }
            tagManager: {
                enabled: boolean
                containerId: string | null
            }
            ads: {
                enabled: boolean
                conversionId: string | null
                conversionLabel: string | null
            }
            searchConsole: {
                verificationToken: string | null
            }
        }
        meta: {
            pixel: {
                enabled: boolean
                pixelId: string | null
            }
        }
        insights: {
            content: {
                enabled: boolean
            }
        }
    }
}

const GrowthSettingsService = {
    getOverview() {
        return ApiService.fetchData<GrowthSettingsOverview>({
            url: '/settings/growth',
            method: 'get',
        })
    },

    updateConfig(payload: Partial<GrowthSettingsConfig>) {
        return ApiService.fetchData<GrowthSettingsOverview>({
            url: '/settings/growth',
            method: 'put',
            data: payload,
        })
    },
}

export default GrowthSettingsService
