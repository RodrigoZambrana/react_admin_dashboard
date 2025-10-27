import {
  IconUpload,
  IconSettings,
  IconShoppingCart,
  IconBuildingStore,
  IconLayoutDashboard
} from "@tabler/icons-react";

export const NAVIGATION_LINKS = [
  {
    href: "/vendor/dashboard",
    title: "Dashboard",
    Icon: IconLayoutDashboard
  },
  {
    href: "/vendor/products",
    title: "Products",
    Icon: IconBuildingStore,
    count: 300
  },
  {
    href: "/vendor/products/create",
    title: "Add New Product",
    Icon: IconUpload
  },
  {
    href: "/vendor/orders",
    title: "Orders",
    Icon: IconShoppingCart,
    count: 40
  },
  {
    href: "/vendor/account-settings",
    title: "Account Settings",
    Icon: IconSettings
  }
];
