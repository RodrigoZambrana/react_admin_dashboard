import { useTranslation } from 'react-i18next'

const HeaderTitle = () => {
    const { t } = useTranslation()
    return <h3>{t('nav.appsSales.productNew')}</h3>
}

export default HeaderTitle

