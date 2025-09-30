import Radio from '@/components/ui/Radio'
import { setNavMode, useAppSelector, useAppDispatch } from '@/store'
import { NAV_MODE_THEMED } from '@/constants/theme.constant'
import { useTranslation } from 'react-i18next'

type NavModeParam = 'default' | 'themed'

const NavModeSwitcher = () => {
    const navMode = useAppSelector((state) => state.theme.navMode)
    const dispatch = useAppDispatch()
    const { t } = useTranslation()

    const onSetNavMode = (val: NavModeParam) => {
        dispatch(setNavMode(val))
    }

    return (
        <Radio.Group
            value={navMode === NAV_MODE_THEMED ? NAV_MODE_THEMED : 'default'}
            onChange={onSetNavMode}
        >
            <Radio value="default">{t('theme.config.navMode.default')}</Radio>
            <Radio value={NAV_MODE_THEMED}>{t('theme.config.navMode.themed')}</Radio>
        </Radio.Group>
    )
}

export default NavModeSwitcher
