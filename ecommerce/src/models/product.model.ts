import Shop from "./shop.model";
import Review from "./Review.model";
import type {
  InventoryStatus,
  ProductMode,
  ProductVariant,
  ProductAttributeDefinition,
  ProductVariantAttribute,
  PublishedParametricOptions,
  CanonicalConfiguration,
  BudgetMeasurementType,
  BudgetCalculationStrategy
} from "@/types/storefront";

interface Product {
  unit?: any;
  slug: string;
  routePath?: string;
  price: number;
  title: string;
  rating?: number;
  discount: number;
  thumbnail: string;
  id: string;
  currency?: string;
  basePrice?: number;
  ratingCount?: number;
  salePrice?: number;
  description?: string;
  shortDescription?: string;
  descriptionHtml?: string;
  shop?: Shop;
  brand?: string | null;
  size?: string[] | null;
  status?: string | null;
  colors?: string[] | null;
  images?: string[] | null;
  categories: any[];
  reviews?: Review[];
  published?: boolean;
  specifications?: Array<{ label: string; value: string }>;
  mode?: ProductMode;
  measurementType?: BudgetMeasurementType;
  isPublic?: boolean;
  isBudgetCalculable?: boolean;
  calculationStrategy?: BudgetCalculationStrategy;
  variantKey?: string | null;
  variantAttributes?: ProductAttributeDefinition[];
  publishedParametricOptions?: PublishedParametricOptions;
  variantLabel?: string | null;
  configuration?: Record<string, unknown> | null;
  canonicalConfiguration?: CanonicalConfiguration | null;
  variants?: Array<{
    id: number;
    key: string;
    label?: string;
    price: number;
    currency: string;
    inventoryStatus: InventoryStatus;
    attributes: ProductVariantAttribute[];
    images: string[];
    isActive: boolean;
  }>;
}

export default Product;
