// @ts-nocheck

import Image from "next/image"
import Link from "next/link"
import type { StoryHighlightModuleConfig } from "@/types/storefront"

interface StoryHighlightSectionProps {
  config: StoryHighlightModuleConfig
}

export const StoryHighlightSection: React.FC<StoryHighlightSectionProps> = ({ config }) => {
  const story = config.story
  if (!story) return null

  return (
    <section className="grid gap-6 overflow-hidden rounded-[var(--radius-lg)] border border-slate-200 bg-white p-6 shadow-sm sm:grid-cols-[3fr,2fr] sm:p-8">
      <div className="flex flex-col gap-4">
        {config.title ? <h2 className="text-2xl font-semibold tracking-tight text-slate-900">{config.title}</h2> : null}
        <h3 className="text-lg font-semibold text-slate-900">{story.heading}</h3>
        <p className="text-sm text-slate-500 whitespace-pre-line">{story.body}</p>
        <div className="flex flex-col text-sm text-slate-600">
          <span className="font-semibold text-slate-800">{story.author}</span>
          {story.role ? <span>{story.role}</span> : null}
        </div>
        {config.cta ? (
          <Link
            href={config.cta.href}
            className="inline-flex w-fit items-center rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
          >
            {config.cta.label}
          </Link>
        ) : null}
      </div>
      {story.image?.url ? (
        <div className="relative aspect-[4/5] overflow-hidden rounded-[var(--radius-lg)] bg-slate-100">
          <Image
            src={story.image.url}
            alt={story.image.alt ?? story.heading}
            fill
            className="object-cover"
          />
        </div>
      ) : null}
    </section>
  )
}
