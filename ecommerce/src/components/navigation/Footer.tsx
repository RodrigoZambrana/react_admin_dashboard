// @ts-nocheck

import Link from "next/link"
import type { NavigationConfig } from "@/types/storefront"

interface FooterProps {
  navigation: NavigationConfig
}

export const Footer: React.FC<FooterProps> = ({ navigation }) => {
  const year = new Date().getFullYear()
  return (
    <footer className="border-t border-slate-200 bg-slate-950 text-slate-200">
      <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-12 sm:px-6 lg:grid-cols-[2fr,1fr,1fr] lg:px-8">
        <div className="flex flex-col gap-4">
          <span className="text-lg font-semibold text-white">Ecommerce Storefront</span>
          <p className="text-sm text-slate-400">
            A configurable eCommerce experience powered by a headless backend. Enable new layouts, merchandising
            strategies, and content without redeploying the storefront.
          </p>
          {navigation.socials?.length ? (
            <div className="flex items-center gap-3">
              {navigation.socials.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  target={link.external ? "_blank" : undefined}
                  rel={link.external ? "noreferrer" : undefined}
                  className="rounded-full border border-white/10 px-3 py-1 text-xs font-medium text-slate-300 transition hover:border-white hover:text-white"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          ) : null}
        </div>

        {(navigation.footer ?? []).map((column, columnIndex) => (
          <div key={`footer-column-${columnIndex}`} className="space-y-3">
            {column.map((link) => (
              <div key={link.href}>
                <Link
                  href={link.href}
                  className="text-sm font-medium text-slate-200 transition hover:text-white"
                >
                  {link.label}
                </Link>
              </div>
            ))}
          </div>
        ))}
      </div>
      <div className="border-t border-white/10 px-4 py-6 text-center text-xs text-slate-500">
        © {year} Ecommerce Storefront. Powered by Next.js and Node.js API on port 4000.
      </div>
    </footer>
  )
}
