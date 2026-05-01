import Service from "models/service.model";
import Product from "models/product.model";
import { HealthCarouselItem } from "models/carousel.model";
import {
  categoryNavigation,
  mainCarouselData,
  products,
  serviceList,
} from "@/__server__/__db__/health-beauty/data";

const getNavigation = async () => {
  return categoryNavigation;
};

const getTopNewProducts = async (): Promise<Product[]> => {
  return products.filter((item) => item.for.type === "top-new-products");
};

const getProducts = async (): Promise<Product[]> => {
  return products.filter((item) => item.for.type === "all-products");
};

const getServices = async (): Promise<Service[]> => {
  return serviceList as Service[];
};

const getMainCarousel = async (): Promise<HealthCarouselItem[]> => {
  return mainCarouselData as HealthCarouselItem[];
};

const healthBeautyApi = { getProducts, getServices, getNavigation, getTopNewProducts, getMainCarousel };

export default healthBeautyApi;
