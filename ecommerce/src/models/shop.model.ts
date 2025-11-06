import Product from "./product.model";

interface Shop {
  id: string;
  slug: string;
  user: any;
  email: string;
  name: string;
  phone: string;
  address: string;
  rating?: number;
  verified: boolean;
  products?: Product[];
  coverPicture: string;
  profilePicture: string;
  thumbnail?: string;
  socialLinks: { facebook?: string | null; youtube?: string | null; twitter?: string | null; instagram?: string | null };
}

export default Shop;
