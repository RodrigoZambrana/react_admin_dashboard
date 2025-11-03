import type MainCarouselItem from "@models/market-1.model";
import type Service from "@models/service.model";

export const defaultMarket1MainCarousel: MainCarouselItem[] = [
  {
    title: "50% Off For Your First Shopping",
    imgUrl: "/assets/images/products/apple-watch-0.png",
    description:
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Quis lobortis consequat eu, quam etiam at quis ut convalliss.",
    buttonText: "Shop Now",
    buttonLik: "#"
  },
  {
    title: "50% Off For Your First Shopping",
    imgUrl: "/assets/images/products/apple-watch-0.png",
    description:
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Quis lobortis consequat eu, quam etiam at quis ut convalliss.",
    buttonText: "Shop Now",
    buttonLik: "#"
  }
];

export const defaultMarket1ServiceList: Service[] = [
  {
    id: "service-worldwide-delivery",
    icon: "truck",
    title: "Worldwide Delivery",
    description: null
  },
  {
    id: "service-safe-payment",
    icon: "credit",
    title: "Safe Payment",
    description: null
  },
  {
    id: "service-shop-with-confidence",
    icon: "shield",
    title: "Shop With Confidence",
    description: null
  },
  {
    id: "service-support",
    icon: "customer-service",
    title: "24/7 Support",
    description: null,
    href: "http://localhost:3000/account/register"
  }
];

export default {
  carousel: defaultMarket1MainCarousel,
  services: defaultMarket1ServiceList
};
