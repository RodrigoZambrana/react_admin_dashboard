"use client";

import type { ElementType, HTMLAttributes } from "react";

import { useTranslation } from "@/state/i18n-context";

type TranslatedTextProps = HTMLAttributes<HTMLElement> & {
  as?: ElementType;
  translationKey: string;
  defaultMessage?: string;
  values?: Record<string, string | number>;
};

export default function TranslatedText({
  as,
  translationKey,
  defaultMessage,
  values,
  ...rest
}: TranslatedTextProps) {
  const t = useTranslation();
  const Component = as ?? "span";

  return (
    <Component {...rest}>
      {t(translationKey, { defaultMessage, values })}
    </Component>
  );
}
