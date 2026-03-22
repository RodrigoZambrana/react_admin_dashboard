"use client";

import Container from "@component/Container";
import { H1, Paragraph } from "@component/Typography";
import { useTranslation } from "@/state/i18n-context";

type InfoPageProps = {
  titleKey: string;
  titleDefault: string;
  bodyKey?: string;
  bodyDefault?: string;
  bodyValues?: Record<string, string | number>;
  errorMessage?: string | null;
  errorDefault?: string;
};

export default function InfoPage({
  titleKey,
  titleDefault,
  bodyKey,
  bodyDefault,
  bodyValues,
  errorMessage,
  errorDefault,
}: InfoPageProps) {
  const t = useTranslation();

  return (
    <Container mt="3rem" mb="4rem">
      <H1 mb="0.75rem">{t(titleKey, { defaultMessage: titleDefault })}</H1>

      {errorMessage ? (
        <Paragraph color="error.main">
          {t(errorMessage, {
            defaultMessage: errorDefault ?? errorMessage,
          })}
        </Paragraph>
      ) : bodyKey ? (
        <Paragraph color="text.muted">
          {t(bodyKey, {
            defaultMessage: bodyDefault,
            values: bodyValues,
          })}
        </Paragraph>
      ) : null}
    </Container>
  );
}
