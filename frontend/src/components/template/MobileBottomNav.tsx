import { useCallback, useEffect, useMemo, useState } from 'react'
import { appPath } from '@/constants/route.constant'
import { useLocation, useNavigate, matchPath } from 'react-router-dom'
import classNames from 'classnames'
import {
    HiOutlineClipboardList,
    HiOutlineDocumentText,
    HiOutlineHome,
    HiOutlineMenuAlt2,
    HiOutlineChatAlt2,
    HiOutlinePlusCircle,
    HiOutlineUserAdd,
} from 'react-icons/hi'
import type { IconType } from 'react-icons'
import { useTranslation } from 'react-i18next'
import AddCustomerDrawer from '@/components/shared/AddCustomerDrawer'
import useResponsive from '@/utils/hooks/useResponsive'
import { clientConfig } from '@/configs/clientConfig'

type MobileNavItem = {
    key: string
    label: string
    icon: IconType
    to?: string
    action?: () => void
    skipCloseAll?: boolean
}

const NAV_HEIGHT = 72
const NAV_GAP = 12
const SAFE_AREA_INSET = 'env(safe-area-inset-bottom, 0px)'
const NAV_PLACEHOLDER_HEIGHT = `calc(${NAV_HEIGHT}px + ${NAV_GAP}px + ${SAFE_AREA_INSET})`

const MobileBottomNav = () => {
    const { smaller } = useResponsive()
    const showNav = smaller.md

    const { t } = useTranslation()
    const navigate = useNavigate()
    const location = useLocation()

    const [isCustomerDrawerOpen, setCustomerDrawerOpen] = useState(false)
    const isConversationRoute = location.pathname.startsWith(
        appPath('/crm/conversations'),
    )
    const isMailRoute = location.pathname.startsWith(appPath('/crm/mail'))

    const broadcastDrawerClose = useCallback(() => {
        window.dispatchEvent(new Event('app:drawer-close-all'))
    }, [])

    const openCustomerDrawer = useCallback(() => {
        setCustomerDrawerOpen(true)
    }, [])

    const closeCustomerDrawer = useCallback(() => {
        setCustomerDrawerOpen(false)
    }, [])

    const openMobileMenu = useCallback(() => {
        window.dispatchEvent(new Event('app:mobile-nav-toggle'))
    }, [])

    const navItems = useMemo<MobileNavItem[]>(() => {
        const items: MobileNavItem[] = [
            {
                key: 'menu',
                label: t('text.mobileNav.menu', {
                    defaultValue: 'Menu',
                }),
                icon: HiOutlineMenuAlt2,
                action: openMobileMenu,
                skipCloseAll: true,
            },
            {
                key: 'home',
                label: t('text.mobileNav.home', { defaultValue: 'Home' }),
                icon: HiOutlineHome,
                to: appPath('/sales/dashboard'),
            },
            {
                key: 'messages',
                label: t('text.mobileNav.messages', {
                    defaultValue: 'Messages',
                }),
                icon: HiOutlineChatAlt2,
                to: appPath('/crm/conversations'),
            },
            {
                key: 'agenda',
                label: t('text.mobileNav.agenda', {
                    defaultValue: 'Agenda',
                }),
                icon: HiOutlineClipboardList,
                to: appPath('/calendar/activities'),
            },
            {
                key: 'addCustomer',
                label: t('text.mobileNav.addCustomer', {
                    defaultValue: 'Add Client',
                }),
                icon: HiOutlineUserAdd,
                action: openCustomerDrawer,
            },
        ]
        if (clientConfig.featureFlags?.BUDGETS) {
            items.push({
                key: 'quickBudget',
                label: t('text.mobileNav.quickBudget', {
                    defaultValue: 'Quick budget',
                }),
                icon: HiOutlineDocumentText,
                to: appPath('/sales/budget-quick'),
            })
        }
        items.push({
            key: 'addOrder',
            label: t('text.mobileNav.addOrder', {
                defaultValue: 'Add Order',
            }),
            icon: HiOutlinePlusCircle,
            to: appPath('/sales/order-new'),
        })
        return items
    }, [openCustomerDrawer, openMobileMenu, t])

    const messagingNavItems = useMemo<MobileNavItem[]>(
        () => [
            {
                key: 'messagesChats',
                label: t('text.mobileNav.messages', {
                    defaultValue: 'Messages',
                }),
                icon: HiOutlineChatAlt2,
                to: appPath('/crm/conversations'),
            },
            {
                key: 'messagesMail',
                label: t('crm.mail.mailbox', {
                    defaultValue: 'Mailbox',
                }),
                icon: HiOutlineDocumentText,
                to: appPath('/crm/mail/inbox'),
            },
            {
                key: 'messagesAi',
                label: t('text.mobileNav.ai', {
                    defaultValue: 'AI',
                }),
                icon: HiOutlinePlusCircle,
                to: appPath('/settings/ai'),
            },
            {
                key: 'messagesGeneral',
                label: t('text.mobileNav.general', {
                    defaultValue: 'General',
                }),
                icon: HiOutlineHome,
                to: appPath('/crm/customers'),
            },
        ],
        [t],
    )

    const handleItemClick = (item: MobileNavItem) => {
        if (item.action) {
            closeCustomerDrawer()
            if (!item.skipCloseAll) {
                broadcastDrawerClose()
            }
            item.action()
            return
        }
        closeCustomerDrawer()
        broadcastDrawerClose()
        if (item.to && location.pathname !== item.to) {
            navigate(item.to)
        }
    }

    const isCustomerNavActive = useMemo(() => {
        return location.pathname === appPath('/sales/order-new')
    }, [location.pathname])

    const isItemActive = (item: MobileNavItem) => {
        if (!item.to) {
            return false
        }

        return Boolean(
            matchPath(
                { path: item.to, end: item.to === appPath('/sales/dashboard') },
                location.pathname,
            ),
        )
    }

    useEffect(() => {
        if (!showNav) {
            return
        }
        const previousPadding = document.body.style.paddingBottom
        document.body.style.paddingBottom = SAFE_AREA_INSET
        document.body.style.setProperty(
            '--mobile-bottom-nav-offset',
            NAV_PLACEHOLDER_HEIGHT,
        )
        return () => {
            document.body.style.paddingBottom = previousPadding
            document.body.style.removeProperty('--mobile-bottom-nav-offset')
        }
    }, [showNav])

    if (!showNav || isConversationRoute) {
        return null
    }

    return (
        <>
            <div
                className="md:hidden"
                style={{
                    height: NAV_PLACEHOLDER_HEIGHT,
                }}
                aria-hidden="true"
            />
            <nav
                className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t border-gray-200 dark:border-gray-700 bg-white/95 dark:bg-gray-900/95 backdrop-blur"
                style={{
                    height: `${NAV_HEIGHT}px`,
                    paddingBottom: SAFE_AREA_INSET,
                }}
            >
                <ul className="flex h-full items-center justify-between px-2 pt-2 pb-3">
                    {(isMailRoute ? messagingNavItems : navItems).map((item) => {
                        const ActiveIcon = item.icon
                        const active =
                            item.key === 'addCustomer'
                                ? isCustomerNavActive || isCustomerDrawerOpen
                                : isItemActive(item)
                        const isLink = Boolean(item.to)
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
                                        isLink && active ? 'page' : undefined
                                    }
                                    aria-pressed={
                                        !isLink && active ? true : undefined
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
