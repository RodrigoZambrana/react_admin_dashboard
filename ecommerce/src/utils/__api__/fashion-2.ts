import Blog from "models/blog.model";
import Brand from "models/Brand.model";
import Product from "models/product.model";
import Service from "models/service.model";
import Category from "models/category.model";
import MainCarouselItem from "models/market-1.model";
import {
  articles,
  brandList,
  categories,
  mainCarouselData,
  products,
  serviceList,
} from "@/__server__/__db__/fashion-2/data";

const getProducts = async (): Promise<Product[]> => {
  return products.filter((item) => item.for.type === "best-selling-product");
};

const getFeatureProducts = async (): Promise<Product[]> => {
  return products.filter((item) => item.for.type === "featured-products");
};

const getSaleProducts = async (): Promise<Product[]> => {
  return products.filter((item) => item.for.type === "sale-products");
};

const getPopularProducts = async (): Promise<Product[]> => {
  return products.filter((item) => item.for.type === "popular-products");
};

const getLatestProducts = async (): Promise<Product[]> => {
  return products.filter((item) => item.for.type === "latest-products");
};

const getBestWeekProducts = async (): Promise<Product[]> => {
  return products.filter((item) => item.for.type === "best-week-products");
};

const getBlogs = async (): Promise<Blog[]> => {
  return articles as Blog[];
};

const getServices = async (): Promise<Service[]> => {
  return serviceList as Service[];
};

const getCategories = async (): Promise<Category[]> => {
  return categories as Category[];
};

const getMainCarouselData = async (): Promise<MainCarouselItem[]> => {
  return mainCarouselData as MainCarouselItem[];
};

const loadMockBrands = async (): Promise<Brand[]> => {
  return brandList as Brand[];
};

const getBrands = async (): Promise<Brand[]> => {
  return loadMockBrands();
};

const fashion2Api = {
  getBlogs,
  getBrands,
  getProducts,
  getServices,
  getCategories,
  getSaleProducts,
  getLatestProducts,
  getPopularProducts,
  getFeatureProducts,
  getBestWeekProducts,
  getMainCarouselData
};

export default fashion2Api;
