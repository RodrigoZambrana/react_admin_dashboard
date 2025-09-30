import ProductCategories from '@/views/settings/ProductCategories'
import ProductStatuses from '@/views/settings/ProductStatuses'

const ProductSettings = () => {
    return (
        <div className="flex flex-col gap-4 h-full">
            <ProductCategories />
            <ProductStatuses />
        </div>
    )
}

export default ProductSettings

