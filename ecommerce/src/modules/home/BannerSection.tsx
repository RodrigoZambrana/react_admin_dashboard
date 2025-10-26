// @ts-nocheck

import Image from "next/image"
import Link from "next/link"
import type { BannerModuleConfig } from "@/types/storefront"

interface BannerSectionProps {
  config: BannerModuleConfig
}

export const BannerSection: React.FC<BannerSectionProps> = ({ config }) => {
  return (
    <section className="relative overflow-hidden rounded-[var(--radius-lg)] border border-slate-200 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white shadow-lg">
      {config.image?.url ? (
        <div className="absolute inset-0 opacity-20">
          <Image
            src={config.image.url}
            alt={config.image.alt ?? config.title ?? "Promotion"}
            fill
            className="object-cover"
          />
        </div>
      ) : null}
      <div className="relative mx-auto flex w-full max-w-5xl flex-col gap-4 px-6 py-16 sm:px-10 lg:px-16">
        {config.badge ? (
          <span className="inline-flex w-fit items-center rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase">
            {config.badge}
          </span>
        ) : null}
        {config.title ? <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">{config.title}</h2> : null}
        {config.subtitle ? <p className="text-base text-white/80">{config.subtitle}</p> : null}
        {config.description ? <p className="text-sm text-white/70">{config.description}</p> : null}
        {config.ctas?.length ? (
          <div className="mt-2 flex flex-wrap gap-3">
            {config.ctas.map((cta) => (
              <Link
                key={cta.href}
                href={cta.href}
                className="inline-flex items-center rounded-full bg-white px-5 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-200"
              >
                {cta.label}
              </Link>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  )
}
