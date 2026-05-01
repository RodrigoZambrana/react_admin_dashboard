import Product from "models/product.model";
import Service from "models/service.model";
import {
  categoryNavigation,
  products,
  serviceList,
} from "@/__server__/__db__/grocery-1/data";

const getGrocery1Navigation = async () => {
  return categoryNavigation;
};

const getPopularProducts = async (): Promise<Product[]> => {
  return products.filter((item) => item.for.type === "popular-products");
};

const getTrendingProducts = async (): Promise<Product[]> => {
  return products.filter((item) => item.for.type === "trending-products");
};

const getProducts = async (): Promise<Product[]> => {
  return products.filter((item) => item.for.type === "all-products");
};

const getServices = async (): Promise<Service[]> => {
  return serviceList as Service[];
};

const grocery1Api = {
  getServices,
  getProducts,
  getPopularProducts,
  getTrendingProducts,
  getGrocery1Navigation
};

export default grocery1Api;
