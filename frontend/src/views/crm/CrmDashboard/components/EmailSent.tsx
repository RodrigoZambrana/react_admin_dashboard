import Card from '@/components/ui/Card'
import Progress from '@/components/ui/Progress'
import type { Emails } from '../store'
import { useTranslation } from 'react-i18next'

type EmailSentProps = {
    data?: Partial<Emails>
    className?: string
}

const ProgressInfo = ({ precent }: { precent?: number }) => {
    const { t } = useTranslation()
    return (
        <div>
            <h3 className="font-bold">{precent}%</h3>
            <p>{t('crm.emailSent.opened')}</p>
        </div>
    )
}

const EmailSent = ({ data = {}, className }: EmailSentProps) => {
    const { t } = useTranslation()
    return (
        <Card className={className}>
            <h4>{t('crm.emailSent.title')}</h4>
            <div className="mt-6">
                <Progress
                    variant="circle"
                    percent={data.precent}
                    width={200}
                    className="flex justify-center"
                    strokeWidth={4}
                    customInfo={<ProgressInfo precent={data.precent} />}
                />
            </div>
            <div className="text-center mt-6">
                <p className="font-semibold">{t('crm.emailSent.performance')}</p>
                <h4 className="font-bold">{t('crm.emailSent.average')}</h4>
            </div>
        </Card>
    )
}

export default EmailSent
