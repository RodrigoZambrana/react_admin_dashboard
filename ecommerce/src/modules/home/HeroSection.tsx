// @ts-nocheck

import Image from "next/image"
import Link from "next/link"
import type { HeroModuleConfig } from "@/types/storefront"

interface HeroSectionProps {
  config: HeroModuleConfig
}

const alignmentClass: Record<NonNullable<HeroModuleConfig["emphasis"]>, string> = {
  left: "items-start text-left",
  center: "items-center text-center",
  right: "items-end text-right",
}

export const HeroSection: React.FC<HeroSectionProps> = ({ config }) => {
  const align = alignmentClass[config.emphasis ?? "left"]
  return (
    <section className="relative overflow-hidden rounded-[var(--radius-lg)] bg-slate-900 text-white shadow-lg">
      {config.image?.url ? (
        <div className="absolute inset-0">
          <Image
            src={config.image.url}
            alt={config.image.alt ?? config.title ?? "Hero background"}
            fill
            className="object-cover opacity-40"
            priority
          />
        </div>
      ) : null}
      <div className="relative mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-24 sm:px-10 sm:py-32 md:px-12 lg:px-16">
        <div className={`flex max-w-2xl flex-col gap-4 ${align}`}>
          {config.eyebrow ? (
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-white/70">
              {config.eyebrow}
            </span>
          ) : null}
          {config.title ? (
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl lg:text-5xl">{config.title}</h1>
          ) : null}
          {config.subtitle ? (
            <p className="text-base text-white/80 sm:text-lg lg:text-xl">{config.subtitle}</p>
          ) : null}
          {config.description ? (
            <p className="text-sm text-white/70 sm:text-base">{config.description}</p>
          ) : null}
        </div>
        {(config.ctas?.length || config.secondaryActions?.length) ? (
          <div
            className={`flex flex-wrap gap-3 ${config.emphasis === "center" ? "justify-center" : "justify-start"}`}
          >
            {config.ctas?.map((cta) => (
              <Link
                key={cta.href}
                href={cta.href}
                className="inline-flex items-center rounded-full bg-white px-5 py-2 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-200"
              >
                {cta.label}
              </Link>
            ))}
            {config.secondaryActions?.map((cta) => (
              <Link
                key={cta.href}
                href={cta.href}
                className="inline-flex items-center rounded-full border border-white/40 px-5 py-2 text-sm font-semibold text-white transition hover:border-white"
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
