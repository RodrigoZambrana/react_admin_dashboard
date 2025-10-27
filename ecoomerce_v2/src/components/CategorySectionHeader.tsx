"use client";

import Link from "next/link";
import { IconChevronRight } from "@tabler/icons-react";

import Icon from "./icon/Icon";
import FlexBox from "./FlexBox";
import { H2, SemiSpan } from "./Typography";

// ==============================================================
interface Props {
  title?: string;
  iconName?: string;
  seeMoreLink?: string;
}
// ==============================================================

export default function CategorySectionHeader({ title, iconName, seeMoreLink }: Props) {
  return (
    <FlexBox justifyContent="space-between" alignItems="center" mb="1.5rem">
      <FlexBox alignItems="center">
        {iconName && (
          <Icon mr="0.5rem" color="primary">
            {iconName}
          </Icon>
        )}

        <H2 fontWeight="bold" lineHeight="1">
          {title}
        </H2>
      </FlexBox>

      {seeMoreLink && (
        <Link href={seeMoreLink}>
          <FlexBox alignItems="center" ml="0.5rem" color="text.muted">
            <SemiSpan mr="0.5rem">View all</SemiSpan>
            <IconChevronRight size={16} stroke={1.5} />
          </FlexBox>
        </Link>
      )}
    </FlexBox>
  );
}
