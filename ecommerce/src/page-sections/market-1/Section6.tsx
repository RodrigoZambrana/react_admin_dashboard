import CategoryProductShelf from "@component/category/CategoryProductShelf";

export default async function Section6() {
  return (
    <CategoryProductShelf
      title="Cortinas destacadas"
      seeMoreLink="/product/search/cortinas"
      defaultCategorySlug="cortinas"
      includeDescendantsOf={["cortinas"]}
      categoryFilter={(category) => category.slug.toLowerCase().includes("cortina")}
      pageSize={9}
      emptyStateText="Aún no hay productos para mostrar en esta categoría."
    />
  );
}
