"use client"

import { useState } from "react"
import Link from "next/link"
import { useCart } from "@/state/cart-context"
import { formatMoney } from "@/lib/utils/format"
import { StorefrontApi, isApiError } from "@/lib/api/storefront"

interface CheckoutFormState {
  status: "idle" | "submitting" | "success" | "error"
  error?: string
  orderId?: string
}

export const CheckoutForm: React.FC = () => {
  const { state, subtotal, clearCart } = useCart()
  const [formState, setFormState] = useState<CheckoutFormState>({ status: "idle" })

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    setFormState({ status: "submitting" })

    try {
      const payload = {
        customer: {
          email: String(formData.get("email") ?? ""),
          firstName: String(formData.get("firstName") ?? ""),
          lastName: String(formData.get("lastName") ?? ""),
          phone: String(formData.get("phone") ?? ""),
        },
        shippingAddress: {
          line1: String(formData.get("address1") ?? ""),
          line2: String(formData.get("address2") ?? ""),
          city: String(formData.get("city") ?? ""),
          state: String(formData.get("state") ?? ""),
          zip: String(formData.get("zip") ?? ""),
          country: String(formData.get("country") ?? ""),
        },
        billingAddress: undefined,
        items: state.items.map(({ product, quantity }) => ({ productId: product.id, quantity })),
        notes: String(formData.get("notes") ?? ""),
      }

      const order = await StorefrontApi.createOrder(payload)
      clearCart()
      setFormState({ status: "success", orderId: String(order.id) })
    } catch (error) {
      if (isApiError(error)) {
        setFormState({ status: "error", error: error.message })
      } else {
        setFormState({ status: "error", error: "Unexpected error processing your order." })
      }
    }
  }

  if (formState.status === "success") {
    return (
      <div className="rounded-[var(--radius-lg)] border border-emerald-200 bg-emerald-50 p-8 text-emerald-900">
        <h2 className="text-xl font-semibold">Order confirmed</h2>
        <p className="mt-3 text-sm">
          Thank you! Your order has been registered in the backend. Track status and fulfilment through the
          administrative dashboard.
        </p>
        <p className="mt-4 text-sm font-semibold">Order ID: {formState.orderId}</p>
        <Link href="/" className="mt-6 inline-flex items-center rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white">
          Continue shopping
        </Link>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-6 lg:grid-cols-[1.5fr,1fr]">
      <div className="space-y-6">
        <section className="rounded-[var(--radius-lg)] border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Contact information</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-2 text-sm text-slate-600">
              First name
              <input name="firstName" required className="rounded-lg border border-slate-200 px-3 py-2 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200" />
            </label>
            <label className="flex flex-col gap-2 text-sm text-slate-600">
              Last name
              <input name="lastName" required className="rounded-lg border border-slate-200 px-3 py-2 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200" />
            </label>
            <label className="flex flex-col gap-2 text-sm text-slate-600 sm:col-span-2">
              Email
              <input type="email" name="email" required className="rounded-lg border border-slate-200 px-3 py-2 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200" />
            </label>
            <label className="flex flex-col gap-2 text-sm text-slate-600 sm:col-span-2">
              Phone
              <input name="phone" className="rounded-lg border border-slate-200 px-3 py-2 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200" />
            </label>
          </div>
        </section>

        <section className="rounded-[var(--radius-lg)] border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Shipping address</h2>
          <div className="mt-4 grid gap-4">
            <label className="flex flex-col gap-2 text-sm text-slate-600">
              Address line 1
              <input name="address1" required className="rounded-lg border border-slate-200 px-3 py-2 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200" />
            </label>
            <label className="flex flex-col gap-2 text-sm text-slate-600">
              Address line 2
              <input name="address2" className="rounded-lg border border-slate-200 px-3 py-2 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200" />
            </label>
            <div className="grid gap-4 sm:grid-cols-3">
              <label className="flex flex-col gap-2 text-sm text-slate-600">
                City
                <input name="city" required className="rounded-lg border border-slate-200 px-3 py-2 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200" />
              </label>
              <label className="flex flex-col gap-2 text-sm text-slate-600">
                State
                <input name="state" className="rounded-lg border border-slate-200 px-3 py-2 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200" />
              </label>
              <label className="flex flex-col gap-2 text-sm text-slate-600">
                ZIP / Postal code
                <input name="zip" required className="rounded-lg border border-slate-200 px-3 py-2 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200" />
              </label>
            </div>
            <label className="flex flex-col gap-2 text-sm text-slate-600">
              Country
              <input name="country" required className="rounded-lg border border-slate-200 px-3 py-2 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200" />
            </label>
            <label className="flex flex-col gap-2 text-sm text-slate-600">
              Notes
              <textarea name="notes" rows={3} className="rounded-lg border border-slate-200 px-3 py-2 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200" />
            </label>
          </div>
        </section>
      </div>

      <aside className="space-y-4 rounded-[var(--radius-lg)] border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Order summary</h2>
        <div className="space-y-4 text-sm text-slate-600">
          {state.items.map(({ product, quantity }) => (
            <div key={product.id} className="flex items-center justify-between">
              <span>{product.name}</span>
              <span className="font-semibold text-slate-900">
                {formatMoney({ amount: (product.salePrice ?? product.price).amount * quantity, currency: product.price.currency })}
              </span>
            </div>
          ))}
        </div>
        <div className="border-t border-slate-200 pt-4 text-sm">
          <div className="flex items-center justify-between">
            <span>Subtotal</span>
            <span className="font-semibold text-slate-900">{formatMoney(subtotal)}</span>
          </div>
          <p className="mt-2 text-xs text-slate-400">Taxes and shipping are calculated once the order is confirmed in the backend.</p>
        </div>
        {formState.status === "error" ? (
          <p className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{formState.error}</p>
        ) : null}
        <button
          type="submit"
          disabled={formState.status === "submitting"}
          className="inline-flex w-full items-center justify-center rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          {formState.status === "submitting" ? "Processing..." : "Place order"}
        </button>
      </aside>
    </form>
  )
}
