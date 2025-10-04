import Button from '@/components/ui/Button'
import { useTranslation } from 'react-i18next'
import { HiDownload, HiPlusCircle } from 'react-icons/hi'
import ProductTableSearch from './ProductTableSearch'
import CurrencySelector from '@/components/shared/CurrencySelector'
import ProductFilter from './ProductFilter'
import { Link } from 'react-router-dom'

const ProductTableTools = () => {
    const { t } = useTranslation()
    return (
        <div className="flex flex-col lg:flex-row lg:items-center gap-3">
            <ProductTableSearch />
            <ProductFilter />
            <CurrencySelector size="sm" />
            <Link
                download
                className="block lg:inline-block md:mx-2 md:mb-0 mb-4"
                to="/data/product-list.csv"
                target="_blank"
            >
                <Button block size="sm" icon={<HiDownload />}>
                    {t('text.actions.export')}
                </Button>
            </Link>
            <Link
                className="block lg:inline-block md:mb-0 mb-4"
                to="/app/sales/order-new?addProduct=1"
            >
                <Button block variant="solid" size="sm" icon={<HiPlusCircle />}>
                    {t('text.actions.addProduct')}
                </Button>
            </Link>
        </div>
    )
}

export default ProductTableTools
