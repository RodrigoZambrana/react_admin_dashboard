// @ts-nocheck
"use client"

import { HeaderOne as Header } from "@components/header"
import { FooterOne as Footer } from "@components/footer"
import Breadcrumb from "@components/ui/breadcrumb"
import { ContentWrapperOne as ContentWrapper } from "@components/wrapper"
import ProductDetails from "@components/product-details"
import SocialShare from "@components/social-share"
import RelatedProducts from "@components/products/Related"
import { HomePagesNavData as navContent } from "@data/navbar"

const logo = "/assets/images/no-placeholder/logo.png"

const ProductClient = ({ product }) => {
  const { name, categories = [], tags = [] } = product
  const slug = `/products/${name.toLowerCase().split(" ").join("-")}`

  return (
    <>
      <Header logo={logo} navbar navData={navContent} navbarAlignment="left" />
      <ContentWrapper>
        <Breadcrumb />
        <ProductDetails product={product} />
        <SocialShare url={slug} content={name} />
        <RelatedProducts categories={categories} tags={tags} />
      </ContentWrapper>
      <Footer logo={logo} />
    </>
  )
}

export default ProductClient
