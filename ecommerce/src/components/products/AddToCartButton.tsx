"use client"

import { ShoppingCart } from "lucide-react"
import type { ProductSummary } from "@/types/storefront"
import { useCart } from "@/state/cart-context"

interface AddToCartButtonProps {
  product: ProductSummary
  quantity?: number
  className?: string
}

export const AddToCartButton: React.FC<AddToCartButtonProps> = ({ product, quantity = 1, className }) => {
  const { addItem } = useCart()

  return (
    <button
      type="button"
      onClick={() => addItem(product, quantity)}
      className={`inline-flex w-full items-center justify-center gap-2 rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-700 ${className ?? ""}`}
    >
      <ShoppingCart className="h-4 w-4" />
      Add to cart
    </button>
  )
}
