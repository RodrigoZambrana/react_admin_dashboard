import Brand from "models/Brand.model";
import Product from "models/product.model";
import Service from "models/service.model";
import { CategoryBasedProducts, MainCarouselItem } from "models/market-2.model";
import {
  brandList,
  categories,
  mainCarouselData,
  products,
  serviceList,
  singleCategory,
} from "@/__server__/__db__/market-2/data";

const getProducts = async (): Promise<Product[]> => {
  return products as Product[];
};

const getServices = async (): Promise<Service[]> => {
  return serviceList as Service[];
};

const getCategories = async () => {
  return categories;
};

const getBrands = async (): Promise<Brand[]> => {
  return brandList as Brand[];
};

const getMainCarouselData = async (): Promise<MainCarouselItem[]> => {
  return mainCarouselData as MainCarouselItem[];
};

const getElectronicsProducts = async (): Promise<CategoryBasedProducts> => {
  return { category: singleCategory, products: products as Product[] };
};

const getMenFashionProducts = async (): Promise<CategoryBasedProducts> => {
  return {
    products: products.slice(2) as Product[],
    category: {
      title: "Men's Fashion",
      children: singleCategory.children,
    },
  };
};

const getWomenFashionProducts = async (): Promise<CategoryBasedProducts> => {
  return {
    products: products.slice(3) as Product[],
    category: {
      title: "Women's Fashion",
      children: singleCategory.children,
    },
  };
};

const market2Api = {
  getBrands,
  getProducts,
  getServices,
  getCategories,
  getMainCarouselData,
  getMenFashionProducts,
  getElectronicsProducts,
  getWomenFashionProducts
};

export default market2Api;
