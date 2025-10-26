// @ts-nocheck
"use client"

import { useContext } from "react"
import { HeaderOne as Header } from "@components/header"
import { SliderOne as Slider } from "@components/slider"
import { ServicesOne as Services } from "@components/services"
import { CategoriesOne as Categories } from "@components/categories"
import { ContentWrapperOne as ContentWrapper } from "@components/wrapper"
import { PromoBannerOne as PromoBanners } from "@components/promo-banners"
import { TendingProducts as Trending, BestSelling } from "@components/products"
import LatestBlog from "@components/blog"
import { FooterOne as Footer } from "@components/footer"
import sliderData from "@data/slider/home-one.json"
import { HomePagesNavData as navContent } from "@data/navbar"
import { ProductsContext } from "@global/ProductsContext"
import { getProductsBySkin } from "@utils/product"

interface HomeClientProps {
  blogs: Array<Record<string, unknown>>
}

const logo = "/assets/images/no-placeholder/logo.png"

export const HomeClient: React.FC<HomeClientProps> = ({ blogs }) => {
  const { products } = useContext(ProductsContext)
  const productsFashion = getProductsBySkin(products, "fashion")

  return (
    <>
      <Header logo={logo} navbar navData={navContent} navbarAlignment="left" dark={false} />
      <ContentWrapper>
        <Slider dots arrows data={sliderData} className="nomargin" />
        <Categories />
        <Trending products={productsFashion} />
        <PromoBanners />
        <BestSelling products={productsFashion} />
        <LatestBlog blogs={blogs} />
        <Services />
      </ContentWrapper>
      <Footer logo={logo} dark={false} newsletter />
    </>
  )
}

export default HomeClient
