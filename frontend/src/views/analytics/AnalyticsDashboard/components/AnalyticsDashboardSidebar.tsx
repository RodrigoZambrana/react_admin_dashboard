import classNames from 'classnames'
import { Link, useLocation } from 'react-router-dom'

type AnalyticsSection = {
    key: string
    path: string
    title: string
    subtitle: string
}

type AnalyticsDashboardSidebarProps = {
    sections: readonly AnalyticsSection[]
}

const AnalyticsDashboardSidebar = ({ sections }: AnalyticsDashboardSidebarProps) => {
    const location = useLocation()

    return (
        <div className="w-full lg:w-72 shrink-0">
            <div className="sticky top-4">
                <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
                    <div className="mb-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">
                            Analytics
                        </p>
                        <h4 className="mt-1 mb-1">Business cockpit</h4>
                        <p className="text-sm text-gray-500">
                            Separación clara entre consumo de métricas y configuración de instrumentos.
                        </p>
                    </div>
                    <div className="space-y-2">
                        {sections.map((section) => {
                            const isActive =
                                location.pathname === section.path ||
                                location.pathname.startsWith(`${section.path}/`)

                            return (
                                <Link
                                    key={section.key}
                                    to={section.path}
                                    className={classNames(
                                        'block rounded-xl border px-3 py-3 transition-colors',
                                        isActive
                                            ? 'border-indigo-500 bg-indigo-50 text-indigo-700 dark:border-indigo-400 dark:bg-indigo-500/10 dark:text-indigo-100'
                                            : 'border-transparent bg-gray-50 text-gray-700 hover:border-gray-200 hover:bg-gray-100 dark:bg-gray-700/40 dark:text-gray-200 dark:hover:border-gray-600',
                                    )}
                                >
                                    <div className="font-medium">{section.title}</div>
                                    <div className="mt-1 text-xs leading-5 opacity-80">
                                        {section.subtitle}
                                    </div>
                                </Link>
                            )
                        })}
                    </div>
                </div>
            </div>
        </div>
    )
}

export default AnalyticsDashboardSidebar
