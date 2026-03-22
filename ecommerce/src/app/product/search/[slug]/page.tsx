import { redirect } from "next/navigation";

export default async function ProductSearchResult({
  params
}: {
  params: Promise<{ slug?: string }>;
}) {
  const { slug } = await params;
  const searchTerm = slug?.trim();
  const legacyCategorySlug = searchTerm?.match(/^(.*)-\d+$/)?.[1]?.trim();
  const destination = searchTerm
    ? legacyCategorySlug
      ? `/shop?category=${encodeURIComponent(legacyCategorySlug)}`
      : `/shop?query=${encodeURIComponent(searchTerm)}`
    : "/shop";

  redirect(destination);
}
