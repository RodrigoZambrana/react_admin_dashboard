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
