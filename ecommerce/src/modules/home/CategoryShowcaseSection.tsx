import Link from "next/link"
import type { CategoryGridModuleConfig, CategorySummary } from "@/types/storefront"

interface CategoryShowcaseSectionProps {
  config: CategoryGridModuleConfig
  categories: CategorySummary[]
}

export const CategoryShowcaseSection: React.FC<CategoryShowcaseSectionProps> = ({ config, categories }) => {
  if (!categories.length) return null

  const items = categories.slice(0, config.limit ?? categories.length)
  const layoutClass = config.layout === "carousel" ? "flex gap-4 overflow-x-auto pb-4" : "grid gap-4 sm:grid-cols-2 lg:grid-cols-3"

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          {config.title ? <h2 className="text-2xl font-semibold tracking-tight text-slate-900">{config.title}</h2> : null}
          {config.subtitle ? <p className="mt-1 text-sm text-slate-500">{config.subtitle}</p> : null}
        </div>
        <Link href="/categories" className="text-sm font-semibold text-slate-600 hover:text-slate-900">
          Explore all
        </Link>
      </div>
      <div className={layoutClass}>
        {items.map((category) => (
          <Link
            key={category.id}
            href={`/categories/${category.slug}`}
            className="group relative overflow-hidden rounded-[var(--radius-lg)] border border-slate-200 bg-white p-6 transition hover:border-slate-400 hover:shadow-lg"
          >
            <div className="flex flex-col gap-3">
              <span className="text-base font-semibold text-slate-900">{category.name}</span>
              {category.description ? <p className="text-sm text-slate-500 line-clamp-2">{category.description}</p> : null}
              <span className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">
                {category.productCount} {category.productCount === 1 ? "product" : "products"}
              </span>
            </div>
            <span className="pointer-events-none absolute right-6 top-6 text-sm font-semibold text-slate-400 transition group-hover:text-slate-900">
              Shop →
            </span>
          </Link>
        ))}
      </div>
    </section>
  )
}
