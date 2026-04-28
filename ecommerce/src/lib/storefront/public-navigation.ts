import type { NavigationConfig } from "@/types/storefront";

export const buildDefaultPublicNavigation = (): NavigationConfig => ({
  primary: [
    { id: "nav-home", label: "Inicio", href: "/" },
    { id: "nav-shop", label: "Tienda", href: "/shop" },
    { id: "nav-categories", label: "Categorías", href: "/categories" },
    { id: "nav-about", label: "Quiénes somos", href: "/quienes-somos" },
    { id: "nav-faq", label: "Preguntas frecuentes", href: "/preguntas-frecuentes" },
    { id: "nav-contact", label: "Contacto", href: "/contacto.html" }
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
    { id: "help-faq", label: "Preguntas frecuentes", href: "/preguntas-frecuentes" },
    { id: "help-support", label: "Contacto", href: "/contacto.html" }
  ]
});
