import type { NavigationConfig } from "@/types/storefront";

export const buildDefaultPublicNavigation = (): NavigationConfig => ({
  primary: [
    { id: "nav-home", label: "Inicio", href: "/" },
    { id: "nav-shop", label: "Tienda", href: "/shop" },
    { id: "nav-categories", label: "Categorías", href: "/categories" },
    { id: "nav-contact", label: "Contacto", href: "/contact" }
  ],
  secondary: [
    { id: "nav-account", label: "Account", href: "/account" },
    { id: "nav-orders", label: "Order tracking", href: "/account/orders" }
  ],
  footer: [
    [
      { id: "footer-home", label: "Inicio", href: "/" },
      { id: "footer-shop", label: "Productos", href: "/shop" },
      { id: "footer-categories", label: "Categorías", href: "/categories" }
    ],
    [
      { id: "footer-account", label: "Mi cuenta", href: "/account" },
      { id: "footer-orders", label: "Pedidos", href: "/account/orders" },
      { id: "footer-contact", label: "Contacto", href: "/contact" }
    ]
  ],
  socials: [],
  helpLinks: [
    { id: "help-faq", label: "FAQ", href: "/contact" },
    { id: "help-support", label: "Need Help?", href: "/contact" }
  ]
});
