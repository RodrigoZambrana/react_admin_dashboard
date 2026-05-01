import Product from "models/product.model";
import Service from "models/service.model";
import Category from "models/category.model";
import { GiftCarouselItem } from "models/carousel.model";
import CategoryNavList from "models/categoryNavList.model";
import {
  catgoryNavigation,
  categories,
  mainCarouselData,
  products,
  serviceList,
} from "@/__server__/__db__/gift/data";

const getMainCarouselData = async (): Promise<GiftCarouselItem[]> => {
  return mainCarouselData as GiftCarouselItem[];
};

const getCategoryNavigation = async (): Promise<CategoryNavList[]> => {
  return catgoryNavigation as CategoryNavList[];
};

const getPopularProducts = async (): Promise<Product[]> => {
  return products.filter((item) => item.for.type === "popular-items");
};

const getTopSailedProducts = async (): Promise<Product[]> => {
  return products.filter((item) => item.for.type === "top-saled-items");
};

const getAllProducts = async (): Promise<Product[]> => {
  return products.filter((item) => item.for.type === "all-products");
};

const getServiceList = async (): Promise<Service[]> => {
  return serviceList as Service[];
};

const getTopCategories = async (): Promise<Partial<Category>[]> => {
  return categories as Partial<Category>[];
};

const giftApi = {
  getAllProducts,
  getServiceList,
  getTopCategories,
  getPopularProducts,
  getMainCarouselData,
  getTopSailedProducts,
  getCategoryNavigation
};

export default giftApi;
