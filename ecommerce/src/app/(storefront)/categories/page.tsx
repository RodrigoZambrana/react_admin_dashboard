import Link from "next/link"
import { StorefrontApi, isApiError } from "@/lib/api/storefront"
import type { CategorySummary } from "@/types/storefront"

export default async function CategoriesPage() {
  const categories = await StorefrontApi.listCategories().catch((error) => {
    if (isApiError(error)) {
      console.warn(`[categories] Failed to load categories: ${error.message}`)
    }
    return [] as CategorySummary[]
  })

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-10 sm:px-6 lg:px-8">
      <header className="space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Browse categories</h1>
        <p className="text-sm text-slate-500">
          Categories are fully manageable from the administrative dashboard. Update hierarchies, hero assets, and
          featured products without touching the storefront code.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {categories.map((category) => (
          <Link
            key={category.id}
            href={`/categories/${category.slug}`}
            className="group relative overflow-hidden rounded-[var(--radius-lg)] border border-slate-200 bg-white p-6 transition hover:-translate-y-1 hover:border-slate-400 hover:shadow-lg"
          >
            <div className="flex flex-col gap-3">
              <span className="text-lg font-semibold text-slate-900">{category.name}</span>
              {category.description ? (
                <p className="text-sm text-slate-500 line-clamp-2">{category.description}</p>
              ) : null}
              <span className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">
                {category.productCount} {category.productCount === 1 ? "product" : "products"}
              </span>
            </div>
            <span className="pointer-events-none absolute right-6 top-6 text-sm font-semibold text-slate-400 transition group-hover:text-slate-900">
              Explore →
            </span>
          </Link>
        ))}
      </div>
    </div>
  )
}
