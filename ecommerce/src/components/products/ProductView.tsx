"use client";

import { Fragment, useState } from "react";

import Box from "@component/Box";
import Shop from "@models/shop.model";
import FlexBox from "@component/FlexBox";
import { H6 } from "@component/Typography";
import AvailableShops from "@component/products/AvailableShops";
import RelatedProducts from "@component/products/RelatedProducts";
import FrequentlyBought from "@component/products/FrequentlyBought";
import ProductDescription from "@component/products/ProductDescription";
import ProductSpecifications from "@component/products/ProductSpecifications";
import Product from "@models/product.model";
import { useTranslation } from "@/state/i18n-context";

// ==============================================================
type Props = {
  shops: Shop[];
  relatedProducts: Product[];
  frequentlyBought: Product[];
  description?: string;
  descriptionHtml?: string;
  specifications?: Array<{ label: string; value: string }>;
};
// ==============================================================

export default function ProductView({
  shops,
  relatedProducts,
  frequentlyBought,
  description,
  descriptionHtml,
  specifications
}: Props) {
  const t = useTranslation();
  const [selectedOption, setSelectedOption] = useState("description");
  const showFrequentlyBoughtSection = false; // hide Frequently Bought Together section
  const showAvailableShopsSection = false; // hide Available Shops section
  const handleOptionClick = (opt: any) => () => setSelectedOption(opt);

  return (
    <Fragment>
      <FlexBox borderBottom="1px solid" borderColor="gray.400" mt="80px" mb="26px">
        <H6
          mr="25px"
          p="4px 10px"
          fontWeight={500}
          className="cursor-pointer"
          borderColor="primary.main"
          onClick={handleOptionClick("description")}
          borderBottom={selectedOption === "description" ? "2px solid" : ""}
          color={selectedOption === "description" ? "primary.main" : "text.muted"}>
          {t("product.tabs.description", { defaultMessage: "Description" })}
        </H6>

        <H6
          p="4px 10px"
          fontWeight={500}
          className="cursor-pointer"
          borderColor="primary.main"
          onClick={handleOptionClick("specifications")}
          borderBottom={selectedOption === "specifications" ? "2px solid" : ""}
          color={selectedOption === "specifications" ? "primary.main" : "text.muted"}>
          {t("product.tabs.specifications", { defaultMessage: "Specifications" })}
        </H6>
      </FlexBox>

      {/* DESCRIPTION AND SPECIFICATION TAB DETAILS */}
      <Box mb="50px">
        {selectedOption === "description" && (
          <ProductDescription description={description} descriptionHtml={descriptionHtml} />
        )}
        {selectedOption === "specifications" && (
          <ProductSpecifications specifications={specifications} />
        )}
      </Box>

      {/* FREQUENTLY BOUGHT TOGETHER PRODUCTS */}
      {showFrequentlyBoughtSection && frequentlyBought && (
        <FrequentlyBought products={frequentlyBought} />
      )}

      {/* AVAILABLE SHOPS */}
      {showAvailableShopsSection && shops && <AvailableShops shops={shops} />}

      {/* RELATED PRODUCTS */}
      {relatedProducts && <RelatedProducts products={relatedProducts} />}
    </Fragment>
  );
}
