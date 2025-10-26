"use client"

import Image from "next/image"
import Link from "next/link"
import { ShoppingCart, Star } from "lucide-react"
import { useCart } from "@/state/cart-context"
import type { ProductSummary } from "@/types/storefront"
import { formatInventoryStatus, formatMoney } from "@/lib/utils/format"

interface ProductCardProps {
  product: ProductSummary
  layout?: "grid" | "list" | "stacked"
}

export const ProductCard: React.FC<ProductCardProps> = ({ product, layout = "grid" }) => {
  const { addItem } = useCart()
  const price = product.salePrice ?? product.price

  return (
    <article
      className={`group overflow-hidden rounded-[var(--radius-lg)] border border-slate-200 bg-white transition hover:-translate-y-1 hover:shadow-xl ${
        layout === "stacked" ? "flex h-full flex-col" : ""
      }`}
    >
      <Link href={`/products/${product.slug}`} className="relative block aspect-[4/5] overflow-hidden bg-slate-50">
        {product.thumbnail?.url ? (
          <Image
            src={product.thumbnail.url}
            alt={product.thumbnail.alt ?? product.name}
            fill
            className="object-cover transition duration-700 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-slate-100 text-slate-400">No image</div>
        )}
        {product.badges?.length ? (
          <div className="absolute left-3 top-3 flex flex-col gap-2">
            {product.badges.map((badge) => (
              <span
                key={badge}
                className="inline-flex rounded-full bg-white/90 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-900 shadow-sm"
              >
                {badge}
              </span>
            ))}
          </div>
        ) : null}
      </Link>

      <div className="flex flex-1 flex-col gap-4 px-4 pb-4 pt-5">
        <div className="flex flex-col gap-2">
          <Link
            href={`/products/${product.slug}`}
            className="text-base font-semibold text-slate-900 transition hover:text-slate-600"
          >
            {product.name}
          </Link>
          {product.shortDescription ? (
            <p className="text-sm text-slate-500 line-clamp-2">{product.shortDescription}</p>
          ) : null}
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-baseline gap-2">
            <span className="text-lg font-semibold text-slate-900">{formatMoney(price)}</span>
            {product.salePrice ? (
              <span className="text-sm text-slate-400 line-through">{formatMoney(product.price)}</span>
            ) : null}
          </div>
          {product.rating ? (
            <div className="flex items-center gap-1 text-xs text-amber-500">
              <Star className="h-4 w-4 fill-current" />
              <span>{product.rating.toFixed(1)}</span>
              {product.ratingCount ? <span className="text-slate-400">({product.ratingCount})</span> : null}
            </div>
          ) : null}
        </div>

        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>{formatInventoryStatus(product.inventoryStatus)}</span>
          {product.categories?.[0] ? <span>{product.categories[0].name}</span> : null}
        </div>

        <button
          type="button"
          onClick={() => addItem(product, 1)}
          className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-700"
        >
          <ShoppingCart className="h-4 w-4" />
          Add to cart
        </button>
      </div>
    </article>
  )
}
