import { redirect } from "next/navigation";

const HOME_PATH = process.env.NEXT_PUBLIC_STOREFRONT_HOME_PATH || "/market-1";

export const metadata = {
  title: "Storefront",
  description: "Configurable ecommerce storefront powered by the Bonik UI."
};

export default function StorefrontHomePage() {
  redirect(HOME_PATH.startsWith("/") ? HOME_PATH : `/${HOME_PATH}`);
}
