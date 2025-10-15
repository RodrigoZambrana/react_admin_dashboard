import { useCallback, useMemo, useState } from 'react'
import { useLocation, useNavigate, matchPath } from 'react-router-dom'
import classNames from 'classnames'
import {
    HiOutlineCalendar,
    HiOutlineClipboardList,
    HiOutlineHome,
    HiOutlinePlusCircle,
    HiOutlineUserAdd,
} from 'react-icons/hi'
import type { IconType } from 'react-icons'
import { useTranslation } from 'react-i18next'
import AddCustomerDrawer from '@/components/shared/AddCustomerDrawer'
import useResponsive from '@/utils/hooks/useResponsive'

type MobileNavItem = {
    key: string
    label: string
    icon: IconType
    to?: string
    action?: () => void
}

const NAV_HEIGHT = 72
const NAV_SPACER = NAV_HEIGHT + 16

const MobileBottomNav = () => {
    const { smaller } = useResponsive()
    const showNav = smaller.md

    const { t } = useTranslation()
    const navigate = useNavigate()
    const location = useLocation()

    const [isCustomerDrawerOpen, setCustomerDrawerOpen] = useState(false)

    const broadcastDrawerClose = useCallback(() => {
        window.dispatchEvent(new Event('app:drawer-close-all'))
    }, [])

    const openCustomerDrawer = useCallback(() => {
        setCustomerDrawerOpen(true)
    }, [])

    const closeCustomerDrawer = useCallback(() => {
        setCustomerDrawerOpen(false)
    }, [])

    const navItems = useMemo<MobileNavItem[]>(
        () => [
            {
                key: 'home',
                label: t('text.mobileNav.home', { defaultValue: 'Home' }),
                icon: HiOutlineHome,
                to: '/app/sales/dashboard',
            },
            {
                key: 'agenda',
                label: t('text.mobileNav.agenda', {
                    defaultValue: 'Agenda',
                }),
                icon: HiOutlineClipboardList,
                to: '/app/calendar/activities',
            },
            {
                key: 'calendar',
                label: t('text.mobileNav.calendar', {
                    defaultValue: 'Calendar',
                }),
                icon: HiOutlineCalendar,
                to: '/app/calendar/schedule',
            },
            {
                key: 'addCustomer',
                label: t('text.mobileNav.addCustomer', {
                    defaultValue: 'Add Client',
                }),
                icon: HiOutlineUserAdd,
                action: openCustomerDrawer,
            },
            {
                key: 'addOrder',
                label: t('text.mobileNav.addOrder', {
                    defaultValue: 'Add Order',
                }),
                icon: HiOutlinePlusCircle,
                to: '/app/sales/order-new',
            },
        ],
        [t, openCustomerDrawer],
    )

    const handleItemClick = (item: MobileNavItem) => {
        if (item.action) {
            broadcastDrawerClose()
            item.action()
            return
        }
        closeCustomerDrawer()
        broadcastDrawerClose()
        if (item.to && location.pathname !== item.to) {
            navigate(item.to)
        }
    }

    const isItemActive = (item: MobileNavItem) => {
        if (!item.to) {
            return false
        }

        return Boolean(
            matchPath(
                { path: item.to, end: item.to === '/app/sales/dashboard' },
                location.pathname,
            ),
        )
    }

    if (!showNav) {
        return null
    }

    return (
        <>
            <div
                className="md:hidden"
                style={{ height: `${NAV_SPACER}px` }}
                aria-hidden="true"
            />
            <nav
                className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t border-gray-200 dark:border-gray-700 bg-white/95 dark:bg-gray-900/95 backdrop-blur"
                style={{ height: `${NAV_HEIGHT}px` }}
            >
                <ul className="flex h-full items-center justify-between px-2 pt-2 pb-3">
                    {navItems.map((item) => {
                        const ActiveIcon = item.icon
                        const active = isItemActive(item)
                        return (
                            <li key={item.key} className="flex-1">
                                <button
                                    type="button"
                                    className={classNames(
                                        'flex flex-col items-center justify-center gap-1 w-full h-full text-xs font-medium transition-colors',
                                        active
                                            ? 'text-indigo-600 dark:text-indigo-400'
                                            : 'text-gray-500 dark:text-gray-300',
                                    )}
                                    onClick={() => handleItemClick(item)}
                                    aria-label={item.label}
                                    aria-current={
                                        active ? 'page' : undefined
                                    }
                                >
                                    <ActiveIcon className="text-xl" />
                                    <span className="leading-tight">
                                        {item.label}
                                    </span>
                                </button>
                            </li>
                        )
                    })}
                </ul>
            </nav>
            <AddCustomerDrawer
                isOpen={isCustomerDrawerOpen}
                onClose={closeCustomerDrawer}
            />
        </>
    )
}

export default MobileBottomNav
