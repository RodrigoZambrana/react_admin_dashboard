export type MoneyCurrency = string;

export interface Money {
  amount: number;
  currency: MoneyCurrency;
  formatted?: string;
}

export interface ImageAsset {
  id: string;
  url: string;
  alt?: string;
  width?: number;
  height?: number;
  dominantColor?: string;
}

export interface ActionLink {
  id?: string;
  label: string;
  href: string;
  external?: boolean;
}

export interface NavigationItem extends ActionLink {
  items?: NavigationItem[];
  badge?: string;
}

export interface NavigationConfig {
  primary: NavigationItem[];
  secondary?: NavigationItem[];
  footer?: NavigationItem[][];
  socials?: ActionLink[];
  helpLinks?: ActionLink[];
}

export interface StorefrontTheme {
  accentColor: string;
  accentContrastColor: string;
  backgroundColor: string;
  surfaceColor: string;
  textColor: string;
  mutedTextColor: string;
  borderColor: string;
  radius: {
    sm: string;
    md: string;
    lg: string;
  };
  fonts: {
    heading: string;
    body: string;
  };
}

export interface StorefrontPolicy {
  title: string;
  body: string;
  updatedAt: string;
}

export interface SeoConfig {
  siteName: string;
  titleTemplate?: string;
  defaultTitle: string;
  defaultDescription: string;
  shareImage?: ImageAsset;
  twitterHandle?: string;
}

export interface AnnouncementBanner {
  id: string;
  message: string;
  cta?: ActionLink;
  level?: "info" | "success" | "warning" | "critical";
  active: boolean;
}

export interface CompanyProfile {
  legalName?: string | null;
  tradeName?: string | null;
  taxId?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  logo?: string | null;
}

export interface StorefrontConfig {
  defaultLayout: string;
  layouts: HomeLayoutDefinition[];
  navigation: NavigationConfig;
  theme: StorefrontTheme;
  seo: SeoConfig;
  policies: StorefrontPolicy[];
  announcement?: AnnouncementBanner | null;
  companyProfile?: CompanyProfile | null;
  payments?: {
    mercadopago?: {
      enabled: boolean;
      publicKey: string | null;
      country: string | null;
      updatedAt: string | null;
    } | null;
  };
  integrations?: {
    google?: {
      enabled: boolean;
    };
    recaptcha?: {
      enabled: boolean;
      siteKey: string | null;
    };
  };
  resilience?: {
    snapshotFallbackEnabled: boolean;
  };
}

export type InventoryStatus = "in-stock" | "limited" | "back-order" | "out-of-stock";

export type ProductMode = "simple" | "variable" | "parametric" | "bundle";
export type ProductAttributeType = "COLOR" | "SIZE" | "MATERIAL";

export interface ProductAttributeValue {
  id: number;
  key: string;
  label: string;
  value?: string | null;
  colorHex?: string | null;
  imageUrl?: string | null;
  imageAlt?: string | null;
  sortOrder?: number | null;
}

export interface ProductAttributeDefinition {
  id: number;
  type: ProductAttributeType;
  name: string;
  values: ProductAttributeValue[];
}

export interface ProductVariantAttribute {
  attribute: ProductAttributeType;
  valueKey: string;
  label?: string | null;
  value?: string | null;
  colorHex?: string | null;
  imageUrl?: string | null;
  imageAlt?: string | null;
}

export interface ProductVariant {
  id: number;
  key: string;
  sku?: string | null;
  barcode?: string | null;
  label?: string | null;
  price: Money;
  stock?: number | null;
  inventoryStatus: InventoryStatus;
  isActive: boolean;
  attributes: ProductVariantAttribute[];
  images: ProductImage[];
}

export interface ProductImage extends ImageAsset {
  sortOrder?: number;
  isPrimary?: boolean;
}

export interface ProductSummary {
  id: number;
  slug: string;
  sku?: string | null;
  name: string;
  shortDescription?: string | null;
  price: Money;
  salePrice?: Money | null;
  badges?: string[];
  rating?: number;
  ratingCount?: number;
  inventoryStatus: InventoryStatus;
  thumbnail?: ProductImage | null;
  categories?: CategorySummary[];
  tags?: string[];
  mode?: ProductMode;
  images?: ProductImage[];
  gallery?: ProductImage[];
}

