"use client"

import Link from "next/link"
import Image from "next/image"
import { Trash2 } from "lucide-react"
import { useCart } from "@/state/cart-context"
import { formatMoney } from "@/lib/utils/format"

export const CartView: React.FC = () => {
  const { state, removeItem, updateQuantity, subtotal } = useCart()

  if (state.items.length === 0) {
    return (
      <div className="rounded-[var(--radius-lg)] border border-slate-200 bg-white p-12 text-center text-slate-500">
        Your cart is empty. Products are curated from the backend catalog—start exploring the store.
        <div className="mt-4">
          <Link
            href="/products"
            className="inline-flex items-center rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-700"
          >
            Browse products
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1.7fr,1fr]">
      <div className="space-y-4">
        {state.items.map(({ product, quantity }) => (
          <div key={product.id} className="flex gap-4 rounded-[var(--radius-lg)] border border-slate-200 bg-white p-4 shadow-sm">
            <div className="relative h-24 w-24 overflow-hidden rounded-xl bg-slate-100">
              {product.thumbnail?.url ? (
                <Image
                  src={product.thumbnail.url}
                  alt={product.thumbnail.alt ?? product.name}
                  fill
                  className="object-cover"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-xs text-slate-400">No image</div>
              )}
            </div>
            <div className="flex flex-1 flex-col justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">{product.name}</h3>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{product.inventoryStatus}</p>
              </div>
              <div className="flex items-center justify-between">
                <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1">
                  <button
                    type="button"
                    className="text-sm text-slate-600 hover:text-slate-900"
                    onClick={() => updateQuantity(product.id, Math.max(1, quantity - 1))}
                  >
                    -
                  </button>
                  <span className="text-sm font-semibold text-slate-900">{quantity}</span>
                  <button
                    type="button"
                    className="text-sm text-slate-600 hover:text-slate-900"
                    onClick={() => updateQuantity(product.id, quantity + 1)}
                  >
                    +
                  </button>
                </div>
                <span className="text-sm font-semibold text-slate-900">
                  {formatMoney({ amount: (product.salePrice ?? product.price).amount * quantity, currency: product.price.currency })}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => removeItem(product.id)}
              className="self-start rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              aria-label="Remove item"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
      <div className="space-y-4 rounded-[var(--radius-lg)] border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Order summary</h2>
        <div className="space-y-2 text-sm text-slate-600">
          <div className="flex items-center justify-between">
            <span>Subtotal</span>
            <span className="font-semibold text-slate-900">{formatMoney(subtotal)}</span>
          </div>
          <div className="flex items-center justify-between text-slate-400">
            <span>Shipping</span>
            <span>Calculated at checkout</span>
          </div>
          <div className="flex items-center justify-between text-slate-400">
            <span>Taxes</span>
            <span>Calculated at checkout</span>
          </div>
        </div>
        <Link
          href="/checkout"
          className="inline-flex w-full items-center justify-center rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-700"
        >
          Proceed to checkout
        </Link>
        <p className="text-xs text-slate-400">
          Orders are processed through the backend API. Integrate payment providers and logistics systems via the
          administrative dashboard.
        </p>
      </div>
    </div>
  )
}
