"use client";

import InfoPage from "@/components/storefront/InfoPage";

type Props = {
  total: number;
  errorMessage?: string | null;
};

export default function CategoriesPageClient({ total, errorMessage }: Props) {
  return (
    <InfoPage
      titleKey="categories.page.title"
      titleDefault="Categories"
      bodyKey="categories.page.loaded"
      bodyDefault="We loaded {count} categories from the storefront backend."
      bodyValues={{ count: total }}
      errorMessage={errorMessage}
      errorDefault="Unable to load categories."
    />
  );
}
