import type { ReactElement } from "react";
import { Fragment } from "react";

import Box from "@component/Box";
import { Footer2 } from "@component/footer";
import SidenavContainer from "@component/SidenavContainer";
import SideNavbar from "@component/sidenav/SideNavbar";
import SideNavbar2 from "@component/sidenav/SideNavbar2";

import Fashion1Section1 from "@/page-sections/fashion-1/Section1";
import Fashion1Section2 from "@/page-sections/fashion-1/Section2";
import Fashion1Section3 from "@/page-sections/fashion-1/Section3";
import Fashion1Section4 from "@/page-sections/fashion-1/Section4";
import Fashion1Section5 from "@/page-sections/fashion-1/Section5";
import Fashion1Section6 from "@/page-sections/fashion-1/Section6";
import Fashion1Section7 from "@/page-sections/fashion-1/Section7";
import Fashion1Section8 from "@/page-sections/fashion-1/Section8";
import Fashion1Section9 from "@/page-sections/fashion-1/Section9";

import Fashion2Section1 from "@/page-sections/fashion-2/section-1";
import Fashion2Section2 from "@/page-sections/fashion-2/section-2";
import Fashion2Section3 from "@/page-sections/fashion-2/section-3";
import Fashion2Section4 from "@/page-sections/fashion-2/section-4";
import Fashion2Section5 from "@/page-sections/fashion-2/section-5";
import Fashion2Section6 from "@/page-sections/fashion-2/section-6";
import Fashion2Section7 from "@/page-sections/fashion-2/section-7";
import Fashion2Section8 from "@/page-sections/fashion-2/section-8";
import Fashion2Section9 from "@/page-sections/fashion-2/section-9";
import Fashion2Section10 from "@/page-sections/fashion-2/section-10";

import Fashion3Section1 from "@/page-sections/fashion-3/section-1";
import Fashion3Section2 from "@/page-sections/fashion-3/section-2";
import Fashion3Section3 from "@/page-sections/fashion-3/section-3";
import Fashion3Section4 from "@/page-sections/fashion-3/section-4";
import Fashion3Section5 from "@/page-sections/fashion-3/section-5";
import Fashion3Section6 from "@/page-sections/fashion-3/section-6";
import Fashion3Section7 from "@/page-sections/fashion-3/section-7";
import Fashion3Section8 from "@/page-sections/fashion-3/section-8";

import FurnitureContentBox from "@/page-sections/furniture-shop/ContentBox";
import FurnitureSection1 from "@/page-sections/furniture-shop/section-1";
import FurnitureSection3 from "@/page-sections/furniture-shop/section-3";
import FurnitureSection4 from "@/page-sections/furniture-shop/section-4";

import GadgetSection1 from "@/page-sections/gadget-shop/section-1";
import GadgetSection2 from "@/page-sections/gadget-shop/section-2";
import GadgetSection3 from "@/page-sections/gadget-shop/section-3";
import GadgetSection4 from "@/page-sections/gadget-shop/section-4";
import GadgetSection5 from "@/page-sections/gadget-shop/section-5";
import GadgetSection6 from "@/page-sections/gadget-shop/section-6";
import GadgetSection7 from "@/page-sections/gadget-shop/section-7";

import GiftContentBox from "@/page-sections/gift-shop/content-box";
import GiftSection1 from "@/page-sections/gift-shop/section-1";
import GiftSection2 from "@/page-sections/gift-shop/section-2";
import GiftSection3 from "@/page-sections/gift-shop/section-3";
import GiftSection4 from "@/page-sections/gift-shop/section-4";
import GiftSection5 from "@/page-sections/gift-shop/section-5";
import GiftSection6 from "@/page-sections/gift-shop/section-6";

import Grocery1Section1 from "@/page-sections/grocery-1/section-1";
import Grocery1Section2 from "@/page-sections/grocery-1/section-2";
import Grocery1Section3 from "@/page-sections/grocery-1/section-3";
import Grocery1Section4 from "@/page-sections/grocery-1/section-4";
import Grocery1Section5 from "@/page-sections/grocery-1/section-5";

import Grocery2Wrapper from "@/page-sections/grocery-2/Wrapper";
import Grocery2SidenavBar from "@/page-sections/grocery-2/SidenavBar";
import Grocery2Section1 from "@/page-sections/grocery-2/section-1";
import Grocery2Section2 from "@/page-sections/grocery-2/section-2";
import Grocery2Section3 from "@/page-sections/grocery-2/section-3";
import Grocery2Section4 from "@/page-sections/grocery-2/section-4";
import Grocery2Section5 from "@/page-sections/grocery-2/section-5";
import Grocery2Section6 from "@/page-sections/grocery-2/section-6";

