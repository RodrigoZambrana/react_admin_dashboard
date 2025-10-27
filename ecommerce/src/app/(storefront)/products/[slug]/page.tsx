import { notFound } from "next/navigation"
import products from "@data/products/index.json"
import ProductClient from "./ProductClient"

interface ProductPageProps {
  params: { slug: string }
}

export function generateMetadata({ params }: ProductPageProps) {
  const product = products.find((item) => item.name.toLowerCase().split(" ").join("-") === params.slug)
  if (!product) {
    return { title: "Product Not Found" }
  }
  return { title: `${product.name} | Storefront` }
}

export default function ProductPage({ params }: ProductPageProps) {
  const product = products.find((item) => item.name.toLowerCase().split(" ").join("-") === params.slug)
  if (!product) {
    notFound()
  }
  return <ProductClient product={product} />
}
