import Product from "models/product.model";
import Service from "models/service.model";

import {
  dealOfTheWeekList,
  hotDealsData,
  products,
  serviceList,
} from "@/__server__/__db__/fashion-1/data";

const getProductsByType = (type: string): Product[] =>
  products.filter((item) => item.for.type === type);

const getFlashDeals = async (): Promise<Product[]> => getProductsByType("flash-deals");

const getNewArrivals = async (): Promise<Product[]> => getProductsByType("new-arrivals");

const getTrendingItems = async (): Promise<Product[]> => getProductsByType("trending-items");

const getServiceList = async (): Promise<Service[]> => serviceList as Service[];

const getDealOfTheWeekList = async () => dealOfTheWeekList;

const getHotDealList = async () => hotDealsData;

const fashion1Api = {
  getFlashDeals,
  getNewArrivals,
  getServiceList,
  getHotDealList,
  getTrendingItems,
  getDealOfTheWeekList,
};

export default fashion1Api;