import Grocery3Section1 from "@/page-sections/grocery-3/section-1";
import Grocery3Section2 from "@/page-sections/grocery-3/section-2";
import Grocery3Section3 from "@/page-sections/grocery-3/section-3";
import Grocery3Section4 from "@/page-sections/grocery-3/section-4";

import HealthBeautySection1 from "@/page-sections/health-beauty/section-1";
import HealthBeautySection2 from "@/page-sections/health-beauty/section-2";
import HealthBeautySection3 from "@/page-sections/health-beauty/section-3";
import HealthBeautySection4 from "@/page-sections/health-beauty/section-4";
import HealthBeautySection5 from "@/page-sections/health-beauty/section-5";

import LandingFooter from "@/page-sections/landing/footer";
import LandingHeader from "@/page-sections/landing/header";
import LandingSection1 from "@/page-sections/landing/Section1";
import LandingSection2 from "@/page-sections/landing/Section2";
import LandingSection3 from "@/page-sections/landing/Section3";
import LandingSection4 from "@/page-sections/landing/Section4";
import LandingSection5 from "@/page-sections/landing/Section5";

import Market1Section1 from "@/page-sections/market-1/Section1";
import Market1Section2 from "@/page-sections/market-1/Section2";
import Market1Section3 from "@/page-sections/market-1/Section3";
import Market1Section4 from "@/page-sections/market-1/Section4";
import Market1Section5 from "@/page-sections/market-1/Section5";
import Market1Section6 from "@/page-sections/market-1/Section6";
import Market1Section7 from "@/page-sections/market-1/Section7";
import Market1Section8 from "@/page-sections/market-1/Section8";
import Market1Section10 from "@/page-sections/market-1/Section10";
import Market1Section11 from "@/page-sections/market-1/Section11";
import Market1Section12 from "@/page-sections/market-1/Section12";
import Market1Section13 from "@/page-sections/market-1/Section13";

import Market2Section1 from "@/page-sections/market-2/section-1";
import Market2Section2 from "@/page-sections/market-2/section-2";
import Market2Section3 from "@/page-sections/market-2/section-3";
import Market2Section4 from "@/page-sections/market-2/section-4";
import Market2Section5 from "@/page-sections/market-2/section-5";
import Market2Section6 from "@/page-sections/market-2/section-6";
import Market2Section7 from "@/page-sections/market-2/section-7";
import Market2Section8 from "@/page-sections/market-2/section-8";
import Market2Section9 from "@/page-sections/market-2/section-9";
import Market2Section10 from "@/page-sections/market-2/section-10";

import ContainerBox from "@component/Container";
import apiFashion1 from "@/utils/__api__/fashion-1";
import apiFashion2 from "@/utils/__api__/fashion-2";
import apiFashion3 from "@/utils/__api__/fashion-3";
import apiFurniture from "@/utils/__api__/furniture";
import apiGadget from "@/utils/__api__/gadget";
import apiGift from "@/utils/__api__/gift";
import apiGrocery1 from "@/utils/__api__/grocery-1";
import apiGrocery2 from "@/utils/__api__/grocery-2";
import apiGrocery3 from "@/utils/__api__/grocery-3";
import apiHealthBeauty from "@/utils/__api__/health-beauty";
import apiMarket1 from "@/utils/__api__/market-1";
import apiMarket2 from "@/utils/__api__/market-2";
import { withMockTemplateRuntime } from "@/lib/mock-template-runtime";

export type MockTemplateHomeKey =
  | "landing"
  | "fashion-1"
  | "fashion-2"
  | "fashion-3"
  | "grocery-1"
  | "grocery-2"
  | "grocery-3"
  | "gadget-shop"
  | "gift-shop"
  | "furniture-shop"
  | "health-beauty"
  | "market-1"
  | "market-2";

type MockTemplateEntry = {
  key: MockTemplateHomeKey;
  title: string;
  description: string;
  render: () => Promise<ReactElement> | ReactElement;
};

const LandingTemplate = (): ReactElement => (
  <Box id="top" overflow="hidden" bg="gray.white">
    <LandingHeader />
    <LandingSection1 />
    <LandingSection2 />
    <LandingSection5 />
    <LandingSection3 />
    <LandingSection4 />
    <LandingFooter />
  </Box>
);

