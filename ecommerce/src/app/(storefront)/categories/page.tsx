import { StorefrontApi, isApiError } from "@/lib/api/storefront";
import { flattenCategorySummaries } from "@/lib/storefront/adapters";

export const revalidate = 180;
export const dynamic = "force-static";

export const metadata = {
  title: "Categories · Storefront"
};

export default async function CategoriesPage() {
  try {
    const categories = await StorefrontApi.listCategories();
    const flattened = flattenCategorySummaries(categories);

    return (
      <main>
        {/* TODO: render Bonik category grid based on fetched data */}
        <section style={{ padding: "3rem 1.5rem" }}>
          <h1 style={{ fontSize: "2rem", fontWeight: 600, marginBottom: "0.5rem" }}>Categories</h1>
          <p style={{ color: "#475569" }}>Loaded {flattened.length} categories from the backend.</p>
        </section>
      </main>
    );
  } catch (error) {
    const message = isApiError(error)
      ? error.message || "Unable to load categories."
      : "Unexpected error loading categories.";

    return (
      <main>
        <section style={{ padding: "3rem 1.5rem" }}>
          <h1 style={{ fontSize: "2rem", fontWeight: 600, marginBottom: "0.5rem" }}>Categories</h1>
          <p style={{ color: "#b91c1c" }}>{message}</p>
        </section>
      </main>
    );
  }
}
