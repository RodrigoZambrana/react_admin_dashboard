"use client";

import { useCallback, useState } from "react";
import Box from "@component/Box";
import Chip from "@component/Chip";
import Icon from "@component/icon/Icon";
import FlexBox from "@component/FlexBox";
import { H5 } from "@component/Typography";
import shadows from "@utils/themeShadows";

// ==============================================================
interface Props {
  categories: {
    icon: string;
    title: string;
  }[];
}
// ==============================================================

export default function SaleCategory({ categories }: Props) {
  const [selected, setSelected] = useState(1);
  const handleCategoryClick = useCallback((category: number) => () => setSelected(category), []);

  return (
    <Box mb="2rem" overflow="hidden">
      <FlexBox m="-0.75rem" flexWrap="wrap">
        {categories.map((item, ind) => (
          <FlexBox
            key={ind}
            m="0.75rem"
            flex="1 1 0"
            height="175px"
            minWidth="200px"
            borderRadius="12px"
            border="1px solid"
            alignItems="center"
            position="relative"
            flexDirection="column"
            borderColor="gray.400"
            justifyContent="center"
            onClick={handleCategoryClick(ind)}
            bg={ind === selected ? "white" : "transparent"}
            style={{
              cursor: "pointer",
              transition: "all 250ms ease-in-out"
            }}>
            <Icon size="44px" color={ind === selected ? "primary" : "secondary"}>
              {item.icon}
            </Icon>

            <H5 color={ind === selected ? "primary.main" : "inherit"}>{item.title}</H5>

            <Chip
              top="1rem"
              right="1rem"
              p="5px 10px"
              fontSize="10px"
              fontWeight="600"
              position="absolute"
              color={ind === selected ? "white" : "inherit"}
              bg={ind === selected ? "primary.main" : "gray.300"}
              boxShadow={ind === selected ? shadows.badge : "inherit"}>
              Upto 40% off
            </Chip>
          </FlexBox>
        ))}
      </FlexBox>
    </Box>
  );
}
