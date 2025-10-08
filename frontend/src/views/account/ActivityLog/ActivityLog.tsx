import { useEffect, useState } from 'react'
import AdaptableCard from '@/components/shared/AdaptableCard'
import Container from '@/components/shared/Container'
import Log from './components/Log'
import LogFilter from './components/LogFilter'
import reducer from './store'
import { injectReducer } from '@/store'
import { useTranslation } from 'react-i18next'
import Button from '@/components/ui/Button'
import useResponsive from '@/utils/hooks/useResponsive'

injectReducer('accountActivityLog', reducer)

const ActivityLog = () => {
    const { t } = useTranslation()
    const { larger } = useResponsive()
    const [filterVisible, setFilterVisible] = useState<boolean>(true)

    useEffect(() => {
        setFilterVisible(larger.lg)
    }, [larger.lg])

    const toggleFilters = () => {
        setFilterVisible((prev) => !prev)
    }

    const logColumnClass =
        filterVisible && larger.lg ? 'lg:col-span-4' : 'lg:col-span-5'

    return (
        <Container>
            <AdaptableCard>
                <div className="flex flex-col gap-6">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        <h3 className="mb-0">{t('text.titles.activityLog')}</h3>
                        <Button
                            size="sm"
                            variant="plain"
                            className="w-full sm:w-auto"
                            onClick={toggleFilters}
                        >
                            {filterVisible
                                ? t('text.actions.hideFilters', {
                                      defaultValue: 'Hide filters',
                                  })
                                : t('text.actions.showFilters', {
                                      defaultValue: 'Show filters',
                                  })}
                        </Button>
                    </div>
                    <div className="grid gap-8 lg:grid-cols-5">
                        <div
                            className={`order-last md:order-first ${logColumnClass}`}
                        >
                            <Log />
                        </div>
                        {filterVisible && (
                            <div className="lg:col-span-1">
                                <LogFilter sticky={larger.lg} />
                            </div>
                        )}
                    </div>
                </div>
            </AdaptableCard>
        </Container>
    )
}

export default ActivityLog
