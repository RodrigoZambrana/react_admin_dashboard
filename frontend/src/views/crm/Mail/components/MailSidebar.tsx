import { useEffect, useMemo } from 'react'
import classNames from 'classnames'
import Menu from '@/components/ui/Menu'
import Badge from '@/components/ui/Badge'
import ScrollBar from '@/components/ui/ScrollBar'
import Drawer from '@/components/ui/Drawer'
import MainCompose from './MainCompose'
import useResponsive from '@/utils/hooks/useResponsive'
import {
    updateSelectedCategory,
    toggleMobileSidebar,
    updateMailId,
    fetchInboxAccounts,
    fetchInboxMailboxes,
    setSelectedInboxMailbox,
    useAppDispatch,
    useAppSelector,
} from '../store'
import { useNavigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { groupList, labelList } from '../constants'
import type { JSX } from 'react'

type MenuBase = {
    value: string
    label: string
}

type Group = MenuBase & {
    icon?: JSX.Element
}

type Label = MenuBase & {
    dotClass: string
}

const { MenuItem, MenuGroup } = Menu

const MailSideBarContent = () => {
    const navigate = useNavigate()
    const { t } = useTranslation()
    const location = useLocation()

    const dispatch = useAppDispatch()

    const selectedCategory = useAppSelector(
        (state) => state.crmMail.data.selectedCategory,
    )

    const inboxState = useAppSelector((state) => state.crmMail.data.inbox)
    const inboxAccounts = inboxState.accounts
    const inboxAccountsLoading = inboxState.accountsLoading
    const selectedInboxAccountId = inboxState.selectedAccountId
    const inboxMailboxesByAccount = inboxState.mailboxesByAccount
    const inboxMailboxesLoading = inboxState.mailboxesLoading
    const selectedInboxMailboxId = inboxState.selectedMailboxId

    const accountMailboxes = selectedInboxAccountId
        ? inboxMailboxesByAccount[selectedInboxAccountId] ?? []
        : []

    const dynamicMailboxGroups = useMemo<Group[]>(
        () =>
            accountMailboxes.map((mailbox) => ({
                value: mailbox.id,
                label: mailbox.label || mailbox.id,
            })),
        [accountMailboxes],
    )

    const dynamicMailboxMap = useMemo<Record<string, Group>>(() => {
        return dynamicMailboxGroups.reduce<Record<string, Group>>(
            (acc, mailbox) => {
                acc[mailbox.value] = mailbox
                return acc
            },
            {},
        )
    }, [dynamicMailboxGroups])

    const direction = useAppSelector((state) => state.theme.direction)

    useEffect(() => {
        if (!inboxAccountsLoading && inboxAccounts.length === 0) {
            dispatch(fetchInboxAccounts())
        }
    }, [dispatch, inboxAccountsLoading, inboxAccounts.length])

    useEffect(() => {
        if (!selectedInboxAccountId) {
            return
        }
        if (
            inboxMailboxesByAccount[selectedInboxAccountId] &&
            inboxMailboxesByAccount[selectedInboxAccountId]?.length > 0
        ) {
            return
        }
        if (inboxMailboxesLoading) {
            return
        }
        dispatch(fetchInboxMailboxes({ accountId: selectedInboxAccountId }))
    }, [
        dispatch,
        inboxMailboxesByAccount,
        inboxMailboxesLoading,
        selectedInboxAccountId,
    ])

    useEffect(() => {
        if (!selectedInboxMailboxId && dynamicMailboxGroups.length > 0) {
            dispatch(setSelectedInboxMailbox(dynamicMailboxGroups[0].value))
        }
    }, [dispatch, selectedInboxMailboxId, dynamicMailboxGroups])

    const getCategory = (value: string) => {
        let category = value
        if (category === 'mail') {
            category = 'inbox'
        }
        const dynamicMatch =
            dynamicMailboxMap[category] ??
            dynamicMailboxGroups.find(
                (mailbox) => mailbox.value.toLowerCase() === category.toLowerCase(),
            )
        if (dynamicMatch) {
            return dynamicMatch
        }
        const categories = [...groupList, ...labelList]
        return {
            value: category,
            label: categories.find((cat) => cat.value === category)?.label,
        }
    }

    const onMenuClick = (category: Group | Label) => {
        const normalized = getCategory(category.value)
        dispatch(updateMailId(''))
        dispatch(updateSelectedCategory(normalized))
        if (dynamicMailboxMap[normalized.value]) {
            dispatch(setSelectedInboxMailbox(normalized.value))
        }
        navigate(`/app/crm/mail/${normalized.value}`, { replace: true })
    }

    useEffect(() => {
        const path = location.pathname.substring(
            location.pathname.lastIndexOf('/') + 1,
        )
        const selected = getCategory(path)
        dispatch(updateSelectedCategory(selected))
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dynamicMailboxMap])

    const primaryMenuItems: Group[] =
        dynamicMailboxGroups.length > 0 ? dynamicMailboxGroups : groupList

    const resolveMenuLabel = (menu: Group) => {
        if (dynamicMailboxMap[menu.value]) {
            return dynamicMailboxMap[menu.value].label
        }
        return t(`crm.mail.categories.${menu.value}`)
    }

    return (
        <ScrollBar direction={direction}>
            <div className="flex flex-col justify-between h-full">
                <div>
                    <div className="my-8 mx-6">
                        <h3>{t('crm.mail.mailbox')}</h3>
                    </div>
                    <Menu variant="transparent" className="mx-2 mb-10">
                        {primaryMenuItems.map((menu) => (
                            <MenuItem
                                key={menu.value}
                                eventKey={menu.value}
                                className={`mb-2 ${
                                    selectedCategory.value === menu.value
                                        ? 'bg-gray-100 dark:bg-gray-700'
                                        : ''
                                }`}
                                onSelect={() => onMenuClick(menu)}
                            >
                                {menu.icon && (
                                    <span className="text-2xl ltr:mr-2 rtl:ml-2">
                                        {menu.icon}
                                    </span>
                                )}
                                <span>{resolveMenuLabel(menu)}</span>
                            </MenuItem>
                        ))}
                    </Menu>
                    <Menu variant="transparent" className="mx-2 mb-6">
                        <MenuGroup label={t('crm.mail.labels')}>
                            {labelList.map((label) => (
                                <MenuItem
                                    key={label.value}
                                    eventKey={label.value}
                                    className={`mb-2 ${
                                        selectedCategory.value === label.value
                                            ? 'bg-gray-100 dark:bg-gray-700'
                                            : ''
                                    }`}
                                    onSelect={() => onMenuClick(label)}
                                >
                                    <Badge
                                        className="ltr:mr-2 rtl:ml-2"
                                        innerClass={label.dotClass}
                                    />
                                    <span>{t(`crm.mail.labelsList.${label.value}`)}</span>
                                </MenuItem>
                            ))}
                        </MenuGroup>
                    </Menu>
                </div>
                <div className="mx-4 mb-4">
                    <MainCompose />
                </div>
            </div>
        </ScrollBar>
    )
}

const MailSidebar = () => {
    const sideBarExpand = useAppSelector(
        (state) => state.crmMail.data.sideBarExpand,
    )

    const mobileSideBarExpand = useAppSelector(
        (state) => state.crmMail.data.mobileSideBarExpand,
    )

    const dispatch = useAppDispatch()

    const { smaller } = useResponsive()

    const onMobileSideBarClose = () => {
        dispatch(toggleMobileSidebar(false))
    }

    return smaller.xl ? (
        <Drawer
            bodyClass="p-0"
            title={t('crm.mail.title')}
            isOpen={mobileSideBarExpand}
            placement="left"
            width={280}
            onClose={onMobileSideBarClose}
            onRequestClose={onMobileSideBarClose}
        >
            <MailSideBarContent />
        </Drawer>
    ) : (
        <div
            className={classNames(
                'w-[280px] absolute top-0 bottom-0 ease-in-out duration-300 bg-white dark:bg-gray-800 ltr:border-r rtl:border-l border-gray-200 dark:border-gray-600 z-10',
                sideBarExpand
                    ? 'ltr:left-0 rtl:right-0'
                    : 'ltr:left-[-280px] rtl:right-[-280px]',
            )}
        >
            <MailSideBarContent />
        </div>
    )
}

export default MailSidebar