export interface ProductDetail extends ProductSummary {
  description?: string | null;
  descriptionHtml?: string | null;
  specifications?: Array<{ label: string; value: string }>;
  gallery: ProductImage[];
  relatedProducts: ProductSummary[];
  meta?: {
    weight?: string;
    dimensions?: string;
    materials?: string;
  };
  attributes?: ProductAttributeDefinition[];
  variants?: ProductVariant[];
}

export interface CategorySummary {
  id: number;
  slug: string;
  name: string;
  description?: string | null;
  thumbnail?: ImageAsset | null;
  productCount: number;
  parentId?: number | null;
  children?: CategorySummary[];
}

export interface BlogSummary {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  publishedAt: string;
  coverImage?: ImageAsset | null;
  author?: {
    name: string;
    avatarUrl?: string;
  };
}

export type HomeModuleType =
  | "hero"
  | "product-grid"
  | "product-carousel"
  | "category-grid"
  | "feature-list"
  | "stat-group"
  | "banner"
  | "usp-strip"
  | "story-highlight"
  | "newsletter"
  | "testimonial"
  | "blog-teaser"
  | "split-promo"
  | "collection-showcase"
  | "recommendations";

export interface BaseModuleConfig<TType extends HomeModuleType = HomeModuleType> {
  id: string;
  type: TType;
  title?: string;
  subtitle?: string;
  description?: string;
  background?: "surface" | "muted" | "accent" | "transparent";
}

export interface HeroModuleConfig extends BaseModuleConfig<"hero"> {
  emphasis?: "left" | "center" | "right";
  image?: ImageAsset;
  eyebrow?: string;
  ctas?: ActionLink[];
  secondaryActions?: ActionLink[];
}

export interface ProductCollectionFilter {
  categorySlug?: string;
  tag?: string;
  productIds?: number[];
  featured?: boolean;
  onSale?: boolean;
}

export interface ProductGridModuleConfig
  extends BaseModuleConfig<"product-grid" | "product-carousel" | "recommendations"> {
  layout?: "grid" | "carousel" | "masonry" | "stacked";
  columns?: 2 | 3 | 4 | 5;
  limit?: number;
  showQuickAdd?: boolean;
  showRating?: boolean;
  showPriceRange?: boolean;
  filter?: ProductCollectionFilter;
}

export interface CategoryGridModuleConfig extends BaseModuleConfig<"category-grid" | "collection-showcase"> {
  layout?: "grid" | "carousel";
  emphasizeFeatured?: boolean;
  limit?: number;
  featuredCategorySlugs?: string[];
}

export interface FeatureListItem {
  id: string;
  icon: string;
  title: string;
  description: string;
}

export interface FeatureListModuleConfig extends BaseModuleConfig<"feature-list" | "usp-strip"> {
  items: FeatureListItem[];
  emphasize?: "icons" | "numbers";
}

export interface BannerModuleConfig extends BaseModuleConfig<"banner" | "split-promo"> {
  image?: ImageAsset;
  align?: "left" | "center" | "right";
  ctas?: ActionLink[];
  badge?: string;
}

export interface StatValue {
  id: string;
  label: string;
  value: string;
  helper?: string;
}

export interface StatGroupModuleConfig extends BaseModuleConfig<"stat-group"> {
  stats: StatValue[];
}

export interface StoryHighlightModuleConfig extends BaseModuleConfig<"story-highlight"> {
  story: {
    heading: string;
    body: string;
    author?: string;
    role?: string;
    image?: ImageAsset;
  };
  cta?: ActionLink;
}

export interface NewsletterModuleConfig extends BaseModuleConfig<"newsletter"> {
  placeholder?: string;
  consentMessage?: string;
  legalLinks?: ActionLink[];
}

export interface TestimonialModuleConfig extends BaseModuleConfig<"testimonial"> {
  testimonials: Array<{
    id: string;
    quote: string;
    author: string;
    role?: string;
    rating?: number;
    avatarUrl?: string;
  }>;
  layout?: "carousel" | "grid" | "stacked";
}

export interface BlogTeaserModuleConfig extends BaseModuleConfig<"blog-teaser"> {
  limit?: number;
  layout?: "grid" | "list";
  highlightFirst?: boolean;
}

