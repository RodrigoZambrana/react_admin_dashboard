import { redirect } from "next/navigation";

export default async function ProductSearchResult({
  params
}: {
  params: Promise<{ slug?: string }>;
}) {
  const { slug } = await params;
  const searchTerm = slug?.trim();
  const destination = searchTerm ? `/shop?query=${encodeURIComponent(searchTerm)}` : "/shop";

  redirect(destination);
}
