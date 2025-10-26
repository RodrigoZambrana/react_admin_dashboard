import type { StorefrontConfig } from "@/types/storefront"
import { AnnouncementBar } from "@/components/layout/AnnouncementBar"

interface SiteLayoutProps {
  children: React.ReactNode
  config: StorefrontConfig
}

export const SiteLayout: React.FC<SiteLayoutProps> = ({ children, config }) => {
  const { theme, announcement } = config
  return (
    <div
      className="flex min-h-screen flex-col"
      style={
        {
          "--accent-color": theme.accentColor,
          "--accent-contrast": theme.accentContrastColor,
          "--background-color": theme.backgroundColor,
          "--surface-color": theme.surfaceColor,
          "--text-color": theme.textColor,
          "--muted-text-color": theme.mutedTextColor,
          "--border-color": theme.borderColor,
          "--radius-sm": theme.radius.sm,
          "--radius-md": theme.radius.md,
          "--radius-lg": theme.radius.lg,
        } as React.CSSProperties
      }
    >
      <AnnouncementBar announcement={announcement} />
      <main className="flex-1 bg-[var(--background-color)] text-[var(--text-color)]">{children}</main>
    </div>
  )
}
