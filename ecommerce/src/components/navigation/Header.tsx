// @ts-nocheck
"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { ShoppingBag, Menu, X, User, Search, Phone } from "lucide-react"
import type { NavigationConfig, NavigationItem } from "@/types/storefront"
import { useCart } from "@/state/cart-context"

interface HeaderProps {
  navigation: NavigationConfig
  announcementActive?: boolean
}

const isActive = (href: string, pathname: string): boolean => {
  if (!href) return false
  if (href === "/") {
    return pathname === "/"
  }
  return pathname.startsWith(href)
}

const NavLink: React.FC<{ item: NavigationItem; pathname: string }> = ({ item, pathname }) => {
  const active = isActive(item.href, pathname)
  return (
    <Link
      key={item.href}
      href={item.href}
      className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
        active
          ? "bg-slate-900 text-white shadow-sm"
          : "text-slate-700 hover:bg-slate-100 hover:text-slate-900"
      }`}
    >
      {item.label}
      {item.badge ? (
        <span className="rounded-full bg-amber-200 px-2 py-0.5 text-xs font-semibold text-amber-900">
          {item.badge}
        </span>
      ) : null}
    </Link>
  )
}

export const Header: React.FC<HeaderProps> = ({ navigation, announcementActive }) => {
  const pathname = usePathname()
  const { state } = useCart()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const cartCount = state.items.reduce((sum, item) => sum + item.quantity, 0)

  return (
    <header className={announcementActive ? "mt-[--announcement-height]" : ""}>
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        <button
          type="button"
          className="rounded-full p-2 text-slate-600 transition hover:bg-slate-100 lg:hidden"
          aria-label="Toggle navigation"
          onClick={() => setMobileMenuOpen((prev) => !prev)}
        >
          {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>

        <nav className="hidden items-center gap-2 lg:flex">
          {navigation.primary.map((item) => (
            <NavLink key={item.href} item={item} pathname={pathname} />
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Link
            href="/search"
            className="hidden rounded-full p-2 text-slate-600 transition hover:bg-slate-100 md:inline-flex"
            aria-label="Search"
          >
            <Search className="h-5 w-5" />
          </Link>
          <Link
            href="/contact"
            className="hidden items-center gap-2 rounded-full px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 md:inline-flex"
          >
            <Phone className="h-4 w-4" />
            Support
          </Link>
          <Link
            href="/account"
            className="rounded-full p-2 text-slate-600 transition hover:bg-slate-100"
            aria-label="Account"
          >
            <User className="h-5 w-5" />
          </Link>
          <Link
            href="/cart"
            className="relative inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-700"
            aria-label={`Cart (${cartCount})`}
          >
            <ShoppingBag className="h-5 w-5" />
            <span className="hidden sm:inline">Cart</span>
            {cartCount > 0 ? (
              <span className="absolute -right-2 -top-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-amber-500 text-xs font-bold text-slate-900 shadow-lg ring-2 ring-white">
                {cartCount}
              </span>
            ) : null}
          </Link>
        </div>
      </div>

      {mobileMenuOpen ? (
        <div className="border-t border-slate-200 bg-white px-4 py-4 lg:hidden">
          <nav className="flex flex-col gap-2">
            {navigation.primary.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center justify-between rounded-xl border px-4 py-3 text-base font-medium transition ${
                  isActive(item.href, pathname)
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-200 text-slate-700 hover:bg-slate-100"
                }`}
              >
                {item.label}
                {item.badge ? (
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
                    {item.badge}
                  </span>
                ) : null}
              </Link>
            ))}
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Link
                href="/account"
                className="flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
              >
                <User className="h-4 w-4" />
                Account
              </Link>
              <Link
                href="/search"
                className="flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
              >
                <Search className="h-4 w-4" />
                Search
              </Link>
            </div>
          </nav>
        </div>
      ) : null}
    </header>
  )
}
