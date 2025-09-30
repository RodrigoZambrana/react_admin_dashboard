import { useTranslation } from 'react-i18next'

const HeaderTitle = () => {
    const { t } = useTranslation()
    return <h3>{t('text.titles.activityDetails')}</h3>
}

export default HeaderTitle

