import type {
  BannerModuleConfig,
  BlogTeaserModuleConfig,
  CategoryGridModuleConfig,
  FeatureListModuleConfig,
  HeroModuleConfig,
  HomeLayoutDefinition,
  NewsletterModuleConfig,
  ProductGridModuleConfig,
  StoryHighlightModuleConfig,
  TestimonialModuleConfig,
} from "@/types/storefront"

const hero = (id: string, overrides: Partial<Omit<HeroModuleConfig, "id" | "type">> = {}): HeroModuleConfig => ({
  id,
  type: "hero",
  title: "Discover the new season",
  subtitle: "Premium quality products curated for everyday comfort.",
  description: "Enjoy free shipping over $150 and complimentary returns within 30 days.",
  emphasis: "left" as const,
  ctas: [
    { id: "cta-shop-now", label: "Shop now", href: "/products" },
    { id: "cta-view-lookbook", label: "View lookbook", href: "/collections/lookbook" },
  ],
  ...overrides,
})

const productGrid = (
  id: string,
  overrides: Partial<Omit<ProductGridModuleConfig, "id" | "type">> = {}
): ProductGridModuleConfig => ({
  id,
  type: "product-grid",
  title: "New arrivals",
  subtitle: "Weekly updates from our top designers",
  layout: "grid" as const,
  columns: 4 as const,
  limit: 8,
  showQuickAdd: true,
  showRating: true,
  filter: { featured: true },
  ...overrides,
})

const productCarousel = (
  id: string,
  overrides: Partial<Omit<ProductGridModuleConfig, "id" | "type">> = {}
): ProductGridModuleConfig => ({
  id,
  type: "product-carousel",
  title: "Trending now",
  subtitle: "Curated by our community",
  layout: "carousel" as const,
  limit: 12,
  showQuickAdd: true,
  showRating: true,
  filter: { tag: "trending" },
  ...overrides,
})

const featureStrip = (
  id: string,
  overrides: Partial<Omit<FeatureListModuleConfig, "id" | "type">> = {}
): FeatureListModuleConfig => ({
  id,
  type: "usp-strip",
  title: "Why customers choose us",
  items: [
    {
      id: "usp-shipping",
      icon: "Truck",
      title: "Fast shipping",
      description: "2-day express delivery on most orders",
    },
    {
      id: "usp-quality",
      icon: "ShieldCheck",
      title: "Premium quality",
      description: "Carefully sourced materials",
    },
    {
      id: "usp-support",
      icon: "Headset",
      title: "24/7 support",
      description: "Dedicated concierge assistance",
    },
    {
      id: "usp-payment",
      icon: "CreditCard",
      title: "Secure checkout",
      description: "Multiple payment providers",
    },
  ],
  ...overrides,
})

const categoryShowcase = (
  id: string,
  overrides: Partial<Omit<CategoryGridModuleConfig, "id" | "type">> = {}
): CategoryGridModuleConfig => ({
  id,
  type: "category-grid",
  title: "Shop by category",
  subtitle: "Find the right products tailored to your needs",
  layout: "grid" as const,
  limit: 6,
  emphasizeFeatured: true,
  ...overrides,
})

const banner = (
  id: string,
  overrides: Partial<Omit<BannerModuleConfig, "id" | "type">> = {}
): BannerModuleConfig => ({
  id,
  type: "banner",
  title: "Mid-season sale",
  subtitle: "Up to 40% off selected collections",
  description: "Members enjoy exclusive perks and early access to new drops.",
  ctas: [{ id: "banner-sale", label: "Redeem offer", href: "/collections/sale" }],
  ...overrides,
})

const newsletter = (
  id: string,
  overrides: Partial<Omit<NewsletterModuleConfig, "id" | "type">> = {}
): NewsletterModuleConfig => ({
  id,
  type: "newsletter",
  title: "Stay in the know",
  description: "Be the first to hear about new launches, restocks, and private events.",
  placeholder: "you@example.com",
  consentMessage: "We respect your privacy and only send relevant updates.",
  ...overrides,
})

const testimonials = (
  id: string,
  overrides: Partial<Omit<TestimonialModuleConfig, "id" | "type">> = {}
): TestimonialModuleConfig => ({
  id,
  type: "testimonial",
  title: "Loved by thousands of customers",
  layout: "carousel" as const,
  testimonials: [
    {
      id: "testimonial-1",
      quote:
        "The quality is outstanding. Shipping was fast and the packaging felt luxurious.",
      author: "Camila Rivera",
      role: "Verified buyer",
      rating: 5,
    },
    {
      id: "testimonial-2",
      quote:
        "Configuring the layouts from the dashboard is incredibly flexible. Our marketing team loves it.",
      author: "Daniel Thompson",
      role: "Head of eCommerce",
      rating: 5,
    },
    {
      id: "testimonial-3",
      quote: "This storefront is blazing fast and easy to customize.",
      author: "Lauren Chen",
      role: "Brand manager",
      rating: 4.5,
    },
  ],
  ...overrides,
})

