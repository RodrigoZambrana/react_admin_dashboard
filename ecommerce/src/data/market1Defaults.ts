import type Service from "@models/service.model";

export interface StorefrontHeroSlide {
  id: string;
  title: string;
  description: string;
  buttonText: string;
  href: string;
}

export const defaultMarket1HeroSlides: StorefrontHeroSlide[] = [
  {
    id: "hero-slide-catalog",
    title: "home.hero.slide1.title",
    description: "home.hero.slide1.description",
    buttonText: "home.hero.slide1.cta",
    href: "/shop"
  },
  {
    id: "hero-slide-advice",
    title: "home.hero.slide2.title",
    description: "home.hero.slide2.description",
    buttonText: "home.hero.slide2.cta",
    href: "/contact"
  }
];

export const defaultMarket1ServiceList: Service[] = [
  {
    id: "service-sales-advice",
    icon: "customer-service",
    title: "home.services.salesAdvice.title",
    description: "home.services.salesAdvice.description",
    href: "/contact"
  },
  {
    id: "service-published-catalog",
    icon: "category",
    title: "home.services.publishedCatalog.title",
    description: "home.services.publishedCatalog.description",
    href: "/shop"
  },
  {
    id: "service-custom-projects",
    icon: "shield",
    title: "home.services.customProjects.title",
    description: "home.services.customProjects.description"
  },
  {
    id: "service-support",
    icon: "customer-service",
    title: "home.services.support.title",
    description: "home.services.support.description",
    href: "/contact"
  }
];
