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
  TestimonialModuleConfig
} from "@/types/storefront";

const hero = (id: string, overrides: Partial<Omit<HeroModuleConfig, "id" | "type">> = {}): HeroModuleConfig => ({
  id,
  type: "hero",
  title: "Discover the new season",
  subtitle: "Premium quality products curated for everyday comfort.",
  description: "Enjoy free shipping over $150 and complimentary returns within 30 days.",
  emphasis: "left",
  ctas: [
    { id: "cta-shop-now", label: "Shop now", href: "/products" },
    { id: "cta-view-lookbook", label: "View lookbook", href: "/collections/lookbook" }
  ],
  ...overrides
});

const productGrid = (
  id: string,
  overrides: Partial<Omit<ProductGridModuleConfig, "id" | "type">> = {}
): ProductGridModuleConfig => ({
  id,
  type: "product-grid",
  title: "New arrivals",
  subtitle: "Weekly updates from our top designers",
  layout: "grid",
  columns: 4,
  limit: 8,
  showQuickAdd: true,
  showRating: true,
  filter: { featured: true },
  ...overrides
});

const productCarousel = (
  id: string,
  overrides: Partial<Omit<ProductGridModuleConfig, "id" | "type">> = {}
): ProductGridModuleConfig => ({
  id,
  type: "product-carousel",
  title: "Trending now",
  subtitle: "Curated by our community",
  layout: "carousel",
  limit: 12,
  showQuickAdd: true,
  showRating: true,
  filter: { tag: "trending" },
  ...overrides
});

const storyHighlight = (
  id: string,
  overrides: Partial<Omit<StoryHighlightModuleConfig, "id" | "type">> = {}
): StoryHighlightModuleConfig => ({
  id,
  type: "story-highlight",
  story: {
    heading: "Crafted with purpose",
    body: "Our collections are designed with longevity in mind, merging thoughtful design with ethical production."
  },
  ...overrides
});

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
      description: "2-day express delivery on most orders"
    },
    {
      id: "usp-quality",
      icon: "ShieldCheck",
      title: "Premium quality",
      description: "Carefully sourced materials"
    },
    {
      id: "usp-support",
      icon: "Headset",
      title: "24/7 support",
      description: "Dedicated concierge assistance"
    },
    {
      id: "usp-payment",
      icon: "CreditCard",
      title: "Secure checkout",
      description: "Multiple payment providers"
    }
  ],
  ...overrides
});

const categoryShowcase = (
  id: string,
  overrides: Partial<Omit<CategoryGridModuleConfig, "id" | "type">> = {}
): CategoryGridModuleConfig => ({
  id,
  type: "category-grid",
  title: "Shop by category",
  subtitle: "Find the right products tailored to your needs",
  layout: "grid",
  limit: 6,
  emphasizeFeatured: true,
  ...overrides
});

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
  ...overrides
});

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
  ...overrides
});

const testimonials = (
  id: string,
  overrides: Partial<Omit<TestimonialModuleConfig, "id" | "type">> = {}
): TestimonialModuleConfig => ({
  id,
  type: "testimonial",
  title: "Loved by thousands of customers",
  layout: "carousel",
  testimonials: [
    {
      id: "testimonial-1",
      quote: "The quality is outstanding. Shipping was fast and the packaging felt luxurious.",
      author: "Camila Rivera",
      role: "Verified buyer",
      rating: 5
    },
    {
      id: "testimonial-2",
      quote:
        "Configuring the layouts from the dashboard is incredibly flexible. Our marketing team loves it.",
      author: "Daniel Thompson",
      role: "Head of eCommerce",
      rating: 5
    },
    {
      id: "testimonial-3",
      quote: "This storefront is blazing fast and easy to customize.",
      author: "Lauren Chen",
      role: "Brand manager",
      rating: 4.5
    }
  ],
  ...overrides
});

const blogTeaser = (
  id: string,
  overrides: Partial<Omit<BlogTeaserModuleConfig, "id" | "type">> = {}
): BlogTeaserModuleConfig => ({
  id,
  type: "blog-teaser",
  title: "From the Journal",
  subtitle: "Stories, interviews, and product highlights",
  limit: 3,
  layout: "grid",
  highlightFirst: true,
  ...overrides
});

