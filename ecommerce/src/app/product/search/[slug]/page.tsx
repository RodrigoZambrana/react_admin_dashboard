import { redirect } from "next/navigation";

type ProductSearchResultProps = {
  params: {
    slug?: string;
  };
};

export default function ProductSearchResult({ params }: ProductSearchResultProps) {
  const searchTerm = params.slug?.trim();
  const destination = searchTerm ? `/shop?query=${encodeURIComponent(searchTerm)}` : "/shop";

  redirect(destination);
}
