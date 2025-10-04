import { useEffect } from 'react'
import Card from '@/components/ui/Card'
import Avatar from '@/components/ui/Avatar'
import MediaSkeleton from '@/components/shared/loaders/MediaSkeleton'
import Loading from '@/components/shared/Loading'
import { getCustomerStatistic, useAppDispatch, useAppSelector } from '../store'
import {
    HiOutlineUserGroup,
    HiOutlineUserAdd,
    HiOutlineUsers,
} from 'react-icons/hi'
import { NumericFormat } from 'react-number-format'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

type StatisticCardProps = {
    icon: ReactNode
    avatarClass: string
    label: string
    value?: number
    loading: boolean
}

const StatisticCard = ({
    icon,
    avatarClass,
    label,
    value,
    loading,
}: StatisticCardProps) => {
    const avatarSize = 55
    const hasValue = typeof value === 'number' && Number.isFinite(value)
    const displayValue = hasValue ? value : 0

    return (
        <Card bordered>
            <Loading
                loading={loading}
                customLoader={
                    <MediaSkeleton
                        avatarProps={{
                            className: 'rounded-sm',
                            width: avatarSize,
                            height: avatarSize,
                        }}
                    />
                }
            >
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <Avatar
                            className={avatarClass}
                            size={avatarSize}
                            icon={icon}
                        />
                        <div>
                            <span>{label}</span>
                            <h3>
                                {hasValue ? (
                                    <NumericFormat
                                        thousandSeparator
                                        displayType="text"
                                        value={displayValue}
                                    />
                                ) : (
                                    <span>--</span>
                                )}
                            </h3>
                        </div>
                    </div>
                </div>
            </Loading>
        </Card>
    )
}

const CustomerStatistic = () => {
    const dispatch = useAppDispatch()
    const { t } = useTranslation()

    const statisticData = useAppSelector(
        (state) => state.crmCustomers.data.statisticData,
    )
    const loading = useAppSelector(
        (state) => state.crmCustomers.data.statisticLoading,
    )

    useEffect(() => {
        dispatch(getCustomerStatistic())
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 mb-6">
            <StatisticCard
                icon={<HiOutlineUserGroup />}
                avatarClass="bg-indigo-600!"
                label={t('text.labels.totalCustomers')}
                value={statisticData?.totalCustomers?.value}
                loading={loading}
            />
            <StatisticCard
                icon={<HiOutlineUsers />}
                avatarClass="bg-blue-500!"
                label={t('text.labels.activeCustomers')}
                value={statisticData?.activeCustomers?.value}
                loading={loading}
            />
            <StatisticCard
                icon={<HiOutlineUserAdd />}
                avatarClass="bg-emerald-500!"
                label={t('text.labels.newCustomers')}
                value={statisticData?.newCustomers?.value}
                loading={loading}
            />
        </div>
    )
}

export default CustomerStatistic
