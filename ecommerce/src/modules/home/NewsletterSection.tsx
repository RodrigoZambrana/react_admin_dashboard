import type { NewsletterModuleConfig } from "@/types/storefront"

interface NewsletterSectionProps {
  config: NewsletterModuleConfig
}

export const NewsletterSection: React.FC<NewsletterSectionProps> = ({ config }) => {
  return (
    <section className="rounded-[var(--radius-lg)] border border-slate-200 bg-white p-8 shadow-sm">
      {config.title ? <h2 className="text-2xl font-semibold tracking-tight text-slate-900">{config.title}</h2> : null}
      {config.description ? <p className="mt-2 text-sm text-slate-500">{config.description}</p> : null}
      <form className="mt-6 flex flex-col gap-3 sm:flex-row">
        <label className="flex-1">
          <span className="sr-only">Email address</span>
          <input
            type="email"
            required
            placeholder={config.placeholder ?? "you@example.com"}
            className="w-full rounded-full border border-slate-200 px-5 py-3 text-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
          />
        </label>
        <button
          type="submit"
          className="inline-flex items-center justify-center rounded-full bg-slate-900 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-700"
        >
          Subscribe
        </button>
      </form>
      {config.consentMessage ? <p className="mt-3 text-xs text-slate-500">{config.consentMessage}</p> : null}
      {config.legalLinks?.length ? (
        <div className="mt-3 flex flex-wrap gap-3 text-xs">
          {config.legalLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="font-semibold text-slate-600 hover:text-slate-900"
            >
              {link.label}
            </a>
          ))}
        </div>
      ) : null}
    </section>
  )
}
