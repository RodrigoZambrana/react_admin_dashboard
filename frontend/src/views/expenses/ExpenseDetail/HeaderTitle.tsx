import { useTranslation } from 'react-i18next'

const HeaderTitle = () => {
    const { t } = useTranslation()
    return <span>{t('expenses.detail.pageTitle', { defaultValue: 'Detalle de gasto' })}</span>
}

export default HeaderTitle
