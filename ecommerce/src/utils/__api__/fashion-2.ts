import axios from "@lib/axios";
import Blog from "models/blog.model";
import Brand from "models/Brand.model";
import Product from "models/product.model";
import Service from "models/service.model";
import Category from "models/category.model";
import MainCarouselItem from "models/market-1.model";

const getProducts = async (): Promise<Product[]> => {
  const response = await axios.get("/api/fashion-shop-2/products");
  return response.data;
};

const getFeatureProducts = async (): Promise<Product[]> => {
  const response = await axios.get("/api/fashion-shop-2/products?tag=feature");
  return response.data;
};

const getSaleProducts = async (): Promise<Product[]> => {
  const response = await axios.get("/api/fashion-shop-2/products?tag=sale");
  return response.data;
};

const getPopularProducts = async (): Promise<Product[]> => {
  const response = await axios.get("/api/fashion-shop-2/products?tag=popular");
  return response.data;
};

const getLatestProducts = async (): Promise<Product[]> => {
  const response = await axios.get("/api/fashion-shop-2/products?tag=latest");
  return response.data;
};

const getBestWeekProducts = async (): Promise<Product[]> => {
  const response = await axios.get("/api/fashion-shop-2/products?tag=best-week");
  return response.data;
};

const getBlogs = async (): Promise<Blog[]> => {
  const response = await axios.get("/api/fashion-shop-2/blogs");
  return response.data;
};

const getServices = async (): Promise<Service[]> => {
  const response = await axios.get("/api/fashion-shop-2/service");
  return response.data;
};

const getCategories = async (): Promise<Category[]> => {
  const response = await axios.get("/api/fashion-shop-2/category");
  return response.data;
};

const getMainCarouselData = async (): Promise<MainCarouselItem[]> => {
  const response = await axios.get("/api/fashion-shop-2/main-carousel");
  return response.data;
};

const loadMockBrands = async (): Promise<Brand[]> => {
  const { brandList } = await import("@/__server__/__db__/fashion-2/data");
  return brandList as Brand[];
};

const getBrands = async (): Promise<Brand[]> => {
  try {
    const response = await axios.get("/api/fashion-shop-2/brands");
    const brands = response.data;

    if (Array.isArray(brands) && brands.length > 0) {
      return brands;
    }

    console.warn("[storefront] Received empty fashion-2 brand list, using mock data instead.");
    return loadMockBrands();
  } catch (error) {
    console.warn("[storefront] Falling back to mock fashion-2 brands due to error:", error);
    return loadMockBrands();
  }
};

export default {
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