export type HomeModuleConfig =
  | HeroModuleConfig
  | ProductGridModuleConfig
  | CategoryGridModuleConfig
  | FeatureListModuleConfig
  | BannerModuleConfig
  | StatGroupModuleConfig
  | StoryHighlightModuleConfig
  | NewsletterModuleConfig
  | TestimonialModuleConfig
  | BlogTeaserModuleConfig;

export interface HomeLayoutDefinition {
  key: string;
  name: string;
  description?: string;
  modules: HomeModuleConfig[];
  isDefault?: boolean;
}

export interface PaginatedResponse<TData> {
  data: TData[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ProductListQuery {
  page?: number;
  pageSize?: number;
  categorySlug?: string;
  search?: string;
  sort?: "newest" | "price-asc" | "price-desc" | "featured" | "best-sellers";
  tag?: string;
}

export interface CustomerProfile {
  id: number;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  dateOfBirth?: string | null;
  avatarUrl?: string | null;
  preferredLocale?: string | null;
  wishlistCount: number;
  wishlistProductIds: number[];
  addresses: Array<{
    id: number;
    line1: string;
    line2?: string | null;
    street?: string | null;
    number?: string | null;
    apartment?: string | null;
    corner?: string | null;
    comments?: string | null;
    city: string;
    state?: string | null;
    zip?: string | null;
    country: string;
    countryCode?: string | null;
    label?: string | null;
    isPrimary: boolean;
  }>;
}

export interface AuthSession {
  accessToken: string;
  refreshToken?: string;
  expiresAt: string;
  customer: CustomerProfile;
}

export interface WishlistItem {
  productId: number;
  addedAt: string;
  product: ProductSummary;
}

export interface CustomerWishlist {
  items: WishlistItem[];
  count: number;
  productIds: number[];
}

export interface CheckoutLineItem {
  productId: number;
  quantity: number;
  variantId?: number;
  price: Money;
  total: Money;
  name?: string;
  image?: string | null;
  specifications?: Array<{ label?: string | null; value?: string | null }>;
}

export interface CheckoutSummary {
  items: CheckoutLineItem[];
  subtotal: Money;
  tax: Money;
  shipping: Money;
  discounts?: Money[];
  grandTotal: Money;
  estimatedDelivery?: string;
  notes?: string;
}

export interface OrderPaymentSummary {
  provider: string;
  status: string;
  statusDetail?: string;
  paymentId?: string;
  paymentIntentId?: string;
  amount?: Money;
  installments?: number;
  cardBrand?: string;
  cardLastFour?: string;
  cardholderName?: string;
  updatedAt?: string;
}

export interface CustomerNotification {
  id: number;
  eventType: string | null;
  audience: string | null;
  channel: string | null;
  deliveryStatus: string;
  title: string | null;
  body: string | null;
  metadata: Record<string, unknown> | null;
  readAt: string | null;
  createdAt: string;
  orderId: number | null;
  paymentId: number | null;
}

export interface CustomerNotificationList {
  items: CustomerNotification[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
    unread: number;
  };
}

export interface CreateOrderPayload {
  customer: {
    email: string;
    firstName: string;
    lastName: string;
    phone?: string;
    locale?: string;
  };
  shippingAddress: {
    line1: string;
    line2?: string;
    city: string;
    state?: string;
    zip?: string;
    country: string;
  };
  billingAddress?: {
    line1: string;
    line2?: string;
    city: string;
    state?: string;
    zip?: string;
    country: string;
  };
  items: Array<{ productId: number; quantity: number; variantId?: number; configuration?: Record<string, unknown> }>;
  notes?: string;
  paymentIntentId?: string;
  checkoutToken?: string;
  currency?: string;
}

export interface OrderSummary {
  id: number;
  uuid: string;
  orderNumber: string;
  reference?: string;
  placedAt: string;
  status: string;
  statusLabel?: string;
  statusColor?: string;
  statusBadgeColor?: string;
  paymentStatus: string;
  paymentStatusLabel?: string;
  paymentStatusColor?: string;
  paymentStatusBadgeColor?: string;
  fulfillmentStatus: string;
  fulfillmentStatusLabel?: string;
  items: CheckoutLineItem[];
  summary: CheckoutSummary;
  shippingAddress: CreateOrderPayload["shippingAddress"];
  billingAddress?: CreateOrderPayload["billingAddress"];
  payment?: OrderPaymentSummary | null;
}
