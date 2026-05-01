import Service from "models/service.model";
import Product from "models/product.model";
import Category from "models/category.model";
import { GroceryTwoCarouselItem } from "models/carousel.model";
import {
  categoryNavigation,
  categories,
  discountCardList,
  mainCarouselData,
  products,
  serviceList,
  testimonialList,
} from "@/__server__/__db__/grocery-2/data";

const getServices = async (): Promise<Service[]> => {
  return serviceList as Service[];
};

const getCategories = async (): Promise<Category[]> => {
  return categories as Category[];
};

const getDiscountBannerList = async () => {
  return discountCardList;
};

const getNavigationList = async () => {
  return categoryNavigation;
};

const getFeaturedProducts = async (): Promise<Product[]> => {
  return products.filter((item) => item.for.type === "featured-items");
};

const getBestSellProducts = async (): Promise<Product[]> => {
  return products.filter((item) => item.for.type === "best-sell-products");
};

const getBestHomeProducts = async (): Promise<Product[]> => {
  return products.filter((item) => item.for.type === "home-essentials-products");
};

const getDairyProducts = async (): Promise<Product[]> => {
  return products.filter((item) => item.for.type === "more-products");
};

const getTestimonials = async () => {
  return testimonialList;
};

const getMainCarousel = async (): Promise<GroceryTwoCarouselItem[]> => {
  return mainCarouselData as GroceryTwoCarouselItem[];
};

const grocery2Api = {
  getServices,
  getCategories,
  getTestimonials,
  getMainCarousel,
  getDairyProducts,
  getNavigationList,
  getFeaturedProducts,
  getBestSellProducts,
  getBestHomeProducts,
  getDiscountBannerList
};

export default grocery2Api;
