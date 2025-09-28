import Tabs from '@/components/ui/Tabs'
import { useTranslation } from 'react-i18next'
import { labelList } from '../utils'
import { setSelectedTab, useAppDispatch, useAppSelector } from '../store'

const { TabNav, TabList } = Tabs

const QuickFilterTab = () => {
    const dispatch = useAppDispatch()
    const { t } = useTranslation()

    const selectedTab = useAppSelector(
        (state) => state.scrumBoard.data.selectedTab,
    )

    const handleTabChange = (val: string) => {
        dispatch(setSelectedTab(val))
    }

    return (
        <Tabs value={selectedTab} variant="pill" onChange={handleTabChange}>
            <TabList>
                <TabNav value="all">{t('text.filters.all')}</TabNav>
                {labelList.map((key, index) => (
                    <TabNav key={`${key}-${index}`} value={key}>
                        {t(`text.priority.${key}`)}
                    </TabNav>
                ))}
            </TabList>
        </Tabs>
    )
}

export default QuickFilterTab
