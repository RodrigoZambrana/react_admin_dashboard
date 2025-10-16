import { useState, Suspense, lazy, useCallback, useEffect } from 'react'
import classNames from 'classnames'
import Drawer from '@/components/ui/Drawer'
import {
    NAV_MODE_THEMED,
    NAV_MODE_TRANSPARENT,
    DIR_RTL,
} from '@/constants/theme.constant'
import withHeaderItem, { WithHeaderItemProps } from '@/utils/hoc/withHeaderItem'
import NavToggle from '@/components/shared/NavToggle'
import navigationConfig from '@/configs/navigation.config'
import useResponsive from '@/utils/hooks/useResponsive'
import { useAppSelector } from '@/store'
import { useTranslation } from 'react-i18next'

const VerticalMenuContent = lazy(
    () => import('@/components/template/VerticalMenuContent'),
)

type MobileNavToggleProps = {
    toggled?: boolean
}

const MobileNavToggle = withHeaderItem<
    MobileNavToggleProps & WithHeaderItemProps
>(NavToggle)

const MobileNav = () => {
    const [isOpen, setIsOpen] = useState(false)
    const { t } = useTranslation()

    const openDrawer = useCallback(() => {
        setIsOpen(true)
    }, [])

    const onDrawerClose = useCallback(() => {
        setIsOpen(false)
    }, [])

    const themeColor = useAppSelector((state) => state.theme.themeColor)
    const primaryColorLevel = useAppSelector(
        (state) => state.theme.primaryColorLevel,
    )
    const navMode = useAppSelector((state) => state.theme.navMode)
    const mode = useAppSelector((state) => state.theme.mode)
    const direction = useAppSelector((state) => state.theme.direction)
    const currentRouteKey = useAppSelector(
        (state) => state.base.common.currentRouteKey,
    )

    const userAuthority = useAppSelector((state) => state.auth.user.authority)

    const { smaller } = useResponsive()

    useEffect(() => {
        const openHandler = () => openDrawer()
        const toggleHandler = () => setIsOpen((prev) => !prev)
        const closeHandler = () => setIsOpen(false)
        window.addEventListener('app:mobile-nav-open', openHandler)
        window.addEventListener('app:mobile-nav-toggle', toggleHandler)
        window.addEventListener('app:drawer-close-all', closeHandler)
        return () => {
            window.removeEventListener('app:mobile-nav-open', openHandler)
            window.removeEventListener('app:mobile-nav-toggle', toggleHandler)
            window.removeEventListener('app:drawer-close-all', closeHandler)
        }
    }, [openDrawer])

    const navColor = () => {
        if (navMode === NAV_MODE_THEMED) {
            return `bg-${themeColor}-${primaryColorLevel} side-nav-${navMode}`
        }

        if (navMode === NAV_MODE_TRANSPARENT) {
            return `side-nav-${mode}`
        }

        return `side-nav-${navMode}`
    }

    return (
        <>
            {smaller.md && (
                <>
                    <button
                        type="button"
                        className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-200"
                        onClick={openDrawer}
                        aria-expanded={isOpen}
                        aria-label={t('text.mobileNav.menu', {
                            defaultValue: 'Menu',
                        })}
                    >
                        <span className="text-2xl leading-none">
                            <MobileNavToggle toggled={isOpen} />
                        </span>
                        <span>{t('text.mobileNav.menu', { defaultValue: 'Menu' })}</span>
                    </button>
                    <Drawer
                        title="Navigation"
                        isOpen={isOpen}
                        bodyClass={classNames(navColor(), 'p-0')}
                        width={330}
                        placement={direction === DIR_RTL ? 'right' : 'left'}
                        onClose={onDrawerClose}
                        onRequestClose={onDrawerClose}
                    >
                        <Suspense fallback={<></>}>
                            {isOpen && (
                                <VerticalMenuContent
                                    navMode={navMode}
                                    collapsed={false}
                                    navigationTree={navigationConfig}
                                    routeKey={currentRouteKey}
                                    userAuthority={userAuthority as string[]}
                                    direction={direction}
                                    onMenuItemClick={onDrawerClose}
                                />
                            )}
                        </Suspense>
                    </Drawer>
                </>
            )}
        </>
    )
}

export default MobileNav
