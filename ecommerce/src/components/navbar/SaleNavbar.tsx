import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Icon from "@component/icon/Icon";
import FlexBox from "@component/FlexBox";
import { H5 } from "@component/Typography";
import { useTranslation } from "@/state/i18n-context";
import { ALL_CATEGORY_SLUG } from "@/lib/storefront/category-slugs";

// ===========================================================
interface SaleNavbarProps {
  categories: { icon: string; title: string; slug?: string }[];
  selectedSlug?: string;
}
// ===========================================================

export default function SaleNavbar({ categories, selectedSlug }: SaleNavbarProps) {
  const t = useTranslation();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [activeKey, setActiveKey] = useState<string>(selectedSlug ?? ALL_CATEGORY_SLUG);

  useEffect(() => {
    setActiveKey(selectedSlug ?? ALL_CATEGORY_SLUG);
  }, [selectedSlug]);

  const handleCategoryClick = useCallback(
    (categorySlug: string | undefined, fallbackKey: string) => () => {
      if (fallbackKey === activeKey) return;
      setActiveKey(fallbackKey);

      if (!pathname) return;

      const params = new URLSearchParams(searchParams?.toString() ?? "");
      if (categorySlug) {
        params.set("category", categorySlug);
      } else {
        params.delete("category");
      }
      params.delete("page");

      const query = params.toString();
      router.push(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [activeKey, pathname, router, searchParams]
  );

  return (
    <FlexBox bg="white" overflowX="auto" height="5rem">
      {categories.map((item, ind) => {
        const categoryKey = item.slug ?? `__fallback:${ind}`;
        const isSelected = activeKey === categoryKey;
        return (
          <FlexBox
            key={item.slug ?? `${item.title}-${ind}`}
            style={{ cursor: "pointer" }}
            minWidth="100px"
            alignItems="center"
            flexDirection="column"
            justifyContent="center"
            ml={ind === 0 ? "auto" : "unset"}
            onClick={handleCategoryClick(item.slug, categoryKey)}
            bg={isSelected ? "primary.light" : "transparent"}
            mr={ind === categories.length - 1 ? "auto" : "unset"}>
            <Icon size="1.75rem" color={isSelected ? "primary" : "secondary"}>
              {item.icon}
            </Icon>

            <H5
              fontSize="12px"
              textAlign="center"
              fontWeight={isSelected ? "600" : "400"}
              color={isSelected ? "primary.main" : "inherit"}>
              {t(item.title, { defaultMessage: item.title })}
            </H5>
          </FlexBox>
        );
      })}
    </FlexBox>
  );
}
