export interface ActionLink {
  id?: string
  label: string
  href: string
  external?: boolean
}

export interface NavigationItem extends ActionLink {
  items?: NavigationItem[]
  badge?: string
}

export interface NavigationConfig {
  primary: NavigationItem[]
  secondary?: NavigationItem[]
  footer?: NavigationItem[][]
  socials?: ActionLink[]
  helpLinks?: ActionLink[]
}

export interface StorefrontTheme {
  accentColor: string
  accentContrastColor: string
  backgroundColor: string
  surfaceColor: string
  textColor: string
  mutedTextColor: string
  borderColor: string
  radius: {
    sm: string
    md: string
    lg: string
  }
  fonts: {
    heading: string
    body: string
  }
}

export interface HomeModuleConfig extends Record<string, unknown> {
  id: string
  type: string
}

export interface HomeLayoutDefinition {
  key: string
  name: string
  description?: string
  modules: HomeModuleConfig[]
  isDefault?: boolean
}

export interface StorefrontConfig {
  defaultLayout: string
  layouts: HomeLayoutDefinition[]
  navigation: NavigationConfig
  theme: StorefrontTheme
  seo: Record<string, unknown>
  policies: Array<{
    title: string
    body: string
    updatedAt: string
  }>
  announcement?: Record<string, unknown> | null
  companyProfile?: CompanyProfileDto | null
}

export interface CompanyProfileDto {
  legalName?: string | null
  tradeName?: string | null
  taxId?: string | null
  email?: string | null
  phone?: string | null
  website?: string | null
  addressLine1?: string | null
  addressLine2?: string | null
  logo?: string | null
}

export interface MoneyDto {
  amount: number
  currency: string
  formatted?: string
}

export interface ImageAssetDto {
  id: number | string
  url: string
  alt?: string | null
  width?: number | null
  height?: number | null
  dominantColor?: string | null
}

export type InventoryStatus = 'in-stock' | 'limited' | 'back-order' | 'out-of-stock'

export interface ProductSummaryDto {
  id: number
  slug: string
  sku?: string | null
  name: string
  shortDescription?: string | null
  price: MoneyDto
  salePrice?: MoneyDto | null
  badges?: string[]
  rating?: number | null
  ratingCount?: number | null
  inventoryStatus: InventoryStatus
  thumbnail?: ImageAssetDto | null
  categories?: Array<{ id: number; slug: string; name: string }>
  tags?: string[]
}

export interface ProductDetailDto extends ProductSummaryDto {
  description?: string | null
  descriptionHtml?: string | null
  specifications?: Array<{ label: string; value: string }>
  gallery: ImageAssetDto[]
  relatedProducts: ProductSummaryDto[]
  meta?: Record<string, unknown>
}

export interface ProductListFilters {
  page?: number
  pageSize?: number
  category?: string
  search?: string
  sort?: string
  tag?: string
}

export interface CheckoutItemInput {
  productId: number
  quantity: number
}

export interface CreateOrderInput {
  customer: {
    email: string
    firstName: string
    lastName: string
    phone?: string
  }
  shippingAddress: {
    line1: string
    line2?: string | null
    city: string
    state?: string | null
    zip: string
    country: string
  }
  billingAddress?: {
    line1: string
    line2?: string | null
    city: string
    state?: string | null
    zip: string
    country: string
  }
  items: CheckoutItemInput[]
  notes?: string
  paymentIntentId?: string
}

export interface CheckoutLineItem {
  productId: number
  quantity: number
  variantId?: number
  price: MoneyDto
  total: MoneyDto
  name?: string
  image?: string | null
}

export interface CheckoutSummary {
  items: CheckoutLineItem[]
  subtotal: MoneyDto
  tax: MoneyDto
  shipping: MoneyDto
  discounts?: MoneyDto[]
  grandTotal: MoneyDto
  estimatedDelivery?: string
  notes?: string
}

export interface OrderSummary {
  id: number
  uuid: string
  orderNumber: string
  reference?: string
  placedAt: string
  status: string
  paymentStatus: string
  fulfillmentStatus: string
  items: CheckoutLineItem[]
  summary: CheckoutSummary
  shippingAddress: CreateOrderInput['shippingAddress']
  billingAddress?: CreateOrderInput['billingAddress']
}

export interface WishlistItemDto {
  productId: number
  addedAt: string
  product: ProductSummaryDto
}

export interface CustomerWishlistDto {
  items: WishlistItemDto[]
  count: number
  productIds: number[]
}

export interface CustomerProfile {
  id: number
  email: string
  firstName?: string | null
  lastName?: string | null
  phone?: string | null
  avatarUrl?: string | null
  dateOfBirth?: string | null
  wishlistCount: number
  wishlistProductIds: number[]
  addresses: Array<{
    id: number
    line1: string
    line2?: string
    street?: string | null
    number?: string | null
    apartment?: string | null
    corner?: string | null
    comments?: string | null
    city: string
    state?: string
    zip?: string
    country: string
    countryCode?: string | null
    label?: string | null
    isPrimary: boolean
  }>
}

export interface StorefrontCategoryTree {
  id: number
  slug: string
  name: string
  description?: string | null
  thumbnail?: ImageAssetDto | null
  productCount: number
  parentId: number | null
  children: StorefrontCategoryTree[]
}
