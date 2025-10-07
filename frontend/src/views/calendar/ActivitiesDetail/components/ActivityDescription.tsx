import Card from '@/components/ui/Card'
import { useTranslation } from 'react-i18next'

type ActivityDescriptionProps = {
    description?: string | null
}

const ActivityDescription = ({ description }: ActivityDescriptionProps) => {
    const { t } = useTranslation()
    const content = (description || '').trim()

    return (
        <Card>
            <div className="flex flex-col gap-3">
                <h4 className="font-semibold text-gray-900 dark:text-gray-100">
                    {t('text.labels.description', {
                        defaultValue: 'Descripción',
                    })}
                </h4>
                <p className="text-gray-700 dark:text-gray-200 whitespace-pre-line">
                    {content.length
                        ? content
                        : t('calendar.messages.noDescription', {
                              defaultValue: 'Sin descripción disponible.',
                          })}
                </p>
            </div>
        </Card>
    )
}

export default ActivityDescription
