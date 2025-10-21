import { useCallback, useEffect, useMemo } from 'react'
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
import type { Group, Label } from '../constants'
import {
    translateMailboxLabel as translateMailboxLabelHelper,
    resolveLabelBadge,
    findStaticCategory,
} from '../utils/labels'
import type { InboxMailboxDto } from '@/services/InboxService'

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
    const selectedInboxMailboxId = inboxState.selectedMailboxId
    const mailboxesStatusMap = inboxState.mailboxesRequestStatus
    const mailboxesErrorMap = inboxState.mailboxesErrorByAccount

    const translateMailboxLabel = useCallback(
        (value: string, fallback?: string) =>
            translateMailboxLabelHelper(t, value, fallback),
        [t],
    )

    const selectedMailboxesStatus = selectedInboxAccountId
        ? mailboxesStatusMap[selectedInboxAccountId]
        : undefined
    const selectedMailboxesError = selectedInboxAccountId
        ? mailboxesErrorMap[selectedInboxAccountId]
        : null

    const mailboxesUnavailableText = t('crm.mail.mailboxesUnavailable', {
        defaultValue:
            'Mailboxes are not available right now. Please try again later.',
    })
    const resolvedMailboxesError =
        !selectedMailboxesError ||
        selectedMailboxesError === 'Unable to load inbox mailboxes.'
            ? mailboxesUnavailableText
            : selectedMailboxesError

    const accountMailboxes = useMemo<InboxMailboxDto[]>(() => {
        if (!selectedInboxAccountId) {
            return []
        }
        return inboxMailboxesByAccount[selectedInboxAccountId] ?? []
    }, [selectedInboxAccountId, inboxMailboxesByAccount])

    const dynamicMailboxGroups = useMemo<Group[]>(
        () =>
            accountMailboxes.map((mailbox) => {
                const fallbackLabel = mailbox.label || mailbox.id
                return {
                    value: mailbox.id,
                    label: translateMailboxLabel(mailbox.id, fallbackLabel),
                }
            }),
        [accountMailboxes, translateMailboxLabel],
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
            selectedMailboxesStatus === 'loading' ||
            selectedMailboxesStatus === 'succeeded' ||
            selectedMailboxesStatus === 'failed'
        ) {
            return
        }
        dispatch(fetchInboxMailboxes({ accountId: selectedInboxAccountId }))
    }, [dispatch, selectedInboxAccountId, selectedMailboxesStatus])

    useEffect(() => {
        if (!selectedInboxMailboxId && dynamicMailboxGroups.length > 0) {
            dispatch(setSelectedInboxMailbox(dynamicMailboxGroups[0].value))
        }
    }, [dispatch, selectedInboxMailboxId, dynamicMailboxGroups])

    const getCategory = useCallback(
        (value: string) => {
            let category = value
            if (category === 'mail') {
                category = 'inbox'
            }
            const dynamicMatch =
                dynamicMailboxMap[category] ??
                dynamicMailboxGroups.find(
                    (mailbox) =>
                        mailbox.value.toLowerCase() === category.toLowerCase(),
                )
            if (dynamicMatch) {
                const fallbackLabel =
                    dynamicMatch.label || dynamicMatch.value || category
                return {
                    value: dynamicMatch.value,
                    label: translateMailboxLabel(
                        dynamicMatch.value,
                        fallbackLabel,
                    ),
                }
            }
            const staticMatch = findStaticCategory(category)
            if (staticMatch) {
                if ('icon' in staticMatch) {
                    return {
                        value: category,
                        label: translateMailboxLabel(
                            category,
                            staticMatch.label,
                        ),
                    }
                }
                return {
                    value: category,
                    label: resolveLabelBadge(t, staticMatch),
                }
            }
            return {
                value: category,
                label: translateMailboxLabel(category, category),
            }
        },
        [
            dynamicMailboxGroups,
            dynamicMailboxMap,
            translateMailboxLabel,
            t,
        ],
    )

    const onMenuClick = (category: Group | Label) => {
        const normalized = getCategory(category.value)
        dispatch(updateMailId(''))
        dispatch(updateSelectedCategory(normalized))
        if (dynamicMailboxMap[normalized.value]) {
            dispatch(setSelectedInboxMailbox(normalized.value))
        }
        const normalizedValue =
            normalized.value !== undefined && normalized.value !== null
                ? String(normalized.value)
                : 'inbox'
        const pathValue =
            normalizedValue.toUpperCase() === 'INBOX'
                ? 'inbox'
                : normalizedValue
        navigate(`/app/crm/mail/${pathValue}`, {
            replace: true,
        })
    }

    useEffect(() => {
        const path = location.pathname.substring(
            location.pathname.lastIndexOf('/') + 1,
        )
        const selected = getCategory(path)
        if (
            selectedCategory.value !== selected?.value ||
            selectedCategory.label !== selected?.label
        ) {
            dispatch(updateSelectedCategory(selected))
        }
    }, [dispatch, location.pathname, getCategory, selectedCategory.label, selectedCategory.value])

    const primaryMenuItems: Group[] =
        dynamicMailboxGroups.length > 0 ? dynamicMailboxGroups : groupList

    const resolveMenuLabel = (menu: Group) => {
        if (dynamicMailboxMap[menu.value]) {
            return dynamicMailboxMap[menu.value].label
        }
        return translateMailboxLabel(menu.value, menu.label)
    }

    return (
        <ScrollBar direction={direction}>
            <div className="flex flex-col justify-between h-full">
                <div>
                    <div className="my-8 mx-6">
                        <h3>{t('crm.mail.mailbox')}</h3>
                    </div>
                    {selectedMailboxesStatus === 'failed' && selectedMailboxesError && (
                        <div className="mx-6 mt-0 mb-4 text-sm text-red-500">
                            {resolvedMailboxesError}
                        </div>
                    )}
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
                                <span>{resolveLabelBadge(t, label)}</span>
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
    const { t } = useTranslation()

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