const FashionOneTemplate = async (): Promise<ReactElement> => {
  const [hotDealList, trendingItems, dealOfTheWeek] = await Promise.all([
    apiFashion1.getHotDealList(),
    apiFashion1.getTrendingItems(),
    apiFashion1.getDealOfTheWeekList(),
  ]);

  return (
    <ContainerBox my="2rem">
      <Fashion1Section1 />
      <Box mb="3.75rem">
        <Fashion1Section2 />
      </Box>
      <Fashion1Section3 />
      <Fashion1Section4 />
      <Fashion1Section5 list={dealOfTheWeek} />
      <Fashion1Section6 list={hotDealList} />
      <Fashion1Section7 products={trendingItems} />
      <Fashion1Section8 />
      <Fashion1Section9 />
    </ContainerBox>
  );
};

const FashionTwoTemplate = (): ReactElement => (
  <Box bg="white">
    <Fashion2Section1 />
    <Fashion2Section2 />
    <Fashion2Section3 />
    <Fashion2Section4 />
    <Fashion2Section5 />
    <Fashion2Section6 />
    <Fashion2Section7 />
    <Fashion2Section8 />
    <Fashion2Section9 />
    <Fashion2Section10 />
  </Box>
);

const FashionThreeTemplate = (): ReactElement => (
  <Box bg="white" pb="4rem">
    <Fashion3Section1 />
    <Fashion3Section2 />
    <Fashion3Section3 />
    <Fashion3Section4 />
    <Fashion3Section5 />
    <Fashion3Section6 />
    <Fashion3Section7 />
    <Fashion3Section8 />
  </Box>
);

const FurnitureShopTemplate = async (): Promise<ReactElement> => {
  const [topNewProducts, mainCarouselData, furnitureProducts, sidebarNavList, topSellingProducts] =
    await Promise.all([
      apiFurniture.getTopNewProducts(),
      apiFurniture.getMainCarouselData(),
      apiFurniture.getFurnitureProducts(),
      apiFurniture.getFurnitureShopNavList(),
      apiFurniture.getTopSellingProducts(),
    ]);

  return (
    <Fragment>
      <FurnitureSection1 mainCarouselData={mainCarouselData} />
      <ContainerBox>
        <FurnitureContentBox sidebarNavList={sidebarNavList} />
        <FurnitureSection3 products={topNewProducts} title="Top New Product" />
        <FurnitureSection3 products={topSellingProducts} title="Top Selling Product" />
        <FurnitureSection4 products={furnitureProducts} />
      </ContainerBox>
    </Fragment>
  );
};

const GadgetShopTemplate = async (): Promise<ReactElement> => {
  const [twoBanner, blogLists, topPickList, newArrivalsData, mostViewedList, mainCarouselData, featuredCategories] =
    await Promise.all([
      apiGadget.getTwoBanner(),
      apiGadget.getBlogLists(),
      apiGadget.getTopPicksList(),
      apiGadget.getNewArrival(),
      apiGadget.getMostViewedList(),
      apiGadget.getMainCarousel(),
      apiGadget.getFeaturedCategories(),
    ]);

  return (
    <Box my="2rem">
      <GadgetSection1 mainCarousel={mainCarouselData} topPickList={topPickList} />
      <GadgetSection2 categories={featuredCategories} />
      <GadgetSection3 bannerData={twoBanner} />
      <GadgetSection4 products={mostViewedList} />
      <GadgetSection5 products={newArrivalsData} />
      <GadgetSection6 />
      <GadgetSection7 blogs={blogLists} />
    </Box>
  );
};

const GiftShopTemplate = async (): Promise<ReactElement> => {
  const popularProducts = await apiGift.getPopularProducts();
  const topSailedProducts = await apiGift.getTopSailedProducts();
  const categoryNavigation = await apiGift.getCategoryNavigation();

  return (
    <Fragment>
      <GiftSection1 />
      <ContainerBox>
        <GiftContentBox categoryNavigation={categoryNavigation}>
          <GiftSection2 />
          <GiftSection3 />
          <GiftSection4 />
        </GiftContentBox>
        <GiftSection5 products={popularProducts} title="Popular Items" />
        <GiftSection5 products={topSailedProducts} title="Top Sale Items" />
        <GiftSection6 />
      </ContainerBox>
    </Fragment>
  );
};

