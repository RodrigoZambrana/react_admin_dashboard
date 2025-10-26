import Image from "next/image"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ChevronRight } from "lucide-react"
import { StorefrontApi, isApiError } from "@/lib/api/storefront"
import type { ProductDetail, ProductSummary } from "@/types/storefront"
import { formatInventoryStatus, formatMoney } from "@/lib/utils/format"
import { AddToCartButton } from "@/components/products/AddToCartButton"
import { ProductCard } from "@/components/products/ProductCard"

interface ProductPageProps {
  params: { slug: string }
}

const pickPrimaryImage = (product: ProductDetail) => {
  if (product.gallery?.length) {
    return product.gallery[0]
  }
  if (product.thumbnail) {
    return product.thumbnail
  }
  return undefined
}

export default async function ProductPage({ params }: ProductPageProps) {
  let product: ProductDetail
  try {
    product = await StorefrontApi.getProduct(params.slug)
  } catch (error) {
    if (isApiError(error) && error.status === 404) {
      notFound()
    }
    throw error
  }

  const [recommendations, primaryImage] = await Promise.all([
    StorefrontApi.getRecommendations(product.id, 8).catch((error) => {
      if (isApiError(error)) {
        console.warn(`[product] Failed to fetch recommendations: ${error.message}`)
      }
      return [] as ProductSummary[]
    }),
    Promise.resolve(pickPrimaryImage(product)),
  ])

  const price = product.salePrice ?? product.price

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-12 px-4 py-10 sm:px-6 lg:px-8">
      <nav className="flex items-center gap-2 text-xs text-slate-500">
        <Link href="/" className="hover:text-slate-900">
          Home
        </Link>
        <ChevronRight className="h-3 w-3" />
        <Link href="/products" className="hover:text-slate-900">
          Products
        </Link>
        <ChevronRight className="h-3 w-3" />
        <span className="text-slate-900">{product.name}</span>
      </nav>

      <div className="grid gap-10 lg:grid-cols-[1.1fr,0.9fr]">
        <div className="grid gap-4">
          <div className="relative aspect-[4/5] overflow-hidden rounded-[var(--radius-lg)] bg-slate-100">
            {primaryImage?.url ? (
              <Image
                src={primaryImage.url}
                alt={primaryImage.alt ?? product.name}
                fill
                className="object-cover"
                priority
              />
            ) : (
              <div className="flex h-full items-center justify-center text-slate-400">No image</div>
            )}
          </div>
          {product.gallery?.length ? (
            <div className="grid grid-cols-4 gap-3">
              {product.gallery.slice(0, 8).map((image) => (
                <div key={image.id} className="relative aspect-square overflow-hidden rounded-xl bg-slate-100">
                  <Image src={image.url} alt={image.alt ?? product.name} fill className="object-cover" />
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <div className="space-y-6">
          <div className="space-y-3">
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              {product.categories?.[0]?.name ?? "Featured"}
            </span>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-900">{product.name}</h1>
            {product.shortDescription ? <p className="text-sm text-slate-600">{product.shortDescription}</p> : null}
          </div>

          <div className="flex items-baseline gap-3">
            <span className="text-3xl font-semibold text-slate-900">{formatMoney(price)}</span>
            {product.salePrice ? (
              <span className="text-sm text-slate-400 line-through">{formatMoney(product.price)}</span>
            ) : null}
          </div>

          <div className="rounded-[var(--radius-lg)] border border-slate-200 bg-white p-4 text-sm text-slate-600">
            <p className="font-semibold text-slate-900">Availability</p>
            <p className="mt-1 text-slate-500">{formatInventoryStatus(product.inventoryStatus)}</p>
            <p className="mt-2 text-xs text-slate-400">
              Inventory, pricing, and merchandising information sync directly from the backend. Update content without
              redeploying the storefront.
            </p>
          </div>

          <AddToCartButton product={product} className="w-full" />

          <div className="prose prose-sm max-w-none text-slate-600">
            {product.descriptionHtml ? (
              <div dangerouslySetInnerHTML={{ __html: product.descriptionHtml }} />
            ) : product.description ? (
              <p>{product.description}</p>
            ) : (
              <p>
                Detailed description managed via the administrative dashboard. Populate long-form content from the
                product editor.
              </p>
            )}
          </div>

          {product.specifications?.length ? (
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Specifications</h2>
              <dl className="mt-3 grid gap-3 text-sm text-slate-600 sm:grid-cols-2">
                {product.specifications.map((spec) => (
                  <div key={spec.label} className="rounded-xl border border-slate-200 bg-white p-3">
                    <dt className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">{spec.label}</dt>
                    <dd className="mt-1 text-sm text-slate-600">{spec.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ) : null}
        </div>
      </div>

      {recommendations.length ? (
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold tracking-tight text-slate-900">You may also like</h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {recommendations.map((recommended) => (
              <ProductCard key={recommended.id} product={recommended} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  )
}
