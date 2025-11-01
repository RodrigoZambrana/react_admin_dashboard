import { useTranslation } from 'react-i18next'

const ProductSettingsHeaderTitle = () => {
    const { t } = useTranslation()
    return <h3>{t('menu.products.config')}</h3>
}

export default ProductSettingsHeaderTitle
