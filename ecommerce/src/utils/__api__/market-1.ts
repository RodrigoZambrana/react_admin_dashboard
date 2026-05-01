import Brand from "@models/Brand.model";
import Category from "@models/category.model";
import MainCarouselItem from "@models/market-1.model";
import Product from "@models/product.model";
import Service from "@models/service.model";
import Shop from "@models/shop.model";
import { brands, categories, mainCarouselData, products, serviceList } from "@/__server__/__db__/market-1/data";
import shops from "@/__server__/__db__/shop/data";

const getByType = (type: string) => products.filter((item) => item.for.type === type);
const getBrandsByType = (type: string) => brands.filter((item) => item.for.type === type);

const getTopRatedProduct = async (): Promise<Product[]> => getByType("top-ratings");

const getTopRatedBrand = async (): Promise<Brand[]> => getBrandsByType("featured-brands");

const getNewArrivalList = async (): Promise<Product[]> => getByType("new-arrivals");

const getCarBrands = async (): Promise<Brand[]> => getBrandsByType("car-brands");

const getCarList = async (): Promise<Product[]> => getByType("cars");

const getMobileBrands = async (): Promise<Brand[]> => getBrandsByType("mobile-brands");

const getMobileShops = async (): Promise<Shop[]> => {
  const imageNames = ["herman miller", "otobi", "hatil", "steelcase"];
  return shops.slice(4, 8).map((item, index) => ({ ...item, thumbnail: imageNames[index] }));
};

const getMobileList = async (): Promise<Product[]> => getByType("mobile-phones");

const getOpticsBrands = async (): Promise<Brand[]> => getBrandsByType("optics-brands");

const getOpticsShops = async (): Promise<Shop[]> => {
  const imageNames = ["herman miller", "zeiss", "hatil", "steelcase"];
  return shops.slice(0, 4).map((item, index) => ({ ...item, thumbnail: imageNames[index] }));
};

const getOpticsList = async (): Promise<Product[]> => getByType("optics");

const getCategories = async (): Promise<Category[]> => {
  return categories.filter((category) => !category.parent || category.parent.length === 0);
};

const getMoreItems = async (): Promise<Product[]> =>
  getByType("more-products");

const getServiceList = async (): Promise<Service[]> => serviceList as Service[];

const getMainCarousel = async (): Promise<MainCarouselItem[]> => mainCarouselData as MainCarouselItem[];

const getTopCategories = async (): Promise<Category[]> => {
  return categories.filter((category) => !category.parent || category.parent.length === 0).slice(0, 6);
};

const getBigDiscountList = async (): Promise<Product[]> => {
  return getByType("big-discounts");
};

const getFlashDeals = async (): Promise<Product[]> => {
  return getByType("flash-deals");
};

const market1Api = {
  getCarList,
  getCarBrands,
  getMoreItems,
  getFlashDeals,
  getMobileList,
  getCategories,
  getOpticsList,
  getServiceList,
  getMobileShops,
  getOpticsShops,
  getMainCarousel,
  getMobileBrands,
  getOpticsBrands,
  getTopCategories,
  getTopRatedBrand,
  getNewArrivalList,
  getBigDiscountList,
  getTopRatedProduct,
};

export default market1Api;
