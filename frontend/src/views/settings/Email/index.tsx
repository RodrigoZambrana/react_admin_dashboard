import { useMemo } from 'react'
import Tabs from '@/components/ui/Tabs'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import EmailSettings from '../EmailSettings'
import EmailConfigurationForm from '../EmailSettings/components/EmailConfigurationForm'

const { TabList, TabNav, TabContent } = Tabs

const normalizeTab = (value: string | null) => (value === 'templates' ? 'templates' : 'config')

type TabValue = 'config' | 'templates'

const Email = () => {
    const { t } = useTranslation()
    const [searchParams, setSearchParams] = useSearchParams()

    const activeTab = useMemo(() => normalizeTab(searchParams.get('tab')), [searchParams]) as TabValue

    const handleTabChange = (value: string | number) => {
        const tab = normalizeTab(String(value))
        if (tab === 'config') {
            setSearchParams({}, { replace: true })
        } else {
            setSearchParams({ tab }, { replace: true })
        }
    }

    return (
        <div className="space-y-6">
            <Tabs value={activeTab} onChange={handleTabChange}>
                <TabList>
                    <TabNav value="config">{t('settings.email.tabs.config', { defaultValue: 'Configuration' })}</TabNav>
                    <TabNav value="templates">{t('settings.email.tabs.templates', { defaultValue: 'Templates' })}</TabNav>
                </TabList>
                <TabContent value="config">
                    <EmailConfigurationForm />
                </TabContent>
                <TabContent value="templates">
                    <EmailSettings />
                </TabContent>
            </Tabs>
        </div>
    )
}

export default Email