const GroceryOneTemplate = async (): Promise<ReactElement> => {
  const [popularProducts, trendingProducts, grocery1NavList] = await Promise.all([
    apiGrocery1.getPopularProducts(),
    apiGrocery1.getTrendingProducts(),
    apiGrocery1.getGrocery1Navigation(),
  ]);

  return (
    <Fragment>
      <Grocery1Section1 />
      <Grocery1Section2 id="services-area" />
      <SidenavContainer navFixedComponentID="services-area" SideNav={<SideNavbar navList={grocery1NavList} />}>
        <Grocery1Section3 title="Popular Products" products={popularProducts} />
        <Grocery1Section3 title="Trending Products" products={trendingProducts} />
        <Grocery1Section4 />
        <Grocery1Section5 />
        <Footer2 />
      </SidenavContainer>
    </Fragment>
  );
};

const GroceryTwoTemplate = async (): Promise<ReactElement> => {
  const [dairyProducts, navigationList, featuredProducts, bestHomeProducts, bestSellProducts] =
    await Promise.all([
      apiGrocery2.getDairyProducts(),
      apiGrocery2.getNavigationList(),
      apiGrocery2.getFeaturedProducts(),
      apiGrocery2.getBestHomeProducts(),
      apiGrocery2.getBestSellProducts(),
    ]);

  return (
    <Grocery2Wrapper>
      <Box className="sidenav" pt="1.5rem">
        <Grocery2SidenavBar isFixedNave={true} navList={navigationList} />
      </Box>
      <Box className="content" pt="1.5rem">
        <Grocery2Section1 />
        <Box mb="3rem" overflow="hidden">
          <Grocery2Section2 />
        </Box>
        <Box mb="3rem">
          <Grocery2Section3 />
        </Box>
        <Box mb="3rem">
          <Grocery2Section4 title="Featured Items" products={featuredProducts} />
        </Box>
        <Box mb="3rem">
          <Grocery2Section4 title="Best Seller in Your Area" products={bestSellProducts} />
        </Box>
        <Box mb="3rem">
          <Grocery2Section5 />
        </Box>
        <Box mb="3rem">
          <Grocery2Section4 title="Best of Home Essentials" products={bestHomeProducts} />
        </Box>
        <Box mb="3rem">
          <Grocery2Section4 title="Snacks, Drinks, Dairy & More" products={dairyProducts} />
        </Box>
        <Box mb="3rem">
          <Grocery2Section6 />
        </Box>
        <Footer2 />
      </Box>
    </Grocery2Wrapper>
  );
};

const GroceryThreeTemplate = async (): Promise<ReactElement> => {
  const [offerCards, allProducts, mainCarouselData, topSailedProducts] = await Promise.all([
    apiGrocery3.getOfferCards(),
    apiGrocery3.getAllProducts(),
    apiGrocery3.getMainCarousel(),
    apiGrocery3.getTopSailedProducts(),
  ]);

  return (
    <Fragment>
      <Grocery3Section1 carouselData={mainCarouselData} />
      <ContainerBox>
        <Grocery3Section2 offerProducts={offerCards} />
        <Grocery3Section3 products={topSailedProducts} />
        <Grocery3Section4 products={allProducts} />
      </ContainerBox>
    </Fragment>
  );
};

const HealthBeautyTemplate = async (): Promise<ReactElement> => {
  const serviceList = await apiHealthBeauty.getServices();
  const allProducts = await apiHealthBeauty.getProducts();
  const navigationList = await apiHealthBeauty.getNavigation();
  const topNewProducts = await apiHealthBeauty.getTopNewProducts();
  const mainCarouselData = await apiHealthBeauty.getMainCarousel();

  return (
    <Fragment>
      <HealthBeautySection1 id="banner-area" carouselData={mainCarouselData} />
      <SidenavContainer navFixedComponentID="banner-area" SideNav={<SideNavbar2 navList={navigationList} />}>
        <Box mb="4rem">
          <HealthBeautySection2 />
        </Box>
        <HealthBeautySection3 title="Top New Products" products={topNewProducts} />
        <HealthBeautySection4 products={allProducts} />
        <HealthBeautySection5 services={serviceList as any} />
        <Footer2 />
      </SidenavContainer>
    </Fragment>
  );
};

