import Link from "next/link"

interface OrderPageProps {
  params: { orderId: string }
}

export default function OrderPage({ params }: OrderPageProps) {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-12 sm:px-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-slate-900">Order tracking</h1>
        <p className="text-sm text-slate-500">
          Detailed tracking for order #{params.orderId} will be available once the storefront order endpoints are
          finalized. The backend already stores order data—wire up fulfillment status, shipment updates, and customer
          notifications from the administrative dashboard.
        </p>
      </header>
      <div className="rounded-[var(--radius-lg)] border border-slate-200 bg-white p-10 text-center text-slate-500">
        This placeholder view demonstrates where order-specific timelines, invoices, and communication history will
        appear. Integrate the `/storefront/orders/:id` endpoint to hydrate this page with live data.
        <div className="mt-4">
          <Link href="/products" className="inline-flex items-center rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white">
            Return to store
          </Link>
        </div>
      </div>
    </div>
  )
}
