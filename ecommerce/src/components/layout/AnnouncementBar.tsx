// @ts-nocheck

import type { AnnouncementBanner } from "@/types/storefront"
import Link from "next/link"

interface AnnouncementBarProps {
  announcement?: AnnouncementBanner | null
}

const levelStyles: Record<NonNullable<AnnouncementBanner["level"]>, string> = {
  info: "bg-slate-900 text-white",
  success: "bg-emerald-600 text-white",
  warning: "bg-amber-500 text-slate-900",
  critical: "bg-rose-600 text-white",
}

export const AnnouncementBar: React.FC<AnnouncementBarProps> = ({ announcement }) => {
  if (!announcement || !announcement.active) {
    return null
  }
  const appearance = levelStyles[announcement.level ?? "info"]
  return (
    <div
      className={`${appearance} text-sm`}
      style={{ "--announcement-height": "3rem" } as React.CSSProperties}
    >
      <div className="mx-auto flex w-full max-w-6xl items-center justify-center gap-3 px-4 py-3 text-center sm:px-6 lg:px-8">
        <span>{announcement.message}</span>
        {announcement.cta ? (
          <Link
            href={announcement.cta.href}
            className="inline-flex items-center text-xs font-semibold underline-offset-4 hover:underline"
          >
            {announcement.cta.label}
          </Link>
        ) : null}
      </div>
    </div>
  )
}