const MarketOneTemplate = async (): Promise<ReactElement> => {
  const [
    carList,
    carBrands,
    mobileList,
    opticsList,
    mobileShops,
    opticsShops,
    mobileBrands,
    opticsBrands,
  ] = await Promise.all([
    apiMarket1.getCarList(),
    apiMarket1.getCarBrands(),
    apiMarket1.getMobileList(),
    apiMarket1.getOpticsList(),
    apiMarket1.getMobileShops(),
    apiMarket1.getOpticsShops(),
    apiMarket1.getMobileBrands(),
    apiMarket1.getOpticsBrands(),
  ]);

  return (
    <main>
      <Market1Section1 />
      <Market1Section2 />
      <Market1Section3 />
      <Market1Section4 />
      <Market1Section5 />
      <Market1Section13 />
      <Market1Section6 carBrands={carBrands} carList={carList} />
      <Market1Section7 shops={mobileShops} brands={mobileBrands} title="Mobile Phones" productList={mobileList} />
      <Market1Section8 />
      <Market1Section7 shops={opticsShops} brands={opticsBrands} title="Optics / Watch" productList={opticsList} />
      <Market1Section10 />
      <Market1Section11 />
      <Market1Section12 />
    </main>
  );
};

const MarketTwoTemplate = async (): Promise<ReactElement> => {
  const [brands, products, menFashionProducts, electronicsProducts, womenFashionProducts] =
    await Promise.all([
      apiMarket2.getBrands(),
      apiMarket2.getProducts(),
      apiMarket2.getMenFashionProducts(),
      apiMarket2.getElectronicsProducts(),
      apiMarket2.getWomenFashionProducts(),
    ]);

  return (
    <Box bg="#F6F6F6">
      <Market2Section1 />
      <Market2Section2 />
      <Market2Section3 />
      <Market2Section4 />
      <Market2Section5 />
      <Market2Section6 data={electronicsProducts} />
      <Market2Section7 />
      <Market2Section6 data={menFashionProducts} />
      <Market2Section8 />
      <Market2Section6 data={womenFashionProducts} />
      <Market2Section9 brands={brands as any} />
      <Market2Section10 products={products} />
    </Box>
  );
};

export const mockTemplateHomes: MockTemplateEntry[] = [
  {
    key: "landing",
    title: "Landing",
    description: "Template landing exact from the base system.",
    render: LandingTemplate,
  },
  {
    key: "fashion-1",
    title: "Fashion 1",
    description: "Exact fashion-1 home composition.",
    render: FashionOneTemplate,
  },
  {
    key: "fashion-2",
    title: "Fashion 2",
    description: "Exact fashion-2 home composition.",
    render: FashionTwoTemplate,
  },
  {
    key: "fashion-3",
    title: "Fashion 3",
    description: "Exact fashion-3 home composition.",
    render: FashionThreeTemplate,
  },
  {
    key: "grocery-1",
    title: "Grocery 1",
    description: "Exact grocery-1 home composition.",
    render: GroceryOneTemplate,
  },
  {
    key: "grocery-2",
    title: "Grocery 2",
    description: "Exact grocery-2 home composition.",
    render: GroceryTwoTemplate,
  },
  {
    key: "grocery-3",
    title: "Grocery 3",
    description: "Exact grocery-3 home composition.",
    render: GroceryThreeTemplate,
  },
  {
    key: "gadget-shop",
    title: "Gadget Shop",
    description: "Exact gadget-shop home composition.",
    render: GadgetShopTemplate,
  },
  {
    key: "gift-shop",
    title: "Gift Shop",
    description: "Exact gift-shop home composition.",
    render: GiftShopTemplate,
  },
  {
    key: "furniture-shop",
    title: "Furniture Shop",
    description: "Exact furniture-shop home composition.",
    render: FurnitureShopTemplate,
  },
  {
    key: "health-beauty",
    title: "Health Beauty",
    description: "Exact health-beauty home composition.",
    render: HealthBeautyTemplate,
  },
  {
    key: "market-1",
    title: "Market 1",
    description: "Exact market-1 home composition.",
    render: MarketOneTemplate,
  },
  {
    key: "market-2",
    title: "Market 2",
    description: "Exact market-2 home composition.",
    render: MarketTwoTemplate,
  },
];

export const listMockTemplateHomes = () => mockTemplateHomes;

export const getMockTemplateHome = (template: string) => {
  const normalized = template.trim().toLowerCase();
  const entry = mockTemplateHomes.find((item) => item.key === normalized);
  if (!entry) {
    throw new Error(`Unsupported mock template: ${template}`);
  }
  return entry;
};

export async function renderMockTemplateHome(template: string): Promise<ReactElement> {
  const entry = getMockTemplateHome(template);
  return withMockTemplateRuntime(() => entry.render());
}
