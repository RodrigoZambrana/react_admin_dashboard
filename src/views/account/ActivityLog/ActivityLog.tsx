import AdaptableCard from '@/components/shared/AdaptableCard'
import Container from '@/components/shared/Container'
import Log from './components/Log'
import LogFilter from './components/LogFilter'
import reducer from './store'
import { injectReducer } from '@/store'
import { useTranslation } from 'react-i18next'

injectReducer('accountActivityLog', reducer)

const ActivityLog = () => {
    const { t } = useTranslation()
    return (
        <Container>
            <AdaptableCard>
                <div className="grid lg:grid-cols-5 gap-8 ">
                    <div className="col-span-4 order-last md:order-first">
                        <h3 className="mb-6">{t('text.titles.activityLog')}</h3>
                        <Log />
                    </div>
                    <LogFilter />
                </div>
            </AdaptableCard>
        </Container>
    )
}

export default ActivityLog
