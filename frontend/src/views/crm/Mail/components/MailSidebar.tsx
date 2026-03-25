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
    setSelectedInboxContext,
    setSelectedInboxAccount,
    setSelectedInboxMailbox,
    useAppDispatch,
    useAppSelector,
} from '../store'
import { initialState as initialMailState } from '../store/mailSlice'
import { useNavigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import useQuery from '@/utils/hooks/useQuery'
import {
    groupList,
    labelList,
    dynamicMailboxIconMap,
} from '../constants'
import type { Group, Label } from '../constants'
import {
    translateMailboxLabel as translateMailboxLabelHelper,
    resolveLabelBadge,
    findStaticCategory,
    normalizeMailboxKey,
} from '../utils/labels'
import type { InboxMailboxDto } from '@/services/InboxService'

const { MenuItem, MenuGroup } = Menu

const findPreferredMailboxId = (mailboxes: InboxMailboxDto[]) => {
    const inboxMailbox = mailboxes.find((mailbox) => {
        const normalizedId = normalizeMailboxKey(mailbox.id)
        const normalizedType = normalizeMailboxKey(mailbox.type ?? '')
        return normalizedId === 'inbox' || normalizedType === 'inbox'
    })

    return inboxMailbox?.id ?? mailboxes[0]?.id
}

const mapMailboxesToGroups = (mailboxes: InboxMailboxDto[]): Group[] =>
    mailboxes.map((mailbox) => {
        const fallbackLabel = mailbox.label || mailbox.id
        const staticCategory = findStaticCategory(mailbox.id)
        const normalizedId = normalizeMailboxKey(mailbox.id)
        let translationValue = mailbox.id
        let icon: Group['icon']
        if (staticCategory && 'icon' in staticCategory) {
            translationValue =
                staticCategory.translationValue ?? staticCategory.value
            icon = staticCategory.icon
        } else if (staticCategory) {
            translationValue = staticCategory.value
        } else if (normalizedId) {
            icon = dynamicMailboxIconMap[normalizedId]
        }
        return {
            value: mailbox.id,
            label: fallbackLabel,
            translationValue,
            icon,
        }
    })

const buildMailboxGroupMap = (mailboxes: Group[]) =>
    mailboxes.reduce<Record<string, Group>>((acc, mailbox) => {
        const normalized = normalizeMailboxKey(mailbox.value)
        if (normalized) {
            acc[normalized] = mailbox
        }
        const translationNormalized = normalizeMailboxKey(
            mailbox.translationValue ?? '',
        )
        if (translationNormalized && translationNormalized !== normalized) {
            acc[translationNormalized] = mailbox
        }
        acc[mailbox.value] = mailbox
        return acc
    }, {})

const resolveCategory = (
    value: string,
    mailboxGroups: Group[],
    mailboxGroupMap: Record<string, Group>,
    translateMailboxLabel: (value: string, fallback?: string) => string,
    t: ReturnType<typeof useTranslation>['t'],
) => {
    let category = value
    if (category === 'mail') {
        category = 'inbox'
    }
    const normalizedCategory = normalizeMailboxKey(category)
    const dynamicMatch =
        (normalizedCategory && mailboxGroupMap[normalizedCategory]) ??
        mailboxGroups.find(
            (mailbox) =>
                normalizeMailboxKey(mailbox.value) === normalizedCategory,
        )
    if (dynamicMatch) {
        const fallbackLabel = dynamicMatch.label || dynamicMatch.value || category
        const translationSource =
            dynamicMatch.translationValue ?? dynamicMatch.value
        return {
            value: dynamicMatch.value,
            label: translateMailboxLabel(translationSource, fallbackLabel),
        }
    }
    const staticMatch = findStaticCategory(category)
    if (staticMatch) {
        if ('icon' in staticMatch) {
            const translationSource =
                staticMatch.translationValue ?? staticMatch.value
            return {
                value: staticMatch.value,
                label: translateMailboxLabel(translationSource, staticMatch.label),
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
}

const MailSidebarBootstrap = () => {
    const navigate = useNavigate()
    const location = useLocation()
    const query = useQuery()
    const { t } = useTranslation()
    const dispatch = useAppDispatch()

    const mailState = useAppSelector(
        (state) => state.crmMail?.data ?? initialMailState,
    )
    const selectedCategory = mailState.selectedCategory
    const inboxState = mailState.inbox
    const inboxAccounts = inboxState.accounts
    const inboxAccountsLoading = inboxState.accountsLoading
    const selectedInboxAccountId = inboxState.selectedAccountId
    const inboxMailboxesByAccount = inboxState.mailboxesByAccount
    const selectedInboxMailboxId = inboxState.selectedMailboxId
    const mailboxesStatusMap = inboxState.mailboxesRequestStatus
    const queryAccountId = query.get('account')?.trim() ?? ''
    const queryMailboxId = query.get('mailbox')?.trim() ?? ''

    const translateMailboxLabel = useCallback(
        (value: string, fallback?: string) =>
            translateMailboxLabelHelper(t, value, fallback),
        [t],
    )

    const accountMailboxes = useMemo<InboxMailboxDto[]>(() => {
        if (!selectedInboxAccountId) {
            return []
        }
        return inboxMailboxesByAccount[selectedInboxAccountId] ?? []
    }, [selectedInboxAccountId, inboxMailboxesByAccount])

    const dynamicMailboxGroups = useMemo(
        () => mapMailboxesToGroups(accountMailboxes),
        [accountMailboxes],
    )

    const mailboxGroupMap = useMemo(
        () => buildMailboxGroupMap(dynamicMailboxGroups),
        [dynamicMailboxGroups],
    )

    const selectedMailboxesStatus = selectedInboxAccountId
        ? mailboxesStatusMap[selectedInboxAccountId]
        : undefined

    useEffect(() => {
        if (!queryAccountId) {
            return
        }

        if (selectedInboxAccountId !== queryAccountId) {
            dispatch(
                setSelectedInboxContext({
                    accountId: queryAccountId,
                    mailboxId: queryMailboxId || undefined,
                }),
            )
            return
        }

        if (queryMailboxId && selectedInboxMailboxId !== queryMailboxId) {
            dispatch(setSelectedInboxMailbox(queryMailboxId))
        }
    }, [
        dispatch,
        queryAccountId,
        queryMailboxId,
        selectedInboxAccountId,
        selectedInboxMailboxId,
    ])

    useEffect(() => {
        if (inboxAccountsLoading || inboxAccounts.length === 0) {
            return
        }

        const selectedExists = inboxAccounts.some(
            (account) => account.id === selectedInboxAccountId,
        )

        if (!selectedExists) {
            dispatch(setSelectedInboxAccount(inboxAccounts[0].id))
        }
    }, [
        dispatch,
        inboxAccounts,
        inboxAccountsLoading,
        selectedInboxAccountId,
    ])

    useEffect(() => {
        const normalizedSelected = normalizeMailboxKey(
            selectedCategory.value ? String(selectedCategory.value) : '',
        )
        if (!normalizedSelected) {
            return
        }
        const mapped =
            mailboxGroupMap[normalizedSelected] ??
            mailboxGroupMap[selectedCategory.value as string]
        if (
            mapped &&
            typeof mapped.value === 'string' &&
            mapped.value !== selectedInboxMailboxId
        ) {
            dispatch(setSelectedInboxMailbox(mapped.value))
        }
    }, [
        dispatch,
        mailboxGroupMap,
        selectedCategory.value,
        selectedInboxMailboxId,
    ])

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
        if (!selectedInboxAccountId || accountMailboxes.length === 0) {
            return
        }

        const selectedExists = accountMailboxes.some(
            (mailbox) => mailbox.id === selectedInboxMailboxId,
        )

        if (!selectedExists) {
            const preferredMailboxId = findPreferredMailboxId(accountMailboxes)
            if (preferredMailboxId) {
                dispatch(setSelectedInboxMailbox(preferredMailboxId))
            }
        }
    }, [
        accountMailboxes,
        dispatch,
        selectedInboxAccountId,
        selectedInboxMailboxId,
    ])

    useEffect(() => {
        const path = location.pathname.substring(
            location.pathname.lastIndexOf('/') + 1,
        )

        if (path !== 'inbox' || !selectedInboxAccountId || !selectedInboxMailboxId) {
            return
        }

        if (
            queryAccountId === selectedInboxAccountId &&
            queryMailboxId === selectedInboxMailboxId
        ) {
            return
        }

        navigate(
            `/app/crm/mail/inbox?account=${encodeURIComponent(
                selectedInboxAccountId,
            )}&mailbox=${encodeURIComponent(selectedInboxMailboxId)}`,
            { replace: true },
        )
    }, [
        location.pathname,
        navigate,
        queryAccountId,
        queryMailboxId,
        selectedInboxAccountId,
        selectedInboxMailboxId,
    ])

    useEffect(() => {
        const path = location.pathname.substring(
            location.pathname.lastIndexOf('/') + 1,
        )
        const selected = resolveCategory(
            path,
            dynamicMailboxGroups,
            mailboxGroupMap,
            translateMailboxLabel,
            t,
        )
        if (
            selectedCategory.value !== selected?.value ||
            selectedCategory.label !== selected?.label
        ) {
            dispatch(updateSelectedCategory(selected))
        }
    }, [
        dispatch,
        dynamicMailboxGroups,
        location.pathname,
        mailboxGroupMap,
        selectedCategory.label,
        selectedCategory.value,
        t,
        translateMailboxLabel,
    ])

    return null
}

const MailSideBarContent = () => {
    const navigate = useNavigate()
    const { t } = useTranslation()

    const dispatch = useAppDispatch()

    const mailState = useAppSelector(
        (state) => state.crmMail?.data ?? initialMailState,
    )
    const selectedCategory = mailState.selectedCategory

    const inboxState = mailState.inbox
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
        () => mapMailboxesToGroups(accountMailboxes),
        [accountMailboxes],
    )
    const mailboxGroupMap = useMemo<Record<string, Group>>(
        () => buildMailboxGroupMap(dynamicMailboxGroups),
        [dynamicMailboxGroups],
    )

    const direction = useAppSelector((state) => state.theme.direction)

    const getCategory = useCallback(
        (value: string) =>
            resolveCategory(
                value,
                dynamicMailboxGroups,
                mailboxGroupMap,
                translateMailboxLabel,
                t,
            ),
        [dynamicMailboxGroups, mailboxGroupMap, t, translateMailboxLabel],
    )

    const onMenuClick = (category: Group | Label) => {
        const normalized = getCategory(category.value)
        dispatch(updateMailId(''))
        dispatch(updateSelectedCategory(normalized))
        const normalizedKey = normalizeMailboxKey(
            normalized.value ? String(normalized.value) : '',
        )
        if (
            normalizedKey &&
            mailboxGroupMap[normalizedKey] &&
            typeof normalized.value === 'string'
        ) {
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
        const searchParams = new URLSearchParams()
        if (selectedInboxAccountId) {
            searchParams.set('account', selectedInboxAccountId)
        }
        if (typeof normalized.value === 'string') {
            searchParams.set('mailbox', normalized.value)
        } else if (selectedInboxMailboxId) {
            searchParams.set('mailbox', selectedInboxMailboxId)
        }
        const nextSearch = searchParams.toString()
        navigate(`/app/crm/mail/${pathValue}${nextSearch ? `?${nextSearch}` : ''}`, {
            replace: true,
        })
    }

    const primaryMenuItems: Group[] =
        dynamicMailboxGroups.length > 0 ? dynamicMailboxGroups : groupList

    const resolveMenuLabel = (menu: Group) => {
        const normalized = normalizeMailboxKey(menu.value)
        const dynamicMatch =
            (normalized && mailboxGroupMap[normalized]) ||
            mailboxGroupMap[menu.value]
        const translationSource =
            dynamicMatch?.translationValue ?? menu.translationValue ?? menu.value
        const fallbackLabel =
            dynamicMatch?.label ?? menu.label
        return translateMailboxLabel(
            translationSource,
            fallbackLabel,
        )
    }

    return (
        <ScrollBar direction={direction}>
            <div className="flex flex-col justify-between h-full" data-testid="admin-inbox-sidebar-content">
                <div>
                    <div className="my-8 mx-6" data-testid="admin-inbox-sidebar-header">
                        <h3>{t('crm.mail.mailbox')}</h3>
                    </div>
                    {selectedMailboxesStatus === 'failed' && selectedMailboxesError && (
                        <div className="mx-6 mt-0 mb-4 text-sm text-red-500" data-testid="admin-inbox-mailboxes-error">
                            {resolvedMailboxesError}
                        </div>
                    )}
                    <Menu variant="transparent" className="mx-2 mb-10" data-testid="admin-inbox-mailboxes-menu">
                        {primaryMenuItems.map((menu) => (
                            <MenuItem
                                key={menu.value}
                                eventKey={menu.value}
                                data-testid={`admin-inbox-mailbox-${String(menu.value)}`}
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
                    <Menu variant="transparent" className="mx-2 mb-6" data-testid="admin-inbox-labels-menu">
                        <MenuGroup label={t('crm.mail.labels')}>
                            {labelList.map((label) => (
                            <MenuItem
                                key={label.value}
                                eventKey={label.value}
                                data-testid={`admin-inbox-label-${String(label.value)}`}
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
                <div className="mx-4 mb-4" data-testid="admin-inbox-compose">
                    <MainCompose />
                </div>
            </div>
        </ScrollBar>
    )
}

const MailSidebar = () => {
    const { sideBarExpand, mobileSideBarExpand: mobileSidebarExpand } = useAppSelector(
        (state) => state.crmMail?.data ?? initialMailState,
    )

    const dispatch = useAppDispatch()

    const { smaller } = useResponsive()
    const { t } = useTranslation()

    const onMobileSideBarClose = () => {
        dispatch(toggleMobileSidebar(false))
    }

    return smaller.xl ? (
        <>
            <MailSidebarBootstrap />
            <Drawer
                bodyClass="p-0"
                title={t('crm.mail.title')}
                isOpen={mobileSidebarExpand}
                placement="left"
                width={280}
                onClose={onMobileSideBarClose}
                onRequestClose={onMobileSideBarClose}
            >
                <MailSideBarContent />
            </Drawer>
        </>
    ) : (
        <>
            <MailSidebarBootstrap />
            <div
                data-testid="admin-inbox-sidebar"
                className={classNames(
                    'w-[280px] absolute top-0 bottom-0 ease-in-out duration-300 bg-white dark:bg-gray-800 ltr:border-r rtl:border-l border-gray-200 dark:border-gray-600 z-10',
                    sideBarExpand
                        ? 'ltr:left-0 rtl:right-0'
                        : 'ltr:left-[-280px] rtl:right-[-280px]',
                )}
            >
                <MailSideBarContent />
            </div>
        </>
    )
}

export default MailSidebar
