import ModeSwitcher from './ModeSwitcher'
import LayoutSwitcher from './LayoutSwitcher'
import ThemeSwitcher from './ThemeSwitcher'
import DirectionSwitcher from './DirectionSwitcher'
import NavModeSwitcher from './NavModeSwitcher'
import CopyButton from './CopyButton'

export type ThemeConfiguratorProps = {
    callBackClose?: () => void
}

import { useTranslation } from 'react-i18next'

const ThemeConfigurator = ({ callBackClose }: ThemeConfiguratorProps) => {
    const { t } = useTranslation()
    return (
        <div className="flex flex-col h-full justify-between">
            <div className="flex flex-col gap-y-10 mb-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h6>{t('theme.config.darkMode.title')}</h6>
                        <span>{t('theme.config.darkMode.desc')}</span>
                    </div>
                    <ModeSwitcher />
                </div>
                <div className="flex items-center justify-between">
                    <div>
                        <h6>{t('theme.config.direction.title')}</h6>
                        <span>{t('theme.config.direction.desc')}</span>
                    </div>
                    <DirectionSwitcher callBackClose={callBackClose} />
                </div>
                <div>
                    <h6 className="mb-3">{t('theme.config.navMode.title')}</h6>
                    <NavModeSwitcher />
                </div>
                <div>
                    <h6 className="mb-3">{t('theme.config.theme.title')}</h6>
                    <ThemeSwitcher />
                </div>
                <div>
                    <h6 className="mb-3">{t('theme.config.layout.title')}</h6>
                    <LayoutSwitcher />
                </div>
            </div>
            <CopyButton />
        </div>
    )
}

export default ThemeConfigurator
