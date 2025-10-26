// @ts-nocheck

import Link from "next/link"
import { Plus, SlidersHorizontal } from "lucide-react"
import { StorefrontApi, isApiError } from "@/lib/api/storefront"
import type { ProductListQuery, ProductSummary } from "@/types/storefront"
import { ProductCard } from "@/components/products/ProductCard"

interface ProductsPageSearchParams {
  page?: string
  sort?: "newest" | "price-asc" | "price-desc" | "featured" | "best-sellers"
  category?: string
  search?: string
}

interface ProductsPageProps {
  searchParams?: Promise<ProductsPageSearchParams>
}

const parseQuery = (params: ProductsPageSearchParams | undefined): ProductListQuery => {
  const page = params?.page ? Number.parseInt(params.page, 10) : 1
  return {
    page: Number.isNaN(page) ? 1 : Math.max(page, 1),
    pageSize: 12,
    categorySlug: params?.category,
    sort: params?.sort,
    search: params?.search,
  }
}

const buildPagination = (totalPages: number, currentPage: number): number[] => {
  const pages: number[] = []
  const maxPages = Math.min(totalPages, 8)
  for (let page = 1; page <= maxPages; page += 1) {
    pages.push(page)
  }
  if (!pages.includes(currentPage) && currentPage <= totalPages) {
    pages.push(currentPage)
  }
  return pages
}

export default async function ProductsPage({ searchParams }: ProductsPageProps) {
  const resolvedParams = await searchParams
  const query = parseQuery(resolvedParams)

  const [productResponse, categories] = await Promise.all([
    StorefrontApi.listProducts(query).catch((error) => {
      if (isApiError(error)) {
        console.warn(`[products] Failed to fetch products: ${error.message}`)
      } else {
        console.warn("[products] Unexpected error while fetching products", error)
      }
      return {
        data: [] as ProductSummary[],
        total: 0,
        totalPages: 1,
        page: query.page ?? 1,
        pageSize: query.pageSize ?? 12,
      }
    }),
    StorefrontApi.listCategories().catch((error) => {
      if (isApiError(error)) {
        console.warn(`[products] Failed to fetch categories: ${error.message}`)
      }
      return []
    }),
  ])

  const paginationPages = buildPagination(productResponse.totalPages ?? 1, query.page ?? 1)

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-12 px-4 py-10 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Shop products</h1>
          <p className="text-sm text-slate-500">
            Discover configurable merchandising powered by the administrative dashboard.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/products?sort=newest"
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:border-slate-400 hover:text-slate-900"
          >
            <SlidersHorizontal className="h-4 w-4" />
            Sort & filter
          </Link>
          <span className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">
            {productResponse.total} items
          </span>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-[16rem,1fr]">
        <aside className="space-y-6 rounded-[var(--radius-lg)] border border-slate-200 bg-white p-6 shadow-sm">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Categories</h2>
            <ul className="mt-4 space-y-3 text-sm">
              <li>
                <Link
                  href="/products"
                  className={`block rounded-lg px-3 py-2 transition hover:bg-slate-100 ${!query.categorySlug ? "bg-slate-900 text-white" : "text-slate-600"}`}
                >
                  All products
                </Link>
              </li>
              {categories.map((category) => (
                <li key={category.id}>
                  <Link
                    href={`/products?category=${category.slug}`}
                    className={`flex items-center justify-between rounded-lg px-3 py-2 transition hover:bg-slate-100 ${
                      query.categorySlug === category.slug ? "bg-slate-900 text-white" : "text-slate-600"
                    }`}
                  >
                    <span>{category.name}</span>
                    <span className="text-xs text-slate-400">{category.productCount}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-xl bg-slate-900/5 p-4 text-sm text-slate-600">
            <p className="font-semibold text-slate-900">Need assistance?</p>
            <p className="mt-2">
              Products sync automatically from the backend catalog. Update pricing, inventory, and visibility without
              redeploying the storefront.
            </p>
            <Link
              href="/contact"
              className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-slate-900 hover:text-slate-600"
            >
              <Plus className="h-4 w-4" />
              Talk to sales
            </Link>
          </div>
        </aside>
        <section className="space-y-6">
          {productResponse.data.length === 0 ? (
            <div className="rounded-[var(--radius-lg)] border border-slate-200 bg-white p-12 text-center text-slate-500">
              No products found. Adjust your filters or update the catalog in the admin dashboard.
            </div>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {productResponse.data.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}

          <div className="flex items-center justify-center gap-2">
            {paginationPages.map((page) => (
              <Link
                key={page}
                href={`/products?page=${page}${query.categorySlug ? `&category=${query.categorySlug}` : ""}`}
                className={`inline-flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold transition ${
                  page === (query.page ?? 1)
                    ? "bg-slate-900 text-white"
                    : "border border-slate-200 text-slate-600 hover:bg-slate-100"
                }`}
              >
                {page}
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
