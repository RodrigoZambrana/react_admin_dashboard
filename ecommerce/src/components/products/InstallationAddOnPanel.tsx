"use client";

import Box from "@component/Box";
import Card from "@component/Card";
import { H3, H5, Paragraph, Small } from "@component/Typography";
import { useMoneyFormatter } from "@/hooks/useMoneyFormatter";
import { useTranslation } from "@/state/i18n-context";
import type { Money } from "@/types/storefront";

type Props = {
  installationAddOn?: {
    id: number;
    name: string;
    productCode?: string | null;
    shortDescription?: string | null;
    price: Money;
  } | null;
};

export default function InstallationAddOnPanel({ installationAddOn }: Props) {
  const t = useTranslation();
  const { formatMoney } = useMoneyFormatter();

  if (!installationAddOn) {
    return null;
  }

  return (
    <Box mb="3.75rem">
      <H3 mb="1.5rem">
        {t("product.installation.title", {
          defaultMessage: "Instalación sugerida"
        })}
      </H3>

      <Card p="1.5rem" border="1px solid" borderColor="gray.200">
        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
          <div className="space-y-1">
            <H5>{installationAddOn.name}</H5>
            {installationAddOn.productCode ? (
              <Small color="text.muted">{installationAddOn.productCode}</Small>
            ) : null}
            {installationAddOn.shortDescription ? (
              <Paragraph color="text.muted">
                {installationAddOn.shortDescription}
              </Paragraph>
            ) : (
              <Paragraph color="text.muted">
                {t("product.installation.defaultDescription", {
                  defaultMessage:
                    "Este servicio puede agregarse a la compra y se cotiza junto con el producto."
                })}
              </Paragraph>
            )}
          </div>

          <div className="text-left md:text-right">
            <Small color="text.muted">
              {t("product.installation.priceLabel", {
                defaultMessage: "Precio de referencia"
              })}
            </Small>
            <H5 color="primary.main">
              {formatMoney(installationAddOn.price)}
            </H5>
          </div>
        </div>
      </Card>
    </Box>
  );
}
