import { useTranslation } from 'react-i18next'

const PaymentsHeaderTitle = () => {
    const { t } = useTranslation()
    return <h3>{t('menu.accounting.payments')}</h3>
}

export default PaymentsHeaderTitle
