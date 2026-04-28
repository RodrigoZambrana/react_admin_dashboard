import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { buildStorefrontPageMetadata } from "@/lib/page-metadata";

type ProductsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata(): Promise<Metadata> {
  return buildStorefrontPageMetadata({
    title: "Productos",
    description: "La ruta de productos redirige al listado público de la tienda.",
    canonicalPath: "/shop",
    noIndex: true,
  });
}

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
