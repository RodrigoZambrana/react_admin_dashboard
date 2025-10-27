// @ts-nocheck
"use client"

import { useContext } from "react"
import { Container, Row, Col } from "react-bootstrap"
import { HeaderOne as Header } from "@components/header"
import { FooterOne as Footer } from "@components/footer"
import { ProductOne as ProductCard } from "@components/product"
import Breadcrumb from "@components/ui/breadcrumb"
import { ContentWrapperOne as ContentWrapper } from "@components/wrapper"
import { ProductsContext } from "@global/ProductsContext"
import { HomePagesNavData as navContent } from "@data/navbar"

const logo = "/assets/images/no-placeholder/logo.png"

const ShopClient = () => {
  const { products } = useContext(ProductsContext)

  return (
    <>
      <Header logo={logo} navbar navData={navContent} navbarAlignment="left" />
      <ContentWrapper>
        <Breadcrumb />
        <div className="container-indent">
          <Container className="container-fluid-custom-mobile-padding">
            <div className="tt-shop-top">
              <div className="tt-shop-info">
                <div className="tt-title">Shop</div>
                <div className="tt-description">Discover our curated collection of products.</div>
              </div>
            </div>
            <Row className="tt-product-listing tt-col-four">
              {products.map((product) => (
                <Col key={product.id} className="tt-col-item">
                  <ProductCard page="shop" product={product} showVariant className="product-nohover" />
                </Col>
              ))}
            </Row>
          </Container>
        </div>
      </ContentWrapper>
      <Footer logo={logo} newsletter />
    </>
  )
}

export default ShopClient
