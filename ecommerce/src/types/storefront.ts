export type MoneyCurrency = string;

export interface Money {
  amount: number;
  currency: MoneyCurrency;
  formatted?: string;
}

export interface ImageAsset {
  id: string;
  url: string;
  publicId?: string | null;
  version?: number | null;
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
  seoDescription?: string | null;
  seoAuthor?: string | null;
  seoImageUrl?: string | null;
  googleSiteVerification?: string | null;
  logo?: string | null;
}

export interface StorefrontShippingOption {
  id: number;
  name: string;
  deliveryFees: number;
  estimatedMin: number | null;
  estimatedMax: number | null;
  img?: string | null;
}

export type StorefrontFulfillmentMode = "home_delivery";

export interface OrderDeliverySummary {
  mode: StorefrontFulfillmentMode;
  modeLabel: string;
  shippingVendor?: string | null;
  estimatedMin?: number | null;
  estimatedMax?: number | null;
  estimatedLabel?: string | null;
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
      minInstallments?: number | null;
      maxInstallments?: number | null;
      updatedAt: string | null;
    } | null;
  };
  integrations?: {
    google?: {
      enabled: boolean;
      analytics?: {
        enabled: boolean;
        measurementId: string | null;
      };
      tagManager?: {
        enabled: boolean;
        containerId: string | null;
      };
      ads?: {
        enabled: boolean;
        conversionId: string | null;
        conversionLabel: string | null;
      };
      searchConsole?: {
        verificationToken: string | null;
      };
    };
    recaptcha?: {
      enabled: boolean;
      siteKey: string | null;
    };
    meta?: {
      pixel?: {
        enabled: boolean;
        pixelId: string | null;
      };
    };
    insights?: {
      content?: {
        enabled: boolean;
      };
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
  label?: string | null;
  price: Money;
  stock?: number | null;
  inventoryStatus: InventoryStatus;
  isActive: boolean;
  attributes: ProductVariantAttribute[];
  images: ProductImage[];
}

export interface PublishedParametricVariant {
  id: number;
  key: string;
  price: Money;
  configuration: Record<string, unknown>;
  specifications: Array<{ label: string; value: string }>;
  optionValues: {
    familyId: string;
    serie: string;
    material: string;
    color: string;
    vidrio: string;
    widthMm: number;
    heightMm: number;
    hasMosquitero: boolean;
    hasShutterMonoblock: boolean;
    shutterMaterial: string;
  };
}

export interface PublishedParametricOptions {
  defaultVariantKey: string;
  defaultConfiguration: Record<string, unknown>;
  defaultSpecifications: Array<{ label: string; value: string }>;
  selectors: {
    series: string[];
    materials: string[];
    colors: string[];
    glass: string[];
    shutterMaterials: string[];
    hasMosquiteroOption: boolean;
    hasMonoblockOption: boolean;
  };
  variants: PublishedParametricVariant[];
}

export type CmsContentAssetType = "IMAGE" | "VIDEO" | "EMBED";

export interface CmsContentAsset {
  id: number;
  title?: string | null;
  caption?: string | null;
  mediaType: CmsContentAssetType;
  publicId?: string | null;
  version?: number | null;
  mediaUrl: string;
  posterUrl?: string | null;
  externalUrl?: string | null;
  durationSec?: number | null;
  sortOrder: number;
}

export interface CmsContentEntry {
  id: number;
  slug?: string | null;
  title: string;
  subtitle?: string | null;
  description?: string | null;
  priority: number;
  payload?: Record<string, unknown> | null;
  thumbnail?: ImageAsset | null;
  cta?: ActionLink | null;
  product?: {
    id: number;
    slug: string;
    name: string;
  } | null;
  category?: {
    id: number;
    slug: string;
    name: string;
  } | null;
  assets: CmsContentAsset[];
}

export interface CmsContentSection {
  id: number;
  key: string;
  name: string;
  description?: string | null;
  entries: CmsContentEntry[];
}

export interface CmsRenderableMedia {
  id: number;
  url: string;
  publicId?: string | null;
  version?: number | null;
  type: string;
  alt?: string | null;
  title?: string | null;
  mimeType?: string | null;
  fileName?: string | null;
  sizeBytes?: number | null;
  width?: number | null;
  height?: number | null;
  source?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface CmsRenderableBlock {
  id: number;
  type: string;
  key?: string | null;
  name?: string | null;
  sortOrder: number;
  content?: Record<string, unknown> | null;
  media?: CmsRenderableMedia | null;
}

export interface CmsRenderableSection {
  id: number;
  type: string;
  key?: string | null;
  name?: string | null;
  sortOrder: number;
  settings?: Record<string, unknown> | null;
  blocks: CmsRenderableBlock[];
}

export interface CmsRenderablePage {
  id: number;
  path: string;
  title: string;
  summary?: string | null;
  locale: string;
  updatedAt?: string;
  seo?: {
    title?: string | null;
    description?: string | null;
    imageUrl?: string | null;
  } | null;
  layoutKey?: string | null;
  legacySource?: string | null;
  sections: CmsRenderableSection[];
}

export interface ProductImage extends ImageAsset {
  sortOrder?: number;
  isPrimary?: boolean;
}

export interface ProductSummary {
  id: number;
  productId?: number | string;
  slug: string;
  name: string;
  updatedAt?: string;
  shortDescription?: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  seoImageUrl?: string | null;
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
  measurementType?: BudgetMeasurementType;
  isPublic?: boolean;
  isBudgetCalculable?: boolean;
  calculationStrategy?: BudgetCalculationStrategy;
  images?: ProductImage[];
  gallery?: ProductImage[];
  attributes?: ProductVariantAttribute[];
  variantId?: number | null;
  variantKey?: string | null;
  variantLabel?: string | null;
  configuration?: Record<string, unknown> | null;
  specifications?: Array<{ label: string; value: string }>;
  canonicalConfiguration?: CanonicalConfiguration | null;
}

export interface ProductReviewCustomer {
  name: string;
  imgUrl?: string | null;
}

export interface ProductReviewSummary {
  id: number;
  rating: number;
  title?: string | null;
  comment: string;
  createdAt: string;
  verifiedPurchase: boolean;
  customer: ProductReviewCustomer;
}

export interface ProductReviewStats {
  averageRating: number;
  reviewCount: number;
}

export interface ProductDetail extends Omit<ProductSummary, "attributes"> {
  description?: string | null;
  descriptionHtml?: string | null;
  specifications?: Array<{ label: string; value: string }>;
  gallery: ProductImage[];
  relatedProducts: ProductSummary[];
  frequentlyBoughtTogether: ProductSummary[];
  suggestedAddOns: ProductSummary[];
  installationAddOn?: {
    id: number;
    name: string;
    productCode?: string | null;
    shortDescription?: string | null;
    price: Money;
  } | null;
  meta?: {
    weight?: string;
    dimensions?: string;
    materials?: string;
  };
  reviewSummary?: ProductReviewStats | null;
  reviews?: ProductReviewSummary[];
  attributes?: ProductAttributeDefinition[];
  variants?: ProductVariant[];
  publishedParametricOptions?: PublishedParametricOptions;
}

export interface CanonicalConfiguration {
  id: number;
  tenantId: string;
  baseProductId: number;
  baseLabel?: string | null;
  canonicalName: string;
  slug: string;
  indexable: boolean;
  configurationRules: Record<string, unknown>;
  seoTitle?: string | null;
  seoDescription?: string | null;
  searchTerms: string[];
  visibilityRules?: Record<string, unknown> | null;
}

export interface StorefrontProductMediaItem {
  slug?: string | null;
  public_id: string;
  type: "image" | "video";
  order: number;
  name?: string | null;
  alt?: string | null;
  familyKey?: string | null;
  version?: number | null;
}

export interface StorefrontProductMediaStoryItem {
  id: string;
  title: string;
  caption?: string | null;
  mediaSlug: string;
  public_id: string;
  type: "image" | "video";
  order: number;
  alt?: string | null;
  version?: number | null;
}

export interface StorefrontProductMediaResponse {
  product: {
    id: number;
    slug: string;
    name: string;
  };
  media: StorefrontProductMediaItem[];
  stories: StorefrontProductMediaStoryItem[];
}

export type BudgetMeasurementType = "M2";
export type BudgetCalculationStrategy = "M2" | string;

export interface BudgetProductSummary {
  id: number;
  slug: string;
  name: string;
  productCode?: string | null;
  img?: string | null;
  description?: string | null;
  currency: string;
  unitPrice: number;
  measurementType: BudgetMeasurementType;
  isPublic: boolean;
  isBudgetCalculable: boolean;
  calculationStrategy: BudgetCalculationStrategy;
}

export interface BudgetCalculationResult {
  productId: number;
  width: number;
  height: number;
  area: number;
  unitPrice: number;
  totalPrice: number;
  currency?: string;
  measurementType: BudgetMeasurementType;
  strategy: string;
  product?: BudgetProductSummary;
}

export interface BudgetAddToCartItemRequest {
  productId: number;
  width: number;
  height: number;
  calculatedPrice?: number;
  qty?: number;
}

export interface BudgetAddToCartRequest {
  items: BudgetAddToCartItemRequest[];
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  customerNotes?: string;
  recaptchaToken?: string;
  currency?: string;
}

export interface BudgetAddToCartResponse {
  currency: string;
  subtotal: number;
  items: Array<
    BudgetCalculationResult & {
      qty: number;
      product: BudgetProductSummary;
    }
  >;
}

export interface BudgetSummaryRequest extends BudgetAddToCartRequest {
  shippingFee?: number;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  customerNotes?: string;
  currency?: string;
}

export interface BudgetSummaryResponse {
  currency: string;
  subtotal: number;
  shippingFee: number;
  grandTotal: number;
  items: Array<
    BudgetCalculationResult & {
      qty: number;
      lineTotal: number;
      product: BudgetProductSummary;
    }
  >;
  customer: {
    name: string | null;
    email: string | null;
    phone: string | null;
    notes: string | null;
  };
}

export interface BudgetLeadRequest {
  name: string;
  email?: string;
  phone?: string;
  recaptchaToken?: string;
}

export interface BudgetLeadResponse {
  customerId: number;
  name: string;
  email: string | null;
  phone: string | null;
  status: string | null;
}

export interface ParametricSizeLimit {
  minWidthMm?: number;
  maxWidthMm?: number;
  minHeightMm?: number;
  maxHeightMm?: number;
}

export interface ParametricCompatibility {
  glassBySeries?: Record<string, string[]>;
  monoblockBySeries?: Record<string, boolean>;
  sizeLimits?: Record<string, ParametricSizeLimit>;
}

export interface ParametricConfigSelectors {
  families: string[];
  series: string[];
  materials: string[];
  colors: string[];
  glass: string[];
  widths: number[];
  heights: number[];
  shutterMaterials: string[];
  hasMosquiteroOption: boolean;
  hasMonoblockOption: boolean;
}

export interface ParametricConfigStats {
  rowCount: number;
  minimumPrice?: number;
  currency?: string;
  newestReferenceDate?: string | null;
  oldestReferenceDate?: string | null;
}

export interface ParametricConfigSnapshot {
  selectors: ParametricConfigSelectors;
  stats: ParametricConfigStats;
  compatibility: ParametricCompatibility;
}

export interface ParametricQuoteRequest {
  familyId?: string | null;
  serie: string;
  material: string;
  color: string;
  vidrio: string;
  widthMm: number;
  heightMm: number;
  hasMosquitero: boolean;
  hasShutterMonoblock: boolean;
  shutterMaterial?: string | null;
}

export interface ParametricQuoteResult {
  productId: number;
  available: boolean;
  price?: number;
  currency?: string;
  detailSnapshot?: string | null;
  specifications?: string | null;
  source?: string | null;
  referenceDate?: string | null;
  matrixRowId?: number;
  requested: {
    familyId?: string | null;
    serie: string;
    material: string;
    color: string;
    vidrio: string;
    widthMm: number;
    heightMm: number;
    hasMosquitero: boolean;
    hasShutterMonoblock: boolean;
    shutterMaterial: string;
  };
}

export interface CategorySummary {
  id: number;
  slug: string;
  name: string;
  description?: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  seoImageUrl?: string | null;
  catalogExposureMode?: "AUTO" | "M2_DERIVED" | "UNITARY" | "EMPTY_IF_NO_PUBLIC_CALCULABLE" | null;
  thumbnail?: ImageAsset | null;
  productCount: number;
  parentId?: number | null;
  children?: CategorySummary[];
}

export interface CmsPublicPageSummary {
  path: string;
  title: string;
  summary?: string | null;
  locale: string;
  updatedAt?: string;
  seo?: {
    title?: string | null;
    description?: string | null;
    imageUrl?: string | null;
  } | null;
  legacySource?: string | null;
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
  emailVerifiedAt?: string | null;
  emailVerificationRequired?: boolean;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  dateOfBirth?: string | null;
  avatarUrl?: string | null;
  preferredLocale?: string | null;
  status?: string | null;
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
    department?: string | null;
    neighborhood?: string | null;
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
  delivery?: OrderDeliverySummary;
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

export interface PublicOrderPaymentSummary extends Omit<OrderPaymentSummary, "paymentIntentId"> {}

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
    email?: string;
    firstName: string;
    lastName: string;
    phone: string;
    locale?: string;
  };
  shippingAddress: {
    line1: string;
    line2?: string;
    street?: string;
    number?: string;
    corner?: string;
    apartment?: string;
    comments?: string;
    city: string;
    department: string;
    neighborhood?: string;
    state?: string;
    zip?: string;
    country: string;
  };
  billingAddress?: {
    line1: string;
    line2?: string;
    street?: string;
    number?: string;
    corner?: string;
    apartment?: string;
    comments?: string;
    city: string;
    department: string;
    neighborhood?: string;
    state?: string;
    zip?: string;
    country: string;
  };
  items: Array<{
    productId: number;
    quantity: number;
    variantId?: number;
    width?: number;
    height?: number;
    derived?: boolean;
    reference?: number;
    configuration?: Record<string, unknown>;
  }>;
  notes?: string;
  paymentIntentId?: string;
  checkoutToken?: string;
  shippingOptionId?: number;
  fulfillmentMode?: StorefrontFulfillmentMode;
  currency?: string;
  analytics?: {
    sessionId: string;
    userId?: string;
    utmSource?: string | null;
    utmMedium?: string | null;
    utmCampaign?: string | null;
    referrer?: string | null;
  };
}

export type CheckoutSnapshotPayload = Omit<CreateOrderPayload, "paymentIntentId">;

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
  delivery?: OrderDeliverySummary;
  shippingAddress: CreateOrderPayload["shippingAddress"];
  billingAddress?: CreateOrderPayload["billingAddress"];
  payment?: OrderPaymentSummary | null;
}

export interface PublicOrderSummary extends Omit<OrderSummary, "id" | "payment"> {
  payment?: PublicOrderPaymentSummary | null;
}
