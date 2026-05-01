import Product from "models/product.model";
import CategoryNavList from "models/categoryNavList.model";
import { FurnitureCarouselItem } from "models/carousel.model";
import {
  categoryNavigation,
  mainCarouselData,
  products,
} from "@/__server__/__db__/furniture/data";

const getTopNewProducts = async (): Promise<Product[]> => {
  return products.filter((item) => item.for.type === "top-new-product");
};

const getTopSellingProducts = async (): Promise<Product[]> => {
  return products.filter((item) => item.for.type === "top-selling-product");
};

const getFurnitureProducts = async (): Promise<Product[]> => {
  return products.filter((item) => item.for.type === "all-product");
};

const getFurnitureShopNavList = async (): Promise<CategoryNavList[]> => {
  return categoryNavigation as CategoryNavList[];
};

const getMainCarouselData = async (): Promise<FurnitureCarouselItem[]> => {
  return mainCarouselData as FurnitureCarouselItem[];
};

const furnitureApi = {
  getTopNewProducts,
  getMainCarouselData,
  getFurnitureProducts,
  getTopSellingProducts,
  getFurnitureShopNavList
};

export default furnitureApi;
