import { OfferCard } from "models/grocery-3.model";
import Product from "models/product.model";
import {
  discountOffers,
  mainCarouselData,
  products,
} from "@/__server__/__db__/grocery-3/data";

const getTopSailedProducts = async (): Promise<Product[]> => {
  return products.filter((item) => item.for.type === "top-saled-products");
};

const getAllProducts = async (): Promise<Product[]> => {
  return products.filter((item) => item.for.type === "all-products");
};

const getOfferCards = async (): Promise<OfferCard[]> => {
  return discountOffers as OfferCard[];
};

const getMainCarousel = async () => {
  return mainCarouselData;
};

const grocery3Api = {
  getOfferCards,
  getAllProducts,
  getMainCarousel,
  getTopSailedProducts
};

export default grocery3Api;
