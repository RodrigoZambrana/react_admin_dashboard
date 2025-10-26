import Link from "next/link"
import { notFound } from "next/navigation"
import { StorefrontApi, isApiError } from "@/lib/api/storefront"
import type { CategorySummary, ProductSummary } from "@/types/storefront"
import { ProductCard } from "@/components/products/ProductCard"

interface CategoryPageProps {
  params: { slug: string }
}

export default async function CategoryPage({ params }: CategoryPageProps) {
  const categories = await StorefrontApi.listCategories().catch((error) => {
    if (isApiError(error)) {
      console.warn(`[category] Failed to load categories: ${error.message}`)
    }
    return [] as CategorySummary[]
  })

  const category = categories.find((item) => item.slug === params.slug)
  if (!category) {
    notFound()
  }

  const products = await StorefrontApi.listProducts({ categorySlug: category.slug, pageSize: 24 }).catch((error) => {
    if (isApiError(error)) {
      console.warn(`[category] Failed to load products: ${error.message}`)
    }
    return { data: [] as ProductSummary[], total: 0, page: 1, pageSize: 24, totalPages: 1 }
  })

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-10 sm:px-6 lg:px-8">
      <nav className="flex items-center gap-2 text-xs text-slate-500">
        <Link href="/" className="hover:text-slate-900">
          Home
        </Link>
        <span>/</span>
        <Link href="/categories" className="hover:text-slate-900">
          Categories
        </Link>
        <span>/</span>
        <span className="text-slate-900">{category.name}</span>
      </nav>

      <header className="space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">{category.name}</h1>
        {category.description ? <p className="text-sm text-slate-500">{category.description}</p> : null}
        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{category.productCount} products</p>
      </header>

      {products.data.length ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {products.data.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      ) : (
        <div className="rounded-[var(--radius-lg)] border border-slate-200 bg-white p-12 text-center text-slate-500">
          Products for this category are managed from the dashboard. Add new items or publish inventory to populate this
          view.
        </div>
      )}
    </div>
  )
}
