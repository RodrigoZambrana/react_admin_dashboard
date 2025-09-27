import { useTranslation } from 'react-i18next'
import Card from '@/components/ui/Card'
import Avatar from '@/components/ui/Avatar'
import Button from '@/components/ui/Button'
import { HiPencilAlt } from 'react-icons/hi'
import { useAppDispatch } from '../store'
import { openEditActivityDialog } from '../store/slice'
import dayjs from 'dayjs'

type FieldProps = { title?: string; value?: string }
const InfoField = ({ title, value }: FieldProps) => (
    <div>
        <span>{title}</span>
        <p className="text-gray-700 dark:text-gray-200 font-semibold">{value}</p>
    </div>
)

const ActivityProfile = ({ data = {} as any }) => {
    const { t } = useTranslation()
    const dispatch = useAppDispatch()
    return (
        <Card>
            <div className="flex flex-col xl:justify-between h-full 2xl:min-w-[360px] mx-auto">
                <div className="flex xl:flex-col items-center gap-4">
                    <Avatar size={90} shape="circle" src={(data as any).img} />
                    <h4 className="font-bold">{(data as any).name}</h4>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-1 gap-y-7 gap-x-4 mt-8">
                    <InfoField title={t('text.labels.title', { defaultValue: 'Title' })} value={(data as any).personalInfo?.title || (data as any).name} />
                    <InfoField title={t('text.labels.date', { defaultValue: 'Date' })} value={(data as any).date ? dayjs((data as any).date).format('DD/MM/YYYY') : undefined} />
                    <InfoField title={t('text.labels.time', { defaultValue: 'Time' })} value={(data as any).time} />
                    <InfoField title={t('text.labels.location')} value={(data as any).personalInfo?.location} />
                    <InfoField title={t('text.labels.email')} value={(data as any).email} />
                    <InfoField title={t('text.labels.phone')} value={(data as any).personalInfo?.phoneNumber} />
                </div>
                <div className="mt-4 flex flex-col xl:flex-row gap-2">
                    <Button block icon={<HiPencilAlt />} variant="solid" onClick={() => dispatch(openEditActivityDialog())}>
                        {t('text.actions.edit')}
                    </Button>
                </div>
            </div>
        </Card>
    )
}

export default ActivityProfile