const blogTeaser = (
  id: string,
  overrides: Partial<Omit<BlogTeaserModuleConfig, "id" | "type">> = {}
): BlogTeaserModuleConfig => ({
  id,
  type: "blog-teaser",
  title: "From the Journal",
  subtitle: "Stories, interviews, and product highlights",
  limit: 3,
  layout: "grid" as const,
  highlightFirst: true,
  ...overrides,
})

export const DEFAULT_HOME_LAYOUTS: HomeLayoutDefinition[] = [
  {
    key: "classic-showcase",
    name: "Classic showcase",
    description: "Hero, featured products, category spotlight, and testimonials.",
    modules: [hero("classic-hero"), featureStrip("classic-usps"), productGrid("classic-featured"), categoryShowcase("classic-categories"), testimonials("classic-testimonials"), newsletter("classic-newsletter")],
    isDefault: true,
  },
  {
    key: "editorial-fashion",
    name: "Editorial fashion",
    description: "Story-driven layout with product carousel and journal posts.",
    modules: [
      hero("editorial-hero", {
        subtitle: "Effortless silhouettes with a modern touch",
        ctas: [
          { id: "editorial-shop", label: "Explore collection", href: "/collections/editorial" },
          { id: "editorial-story", label: "Read the story", href: "/blog/editorial-season" },
        ],
      }),
      productCarousel("editorial-trending", { title: "Curator picks" }),
      banner("editorial-banner", { title: "Limited edition drop", subtitle: "Available for 72 hours only" }),
      blogTeaser("editorial-blog"),
      newsletter("editorial-newsletter"),
    ],
  },
  {
    key: "premium-lifestyle",
    name: "Premium lifestyle",
    description: "Balanced modules for lifestyle brands focusing on benefits.",
    modules: [
      hero("lifestyle-hero", { emphasis: "center", subtitle: "Luxury essentials for every moment" }),
      featureStrip("lifestyle-features", { title: "Signature experience" }),
      productGrid("lifestyle-featured", { title: "Signature pieces" }),
      banner("lifestyle-banner", { title: "Member-exclusive rewards", subtitle: "Earn points on every purchase" }),
      testimonials("lifestyle-testimonials", { title: "Customer stories" }),
    ],
  },
  {
    key: "modern-electronics",
    name: "Modern electronics",
    description: "Tech-focused layout with product recommendations and stats.",
    modules: [
      hero("electronics-hero", { subtitle: "Smart devices engineered for performance" }),
      productCarousel("electronics-top-rated", { title: "Top-rated tech" }),
      featureStrip("electronics-usps", {
        items: [
          { id: "usp-support-365", icon: "Headset", title: "365-day support", description: "Certified technicians on call" },
          { id: "usp-warranty", icon: "Shield", title: "Extended warranty", description: "Coverage up to 3 years" },
          { id: "usp-energy", icon: "Zap", title: "Energy efficient", description: "Designed with sustainability in mind" },
        ],
      }),
      banner("electronics-banner", { title: "Bundle & save", subtitle: "Build your smart ecosystem and save 15%" }),
      productGrid("electronics-recommendations", { title: "Recommended for you", filter: { tag: "recommended" } }),
      newsletter("electronics-newsletter"),
    ],
  },
  {
    key: "home-decor",
    name: "Home & decor",
    description: "Warm storytelling with category highlights and blog content.",
    modules: [
      hero("decor-hero", { subtitle: "Thoughtfully crafted pieces to elevate every space" }),
      categoryShowcase("decor-categories", { title: "Curated rooms" }),
      banner("decor-banner", { title: "Interior styling services", subtitle: "Complimentary consultation with every purchase" }),
      productGrid("decor-featured", { title: "Handpicked favorites" }),
      blogTeaser("decor-stories", { title: "Design notes" }),
    ],
  },
  {
    key: "beauty-wellness",
    name: "Beauty & wellness",
    description: "Focus on testimonials, routines, and featured bundles.",
    modules: [
      hero("beauty-hero", { subtitle: "Clean formulations backed by clinical research" }),
      featureStrip("beauty-usps", {
        items: [
          { id: "usp-ingredients", icon: "Leaf", title: "Clinically tested", description: "Dermatologist approved formulas" },
          { id: "usp-crueltyfree", icon: "Heart", title: "Cruelty free", description: "No animal testing, ever" },
          { id: "usp-subscription", icon: "Repeat", title: "Auto-replenish", description: "Flexible delivery schedules" },
        ],
      }),
      productCarousel("beauty-best-sellers", { title: "Best sellers" }),
      testimonials("beauty-testimonials", { title: "Real results" }),
      newsletter("beauty-newsletter", { title: "Get personalized routines" }),
    ],
  },
  {
    key: "outdoor-adventure",
    name: "Outdoor adventure",
    description: "Storytelling focused on exploration with collection highlights.",
    modules: [
      hero("outdoor-hero", { subtitle: "Gear built to go the distance", emphasis: "center" }),
      productCarousel("outdoor-trending", { title: "Trail-tested picks" }),
      banner("outdoor-banner", { title: "Adventure guarantee", subtitle: "Lifetime repairs on all technical gear" }),
      categoryShowcase("outdoor-collections", { title: "Featured collections" }),
      testimonials("outdoor-testimonials", { title: "Field notes" }),
    ],
  },
  {
    key: "minimal-digital",
    name: "Minimal digital",
    description: "Clean layout optimized for DTC digital products and SaaS.",
    modules: [
      hero("digital-hero", { subtitle: "Design assets and tools crafted for creative teams" }),
      featureStrip("digital-usps", {
        items: [
          { id: "usp-license", icon: "FileCheck", title: "Flexible licenses", description: "Enterprise-ready usage rights" },
          { id: "usp-updates", icon: "RefreshCcw", title: "Rolling updates", description: "New drops every month" },
          { id: "usp-support", icon: "MessageCircle", title: "Priority support", description: "Dedicated Slack channel" },
        ],
      }),
      productGrid("digital-featured", { title: "Featured kits" }),
      blogTeaser("digital-blog", { title: "Workflow insights" }),
      newsletter("digital-newsletter", { title: "Access private beta releases" }),
    ],
  },
  {
    key: "kids-lifestyle",
    name: "Kids lifestyle",
    description: "Playful layout highlighting collections and parent stories.",
    modules: [
      hero("kids-hero", { subtitle: "Playful essentials made to grow with them" }),
      categoryShowcase("kids-categories", { title: "Shop by age" }),
      banner("kids-banner", { title: "Bundle deals", subtitle: "Outfit bundles from newborn to pre-teen" }),
      productCarousel("kids-favorites", { title: "Parent favorites" }),
      testimonials("kids-testimonials", { title: "Parent stories" }),
      newsletter("kids-newsletter", { title: "Parenting notes & releases" }),
    ],
  },
  {
    key: "gourmet-market",
    name: "Gourmet market",
    description: "Highlight curated collections, featured recipes, and testimonials.",
    modules: [
      hero("gourmet-hero", { subtitle: "Small-batch producers and chef-curated pairings" }),
      productGrid("gourmet-featured", { title: "Weekly tasting box" }),
      banner("gourmet-banner", { title: "Chef masterclasses", subtitle: "Complimentary with seasonal subscriptions" }),
      blogTeaser("gourmet-blog", { title: "In the kitchen" }),
      testimonials("gourmet-testimonials", { title: "Community favorites" }),
      newsletter("gourmet-newsletter", { title: "Exclusive recipes & launches" }),
    ],
  },
  {
    key: "fitness-performance",
    name: "Fitness performance",
    description: "Performance-driven layout with stats and product carousels.",
    modules: [
      hero("fitness-hero", { subtitle: "Engineered for high-performance training" }),
      productCarousel("fitness-featured", { title: "Performance essentials" }),
      featureStrip("fitness-usps", {
        items: [
          { id: "usp-moisture", icon: "Droplet", title: "Moisture wicking", description: "Keeps you dry under pressure" },
          { id: "usp-compression", icon: "Activity", title: "Compression support", description: "Enhances muscle recovery" },
          { id: "usp-eco", icon: "Recycle", title: "Sustainable fabrics", description: "Made with recycled fibers" },
        ],
      }),
      banner("fitness-banner", { title: "Join the performance club", subtitle: "Earn perks with every milestone" }),
      testimonials("fitness-testimonials", { title: "Athlete reviews" }),
    ],
  },
  {
    key: "artisanal-maker",
    name: "Artisanal maker",
    description: "Focus on maker stories, handcrafted goods, and category highlights.",
    modules: [
      hero("artisan-hero", { subtitle: "Handcrafted pieces from independent makers" }),
      storyHighlight("artisan-story", {
        title: "Meet the makers",
        story: {
          heading: "Craftsmanship rooted in tradition",
          body: "Each piece is created in small batches, celebrating heritage techniques passed down through generations.",
          author: "Lucía Fernández",
          role: "Master artisan",
        },
      }),
      categoryShowcase("artisan-categories", { title: "Explore collections" }),
      productGrid("artisan-featured", { title: "Limited editions" }),
      newsletter("artisan-newsletter", { title: "Studio updates" }),
    ],
  },
]

function storyHighlight(
  id: string,
  overrides: Partial<Omit<StoryHighlightModuleConfig, "id" | "type">> = {}
): StoryHighlightModuleConfig {
  return {
    id,
    type: "story-highlight",
    title: "Behind the craft",
    story: {
      heading: "Designed for impact",
      body: "Share the story behind the products to connect with your audience on an emotional level.",
      author: "Storefront Team",
      role: "Product design",
    },
    ...overrides,
  }
}

export const FALLBACK_LAYOUT_KEY = DEFAULT_HOME_LAYOUTS.find((layout) => layout.isDefault)?.key ?? DEFAULT_HOME_LAYOUTS[0].key
