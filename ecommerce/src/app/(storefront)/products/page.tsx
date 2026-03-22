import { redirect } from "next/navigation";

type ProductsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export const metadata = {
  title: "Products · Storefront",
  description: "Products redirect to the public shop listing."
};

const normalize = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

export default async function ProductsPage({ searchParams }: ProductsPageProps) {
  const params = searchParams ? await searchParams : undefined;
  const redirectParams = new URLSearchParams();

  const category = normalize(params?.category);
  const search = normalize(params?.search);
  const sort = normalize(params?.sort);
  const page = normalize(params?.page);
  const pageSize = normalize(params?.pageSize);
  const tag = normalize(params?.tag);

  if (category) redirectParams.set("category", category);
  if (search) redirectParams.set("query", search);
  if (sort) redirectParams.set("sort", sort);
  if (page) redirectParams.set("page", page);
  if (pageSize) redirectParams.set("pageSize", pageSize);
  if (tag) redirectParams.set("tag", tag);

  redirect(redirectParams.size > 0 ? `/shop?${redirectParams.toString()}` : "/shop");
}
