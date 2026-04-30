import type { StorefrontConfig } from '../types'
import { DEFAULT_HOME_LAYOUTS, FALLBACK_LAYOUT_KEY } from './layouts'

export const DEFAULT_STOREFRONT_CONFIG: StorefrontConfig = {
  defaultLayout: FALLBACK_LAYOUT_KEY,
  layouts: DEFAULT_HOME_LAYOUTS,
  navigation: {
    primary: [
      { id: 'nav-home', label: 'Inicio', href: '/' },
      { id: 'nav-shop', label: 'Tienda', href: '/shop' },
      { id: 'nav-categories', label: 'Categorías', href: '/categories' },
      { id: 'nav-about', label: 'Quiénes somos', href: '/quienes-somos' },
      { id: 'nav-faq', label: 'Preguntas frecuentes', href: '/preguntas-frecuentes' },
      { id: 'nav-contact', label: 'Contacto', href: '/contacto.html' },
    ],
    secondary: [
      { id: 'nav-account', label: 'Account', href: '/account' },
      { id: 'nav-orders', label: 'Order tracking', href: '/account/orders' },
    ],
    footer: [
      [
        { id: 'footer-about', label: 'Quiénes somos', href: '/quienes-somos' },
        { id: 'footer-contact', label: 'Contacto', href: '/contacto.html' },
        { id: 'footer-faq', label: 'Preguntas frecuentes', href: '/preguntas-frecuentes' },
      ],
    ],
    socials: [
      { id: 'social-instagram', label: 'Instagram', href: 'https://instagram.com', external: true },
      { id: 'social-pinterest', label: 'Pinterest', href: 'https://pinterest.com', external: true },
      { id: 'social-youtube', label: 'YouTube', href: 'https://youtube.com', external: true },
    ],
  },
  theme: {
    accentColor: '#111827',
    accentContrastColor: '#ffffff',
    backgroundColor: '#f8fafc',
    surfaceColor: '#ffffff',
    textColor: '#0f172a',
    mutedTextColor: '#475569',
    borderColor: '#e2e8f0',
    radius: { sm: '0.375rem', md: '0.75rem', lg: '1rem' },
    fonts: {
      heading: 'var(--font-geist-sans)',
      body: 'var(--font-geist-sans)',
    },
  },
  seo: {
    siteName: 'Storefront',
    defaultTitle: 'Storefront',
    titleTemplate: '%s · Storefront',
    defaultDescription: 'Headless ecommerce storefront with CMS-managed content.',
    shareImage: null,
  },
  policies: [],
  announcement: null,
  companyProfile: {
    legalName: null,
    tradeName: null,
    taxId: null,
    email: null,
    phone: null,
    website: null,
    addressLine1: null,
    addressLine2: null,
    seoDescription: null,
    seoAuthor: null,
    seoImageUrl: null,
    googleSiteVerification: null,
    logo: null,
  },
  resilience: {
    snapshotFallbackEnabled: true,
  },
}
