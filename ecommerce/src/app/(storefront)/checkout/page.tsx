import Link from "next/link"
import { CheckoutForm } from "@/components/checkout/CheckoutForm"

export default function CheckoutPage() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-10 sm:px-6 lg:px-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Checkout</h1>
        <p className="text-sm text-slate-500">
          Secure checkout powered by the backend REST API. Authentication, fraud checks, and payment orchestration are
          handled server-side to keep sensitive logic off the client.
        </p>
        <p className="text-xs text-slate-400">
          Already have an account? <Link href="/account/login" className="font-semibold text-slate-900 hover:text-slate-600">Sign in</Link> for a faster experience.
        </p>
      </header>
      <CheckoutForm />
    </div>
  )
}
