import Shop from "./shop.model";
import Review from "./Review.model";
import type {
  InventoryStatus,
  ProductMode,
  ProductVariant,
  ProductAttributeDefinition,
  ProductVariantAttribute,
  PublishedParametricOptions
} from "@/types/storefront";

interface Product {
  unit?: any;
  slug: string;
  price: number;
  title: string;
  rating: number;
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
  brand?: string;
  size?: string[];
  status?: string;
  colors?: string[];
  images?: string[];
  categories: any[];
  reviews?: Review[];
  published?: boolean;
  specifications?: Array<{ label: string; value: string }>;
  mode?: ProductMode;
  variantAttributes?: ProductAttributeDefinition[];
  publishedParametricOptions?: PublishedParametricOptions;
  variantLabel?: string | null;
  configuration?: Record<string, unknown> | null;
  variants?: Array<{
    id: number;
    key: string;
    label?: string;
    sku?: string | null;
    price: number;
    currency: string;
    inventoryStatus: InventoryStatus;
    attributes: ProductVariantAttribute[];
    images: string[];
    isActive: boolean;
  }>;
}

export default Product;
