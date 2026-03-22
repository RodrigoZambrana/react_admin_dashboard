"use client";

import { useMemo } from "react";
import type { StorefrontNavigationNode } from "@/lib/storefront/menu-nodes";
import {
  mapStorefrontNavigationToAccordionNodes,
} from "@/lib/storefront/menu-nodes";
import AccordionMenu from "@component/mobile-navigation/AccordionMenu";

type MobileNavigationMenuProps = {
  items: StorefrontNavigationNode[];
  onNavigate: () => void;
};

export default function MobileNavigationMenu({
  items,
  onNavigate,
}: MobileNavigationMenuProps) {
  const accordionItems = useMemo(() => mapStorefrontNavigationToAccordionNodes(items), [items]);

  return (
    <AccordionMenu items={accordionItems} heading="Navegación" onNavigate={onNavigate} />
  );
}
