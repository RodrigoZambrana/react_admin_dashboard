import type { ProductListQuery } from "@/types/storefront";
import { StorefrontApi, isApiError } from "@/lib/api/storefront";

type ProductsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const parseQuery = (
  params: Record<string, string | string[] | undefined> | undefined
): ProductListQuery => {
  if (!params) {
    return { page: 1, pageSize: 12 };
  }

  const normalize = (value: string | string[] | undefined) =>
    Array.isArray(value) ? value[0] : value;

  const pageRaw = normalize(params.page);
  const pageSizeRaw = normalize(params.pageSize);

  const page = pageRaw ? Number.parseInt(pageRaw, 10) : 1;
  const pageSize = pageSizeRaw ? Number.parseInt(pageSizeRaw, 10) : 12;

  return {
    page: Number.isNaN(page) || page < 1 ? 1 : page,
    pageSize: Number.isNaN(pageSize) || pageSize < 1 ? 12 : Math.min(pageSize, 48),
    search: normalize(params.search) ?? undefined,
    categorySlug: normalize(params.category) ?? undefined,
    sort: normalize(params.sort) as ProductListQuery["sort"],
    tag: normalize(params.tag) ?? undefined
  };
};

export default async function ProductsPage({ searchParams }: ProductsPageProps) {
  const resolvedParams = searchParams ? await searchParams : undefined;
  const query = parseQuery(resolvedParams);

  try {
    const response = await StorefrontApi.listProducts(query);

    return (
      <main>
        {/* TODO: replace placeholder with Bonik storefront product listing */}
        <section style={{ padding: "3rem 1.5rem" }}>
          <header>
            <h1 style={{ fontSize: "2rem", fontWeight: 600, marginBottom: "0.5rem" }}>Products</h1>
            <p style={{ color: "#475569" }}>
              Showing {response.data.length} products (page {response.page} of {response.totalPages}).
            </p>
          </header>
        </section>
      </main>
    );
  } catch (error) {
    const message = isApiError(error)
      ? error.message || "Unable to load products."
      : "Unexpected error loading products.";

    return (
      <main>
        <section style={{ padding: "3rem 1.5rem" }}>
          <h1 style={{ fontSize: "2rem", fontWeight: 600, marginBottom: "0.5rem" }}>Products</h1>
          <p style={{ color: "#b91c1c" }}>{message}</p>
        </section>
      </main>
    );
  }
}
