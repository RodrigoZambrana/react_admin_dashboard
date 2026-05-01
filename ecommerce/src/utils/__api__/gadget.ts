import Blog from "models/blog.model";
import Product from "models/product.model";
import Category from "models/category.model";
import { Banner } from "models/gadget.model";
import {
  articles,
  bannerData,
  categories,
  carouselProducts,
  products,
} from "@/__server__/__db__/gadget/data";

const getFeaturedCategories = async (): Promise<Category[]> => {
  return categories as Category[];
};

const getTwoBanner = async (): Promise<Banner[]> => {
  return bannerData as Banner[];
};

const getBlogLists = async (): Promise<Blog[]> => {
  return articles as Blog[];
};

const getMainCarousel = async () => {
  return carouselProducts;
};

const getTopPicksList = async (): Promise<Product[]> => {
  return products.filter((item) => item.for.type === "top-picks-products");
};

const getMostViewedList = async (): Promise<Product[]> => {
  return products.filter((item) => item.for.type === "most-viewed-products");
};

const getNewArrival = async (): Promise<Product[]> => {
  return products.filter((item) => item.for.type === "new-arrival-products");
};

const gadgetApi = {
  getTwoBanner,
  getBlogLists,
  getNewArrival,
  getMainCarousel,
  getTopPicksList,
  getMostViewedList,
  getFeaturedCategories
};

export default gadgetApi;
