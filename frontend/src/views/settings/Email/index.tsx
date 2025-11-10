import { useMemo } from 'react'
import Tabs from '@/components/ui/Tabs'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import EmailSettings from '../EmailSettings'
import EmailConfigurationForm from '../EmailSettings/components/EmailConfigurationForm'
import MercadoPagoSettings from '../MercadoPagoSettings'
import GoogleSettings from '../GoogleSettings'

const { TabList, TabNav, TabContent } = Tabs

const normalizeEmailTab = (value: string | null) => (value === 'templates' ? 'templates' : 'config')
const SECTION_OPTIONS = ['email', 'mercadoPago', 'google'] as const

type EmailTabValue = 'config' | 'templates'
type SectionValue = (typeof SECTION_OPTIONS)[number]

const normalizeSection = (value: string | null): SectionValue => {
    if (value && SECTION_OPTIONS.includes(value as SectionValue)) {
        return value as SectionValue
    }
    return 'email'
}

const Email = () => {
    const { t } = useTranslation()
    const [searchParams, setSearchParams] = useSearchParams()

    const activeSection = useMemo(() => normalizeSection(searchParams.get('section')), [searchParams])
    const activeEmailTab = useMemo(() => normalizeEmailTab(searchParams.get('tab')), [searchParams]) as EmailTabValue

    const updateSearchParams = (section: SectionValue, emailTab: EmailTabValue = activeEmailTab) => {
        const params = new URLSearchParams()
        if (section !== 'email') {
            params.set('section', section)
        }
        if (section === 'email' && emailTab === 'templates') {
            params.set('tab', 'templates')
        }
        setSearchParams(params, { replace: true })
    }

    const handleSectionChange = (value: string | number) => {
        const nextSection = normalizeSection(String(value))
        updateSearchParams(nextSection)
    }

    const handleEmailTabChange = (value: string | number) => {
        const tab = normalizeEmailTab(String(value))
        updateSearchParams('email', tab)
    }

    return (
        <div className="space-y-6">
            <Tabs value={activeSection} onChange={handleSectionChange}>
                <TabList>
                    <TabNav value="email">{t('settings.email.sections.email', { defaultValue: 'Email' })}</TabNav>
                    <TabNav value="mercadoPago">{t('settings.email.sections.mercadoPago', { defaultValue: 'Mercado Pago' })}</TabNav>
                    <TabNav value="google">
                        {t('settings.email.sections.google', { defaultValue: 'Google & reCAPTCHA' })}
                    </TabNav>
                </TabList>
                <TabContent value="email">
                    <div className="mt-6">
                        <Tabs value={activeEmailTab} onChange={handleEmailTabChange}>
                            <TabList>
                                <TabNav value="config">
                                    {t('settings.email.tabs.config', { defaultValue: 'Configuration' })}
                                </TabNav>
                                <TabNav value="templates">
                                    {t('settings.email.tabs.templates', { defaultValue: 'Templates' })}
                                </TabNav>
                            </TabList>
                            <TabContent value="config">
                                <EmailConfigurationForm />
                            </TabContent>
                            <TabContent value="templates">
                                <EmailSettings />
                            </TabContent>
                        </Tabs>
                    </div>
                </TabContent>
                <TabContent value="mercadoPago">
                    <div className="mt-6">
                        <MercadoPagoSettings />
                    </div>
                </TabContent>
                <TabContent value="google">
                    <div className="mt-6">
                        <GoogleSettings />
                    </div>
                </TabContent>
            </Tabs>
        </div>
    )
}

export default Email
