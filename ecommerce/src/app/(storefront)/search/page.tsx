export default function SearchPage() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-10 sm:px-6 lg:px-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Search catalog</h1>
        <p className="text-sm text-slate-500">
          Real-time search is handled by the backend catalog service. Hook this page into `/storefront/products` with
          debounced queries to deliver instant results across categories, tags, and collections.
        </p>
      </header>
      <div className="rounded-[var(--radius-lg)] border border-slate-200 bg-white p-10 text-slate-500">
        Implement a client-side search experience by calling the catalog endpoint with query parameters. The backend is
        optimized for full-text search and faceted filtering, ensuring parity between the storefront and the
        administrative dashboard.
      </div>
    </div>
  )
}
