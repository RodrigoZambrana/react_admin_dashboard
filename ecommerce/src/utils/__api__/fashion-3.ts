import Blog from "models/blog.model";
import Product from "models/product.model";
import Service from "models/service.model";
import { MainCarouselItem } from "models/market-2.model";
import {
  blogs,
  mainCarouselData,
  products,
  serviceList,
} from "@/__server__/__db__/fashion-3/data";

const getProducts = async (): Promise<Product[]> => {
  return products.filter((item) => item.for.type === "best-selling-product");
};

const getFeatureProducts = async (): Promise<Product[]> => {
  return products.filter((item) => item.for.type === "featured-products");
};

const getMainCarouselData = async (): Promise<MainCarouselItem[]> => {
  return mainCarouselData as MainCarouselItem[];
};

const getServices = async (): Promise<Service[]> => {
  return serviceList as Service[];
};

const getBlogs = async (): Promise<Blog[]> => {
  return blogs as Blog[];
};

const fashion3Api = {
  getProducts,
  getFeatureProducts,
  getMainCarouselData,
  getServices,
  getBlogs
};

export default fashion3Api;
