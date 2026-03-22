import { redirect } from "next/navigation";

export const metadata = {
  title: "Search · Storefront",
  description: "Search redirects to the public shop listing."
};

export default function SearchPage() {
  redirect("/shop");
}
