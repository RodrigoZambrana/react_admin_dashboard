// @ts-nocheck

import HomeClient from "./HomeClient"
import { getBlogPosts } from "@utils/blog"

export const metadata = {
  title: "Wokiee React Storefront",
  description: "Responsive multipurpose ecommerce storefront built on the Wokiee React template.",
}

export default async function HomePage() {
  const blogs = await getBlogPosts([
    "title",
    "excerpt",
    "date",
    "author",
    "thumb",
    "slug",
    "categories",
  ], 3)

  return <HomeClient blogs={blogs} />
}
