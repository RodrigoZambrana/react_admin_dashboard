import type {
  BlogSummary,
  CategorySummary,
  HomeModuleConfig,
  ProductSummary,
} from "@/types/storefront"
import { HeroSection } from "./HeroSection"
import { ProductCollectionSection } from "./ProductCollectionSection"
import { CategoryShowcaseSection } from "./CategoryShowcaseSection"
import { FeatureStripSection } from "./FeatureStripSection"
import { BannerSection } from "./BannerSection"
import { TestimonialsSection } from "./TestimonialsSection"
import { NewsletterSection } from "./NewsletterSection"
import { BlogTeaserSection } from "./BlogTeaserSection"
import { StoryHighlightSection } from "./StoryHighlightSection"

interface HomeModuleRendererProps {
  module: HomeModuleConfig
  productsByModule: Record<string, ProductSummary[] | undefined>
  categoriesByModule: Record<string, CategorySummary[] | undefined>
  blogPostsByModule: Record<string, BlogSummary[] | undefined>
}

export const HomeModuleRenderer: React.FC<HomeModuleRendererProps> = ({
  module,
  productsByModule,
  categoriesByModule,
  blogPostsByModule,
}) => {
  switch (module.type) {
    case "hero":
      return <HeroSection config={module} />
    case "product-grid":
    case "product-carousel":
    case "recommendations": {
      const products = productsByModule[module.id] ?? []
      return <ProductCollectionSection config={module} products={products} />
    }
    case "category-grid":
    case "collection-showcase": {
      const categories = categoriesByModule[module.id] ?? []
      return <CategoryShowcaseSection config={module} categories={categories} />
    }
    case "feature-list":
    case "usp-strip":
      return <FeatureStripSection config={module} />
    case "banner":
    case "split-promo":
      return <BannerSection config={module} />
    case "testimonial":
      return <TestimonialsSection config={module} />
    case "newsletter":
      return <NewsletterSection config={module} />
    case "blog-teaser": {
      const posts = blogPostsByModule[module.id] ?? []
      return <BlogTeaserSection config={module} posts={posts} />
    }
    case "story-highlight":
      return <StoryHighlightSection config={module} />
    case "stat-group":
    default:
      return null
  }
}
