import { useCallback, useMemo } from 'react'
import classNames from 'classnames'
import Checkbox from '@/components/ui/Checkbox'
import Affix from '@/components/shared/Affix'
import {
    setSelected,
    setActivityIndex,
    filterLogs,
    useAppDispatch,
    useAppSelector,
} from '../store'
import {
    LOGIN,
    PASSWORD_CHANGE,
    DEVICE_SIGN_IN,
    PROFILE_UPDATE,
    SECURITY_ALERT,
} from '../constants'
import useResponsive from '@/utils/hooks/useResponsive'
import type { CommonProps } from '@/@types/common'
import { useTranslation } from 'react-i18next'

type CategoryTitleProps = CommonProps

const CategoryTitle = ({ children, className }: CategoryTitleProps) => {
    return (
        <h6
            className={classNames(
                'text-gray-900 uppercase tracking-wide font-semibold text-sm lg:text-xs',
                className,
            )}
        >
            {children}
        </h6>
    )
}

const LogFilter = () => {
    const dispatch = useAppDispatch()
    const { t } = useTranslation()
    const selectedType = useAppSelector(
        (state) => state.accountActivityLog.data.selectedType,
    )
    const activityIndex = useAppSelector(
        (state) => state.accountActivityLog.data.activityIndex,
    )

    const onFilterChange = useCallback(
        (selected: string[]) => {
            dispatch(filterLogs({ filter: selected, activityIndex: 1 }))
            if (activityIndex !== 1) {
                dispatch(setActivityIndex(1))
            }
            dispatch(setSelected(selected))
        },
        [dispatch, activityIndex],
    )

    const { larger } = useResponsive()

    const securityCheckboxes = useMemo(
        () => [
            {
                label: t('account.activity.filters.login', {
                    defaultValue: 'Sign-ins',
                }),
                value: LOGIN,
            },
            {
                label: t('account.activity.filters.device', {
                    defaultValue: 'New devices',
                }),
                value: DEVICE_SIGN_IN,
            },
            {
                label: t('account.activity.filters.securityAlert', {
                    defaultValue: 'Security alerts',
                }),
                value: SECURITY_ALERT,
            },
        ],
        [t],
    )

    const accountCheckboxes = useMemo(
        () => [
            {
                label: t('account.activity.filters.passwordChange', {
                    defaultValue: 'Password changes',
                }),
                value: PASSWORD_CHANGE,
            },
            {
                label: t('account.activity.filters.profileUpdate', {
                    defaultValue: 'Profile updates',
                }),
                value: PROFILE_UPDATE,
            },
        ],
        [t],
    )

    const renderLogFilterContent = () => {
        return (
            <>
                <h5 className="mb-4">{t('text.titles.filterActivity')}</h5>
                <Checkbox.Group
                    vertical
                    value={selectedType}
                    onChange={(value) => {
                        onFilterChange(value as string[])
                    }}
                >
                    <CategoryTitle className="mb-3">
                        {t('account.activity.categories.security', {
                            defaultValue: 'Security',
                        })}
                    </CategoryTitle>
                    {securityCheckboxes.map((checkbox) => (
                        <Checkbox
                            key={checkbox.value}
                            className="mb-4"
                            value={checkbox.value}
                        >
                            {checkbox.label}
                        </Checkbox>
                    ))}
                    <CategoryTitle className="mt-4 mb-3">
                        {t('account.activity.categories.account', {
                            defaultValue: 'Account changes',
                        })}
                    </CategoryTitle>
                    {accountCheckboxes.map((checkbox) => (
                        <Checkbox
                            key={checkbox.value}
                            className="mb-4"
                            value={checkbox.value}
                        >
                            {checkbox.label}
                        </Checkbox>
                    ))}
                </Checkbox.Group>
            </>
        )
    }

    return (
        <div>
            {larger.md ? (
                <Affix className="hidden lg:block" offset={80}>
                    {renderLogFilterContent()}
                </Affix>
            ) : (
                renderLogFilterContent()
            )}
        </div>
    )
}

export default LogFilter
