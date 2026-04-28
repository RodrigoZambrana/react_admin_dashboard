import Card from '@/components/ui/Card'

type AnalyticsSectionPlaceholderProps = {
    title: string
    subtitle: string
    bullets: readonly string[]
}

const AnalyticsSectionPlaceholder = ({
    title,
    subtitle,
    bullets,
}: AnalyticsSectionPlaceholderProps) => {
    return (
        <Card>
            <div className="space-y-3">
                <div>
                    <h5 className="mb-1">{title}</h5>
                    <p className="text-sm text-gray-500">{subtitle}</p>
                </div>
                <div className="grid gap-2 md:grid-cols-2">
                    {bullets.map((bullet) => (
                        <div
                            key={bullet}
                            className="rounded-xl bg-gray-50 px-4 py-3 text-sm text-gray-600 dark:bg-gray-700/40"
                        >
                            {bullet}
                        </div>
                    ))}
                </div>
            </div>
        </Card>
    )
}

export default AnalyticsSectionPlaceholder
