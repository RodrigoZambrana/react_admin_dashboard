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
    UPDATE_TICKET,
    COMMENT,
    COMMENT_MENTION,
    ASSIGN_TICKET,
    ADD_TAGS_TO_TICKET,
    ADD_FILES_TO_TICKET,
    CREATE_TICKET,
} from '../constants'
import useResponsive from '@/utils/hooks/useResponsive'
import type { CommonProps } from '@/@types/common'
import { useTranslation } from 'react-i18next'

type CategoryTitleProps = CommonProps

const useCheckboxes = (t: (k: string) => string) => {
    const commentCheckboxes = [
        { label: t('text.filters.commentOnPost'), value: COMMENT },
        { label: t('text.filters.mentionedYou'), value: COMMENT_MENTION },
    ]
    const ticketCheckboxes = [
        { label: t('text.filters.ticketStatus'), value: UPDATE_TICKET },
        { label: t('text.filters.assignTicket'), value: ASSIGN_TICKET },
        { label: t('text.filters.newTicket'), value: CREATE_TICKET },
        { label: t('text.filters.addTags'), value: ADD_TAGS_TO_TICKET },
        { label: t('text.filters.addFiles'), value: ADD_FILES_TO_TICKET },
    ]
    return { commentCheckboxes, ticketCheckboxes }
}

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

    const { commentCheckboxes, ticketCheckboxes } = useCheckboxes(t)

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
                    <CategoryTitle className="mb-3">{t('text.labels.ticket')}</CategoryTitle>
                    {ticketCheckboxes.map((checkbox) => (
                        <Checkbox
                            key={checkbox.value}
                            className="mb-4"
                            value={checkbox.value}
                        >
                            {checkbox.label}
                        </Checkbox>
                    ))}
                    <CategoryTitle className="mt-4 mb-3">{t('text.labels.comment')}</CategoryTitle>
                    {commentCheckboxes.map((checkbox) => (
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
