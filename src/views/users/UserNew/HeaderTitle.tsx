import { useTranslation } from 'react-i18next'

const HeaderTitle = () => {
    const { t } = useTranslation()
    return <h3>{t('nav.appsUsers.userNew')}</h3>
}

export default HeaderTitle