export const DEFAULT_HOME_LAYOUTS: HomeLayoutDefinition[] = [
  {
    key: "classic-showcase",
    name: "Classic showcase",
    description: "Hero, featured products, category spotlight, and testimonials.",
    modules: [
      hero("classic-hero"),
      featureStrip("classic-usps"),
      productGrid("classic-featured"),
      categoryShowcase("classic-categories"),
      testimonials("classic-testimonials"),
      newsletter("classic-newsletter")
    ],
    isDefault: true
  },
  {
    key: "editorial-fashion",
    name: "Editorial fashion",
    description: "Story-driven layout with product carousel and journal posts.",
    modules: [
      hero("editorial-hero", {
        emphasis: "center",
        eyebrow: "Fall 2024",
        title: "The editorial drop",
        subtitle: "Statement pieces and wardrobe essentials for the new season.",
        secondaryActions: [{ id: "cta-lookbook", label: "Explore campaign", href: "/lookbook/fall" }]
      }),
      storyHighlight("editorial-story", {
        story: {
          heading: "From trend to timeless",
          body: "Our creative director curates a refined edit with modular looks suitable for every occasion.",
          author: "Sophia Bennett",
          role: "Creative director"
        },
        cta: { id: "story-shop-edit", label: "Shop the edit", href: "/collections/editorial" }
      }),
      productCarousel("editorial-carousel", {
        title: "Editor's picks",
        filter: { featured: true },
        limit: 10
      }),
      newsletter("editorial-newsletter", {
        title: "Become an insider",
        consentMessage: "Receive curated stories and exclusive preview access."
      }),
      blogTeaser("editorial-journal", {
        title: "Journal highlights",
        subtitle: "Behind the scenes, styling advice, and interviews."
      })
    ]
  },
  {
    key: "modern-minimal",
    name: "Modern minimal",
    description: "Clean grid layout with focus on product discovery and services.",
    modules: [
      hero("minimal-hero", {
        emphasis: "right",
        title: "Minimal essentials",
        subtitle: "Quiet luxury staples built to last.",
        description: "Crafted from premium materials with responsible production."
      }),
      productGrid("minimal-featured", {
        title: "Featured essentials",
        columns: 3,
        limit: 6
      }),
      featureStrip("minimal-services", {
        items: [
          {
            id: "services-1",
            icon: "RefreshCw",
            title: "Flexible returns",
            description: "Complimentary exchanges within 30 days."
          },
          {
            id: "services-2",
            icon: "Award",
            title: "Lifetime repair",
            description: "Complimentary care on signature pieces."
          },
          {
            id: "services-3",
            icon: "MapPin",
            title: "Studio pickups",
            description: "Same-day ready at select locations."
          }
        ]
      }),
      categoryShowcase("minimal-categories", {
        title: "Browse collections",
        layout: "grid",
        limit: 4
      })
    ]
  },
  {
    key: "story-led",
    name: "Story led",
    description: "Immersive storytelling layout with hero narrative and testimonials.",
    modules: [
      hero("story-hero", {
        emphasis: "center",
        title: "A narrative of craft",
        subtitle: "Every piece is a chapter in our design evolution.",
        secondaryActions: [{ id: "story-learn-more", label: "Our story", href: "/about/story" }]
      }),
      storyHighlight("story-feature", {
        story: {
          heading: "Objects of meaning",
          body: "We partner with artisans to develop limited-run drops impossible to mass produce.",
          image: {
            id: "story-image-1",
            url: "/images/story-craft.jpg",
            alt: "Handcrafted product closeup"
          }
        }
      }),
      productCarousel("story-carousel", {
        title: "Limited editions",
        filter: { tag: "limited" },
        limit: 8
      }),
      testimonials("story-testimonials", {
        title: "Loyal community",
        testimonials: [
          {
            id: "story-t1",
            quote: "The craftsmanship is unmatched. Each release tells a story worth sharing.",
            author: "Avery Cole",
            role: "Collector"
          },
          {
            id: "story-t2",
            quote: "Configuring the storefront layouts made it effortless to launch a cohesive brand.",
            author: "Morgan Lee",
            role: "Entrepreneur"
          }
        ]
      })
    ]
  },
  {
    key: "community-driven",
    name: "Community driven",
    description: "Highlights social proof, trending items, and newsletter capture.",
    modules: [
      hero("community-hero", {
        eyebrow: "Community favorites",
        title: "Designed with you",
        subtitle: "Data-backed picks driven by real-time trends and feedback."
      }),
      productGrid("community-featured", {
        title: "Top rated this week",
        filter: { tag: "top-rated" }
      }),
      featureStrip("community-insights", {
        title: "Why join the community",
        items: [
          {
            id: "community-usp-1",
            icon: "Users",
            title: "Member-only drops",
            description: "Early access to new collections."
          },
          {
            id: "community-usp-2",
            icon: "MessageCircle",
            title: "Direct feedback loop",
            description: "Shape future releases."
          },
          {
            id: "community-usp-3",
            icon: "Star",
            title: "Rewards program",
            description: "Earn points and exclusive perks."
          },
          {
            id: "community-usp-4",
            icon: "Gift",
            title: "Surprise drops",
            description: "Limited gifts for active members."
          }
        ]
      }),
      testimonials("community-voices", {
        title: "Voices from the community"
      }),
      newsletter("community-newsletter", {
        title: "Stay connected",
        consentMessage: "Personalized updates tailored to your preferences."
      })
    ]
  }
];

export const FALLBACK_LAYOUT_KEY =
  DEFAULT_HOME_LAYOUTS.find((layout) => layout.isDefault)?.key ?? DEFAULT_HOME_LAYOUTS[0].key;
