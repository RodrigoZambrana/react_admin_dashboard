import type { ProductGridModuleConfig, ProductSummary } from "@/types/storefront"
import { ProductCard } from "@/components/products/ProductCard"
import Link from "next/link"

interface ProductCollectionSectionProps {
  config: ProductGridModuleConfig
  products: ProductSummary[]
}

export const ProductCollectionSection: React.FC<ProductCollectionSectionProps> = ({ config, products }) => {
  if (!products.length) {
    return null
  }

  const header = (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {config.title ? <h2 className="text-2xl font-semibold tracking-tight text-slate-900">{config.title}</h2> : null}
        {config.subtitle ? <p className="mt-1 text-sm text-slate-500">{config.subtitle}</p> : null}
      </div>
      <Link
        href="/products"
        className="inline-flex items-center text-sm font-semibold text-slate-600 transition hover:text-slate-900"
      >
        View all
      </Link>
    </div>
  )

  if (config.layout === "carousel") {
    return (
      <section className="space-y-6">
        {header}
        <div className="-mx-4 overflow-x-auto pb-4">
          <div className="flex gap-4 px-4">
            {products.map((product) => (
              <div key={product.id} className="min-w-[16rem] max-w-[16rem] flex-shrink-0">
                <ProductCard product={product} />
              </div>
            ))}
          </div>
        </div>
      </section>
    )
  }

  const columns = Math.min(config.columns ?? 4, 4)
  const columnClass: Record<number, string> = {
    2: "lg:grid-cols-2 xl:grid-cols-2",
    3: "lg:grid-cols-3 xl:grid-cols-3",
    4: "lg:grid-cols-4 xl:grid-cols-4",
  }

  return (
    <section className="space-y-6">
      {header}
      <div className={`grid gap-6 sm:grid-cols-2 ${columnClass[columns] ?? "lg:grid-cols-4"}`}>
        {products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </section>
  )
}
