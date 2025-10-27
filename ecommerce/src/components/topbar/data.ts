import type { SupportedLocale } from "@/translations";

export interface LanguageOption {
  id: string;
  title: string;
  shortLabel: string;
  locale: SupportedLocale;
  imgUrl: string;
}

export const LANGUAGES: LanguageOption[] = [
  {
    id: "es",
    locale: "es",
    title: "Español",
    shortLabel: "ES",
    imgUrl: "/assets/images/flags/es.svg"
  },
  {
    id: "en",
    locale: "en",
    title: "English",
    shortLabel: "EN",
    imgUrl: "/assets/images/flags/usa.png"
  }
];

export const CURRENCIES = [
  { id: 1, title: "USD", imgUrl: "/assets/images/flags/usa.png" },
  { id: 2, title: "EUR", imgUrl: "/assets/images/flags/uk.png" },
  { id: 3, title: "BDT", imgUrl: "/assets/images/flags/bd.png" },
  { id: 4, title: "INR", imgUrl: "/assets/images/flags/in.png" }
];
