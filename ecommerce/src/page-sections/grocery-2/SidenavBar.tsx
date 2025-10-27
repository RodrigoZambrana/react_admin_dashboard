"use client";

import { memo } from "react";
import styled from "styled-components";

import Box from "@component/Box";
import Card from "@component/Card";
import Icon from "@component/icon/Icon";
import FlexBox from "@component/FlexBox";
import NavLink from "@component/nav-link";
import { SemiSpan } from "@component/Typography";
import { Accordion, AccordionHeader } from "@component/accordion";

import useScroll from "@hook/useScroll";
import { NavWithChild } from "interfaces";
import { CategoryItem } from "@models/categoryNavList.model";

// STYLED COMPONENT
const AccordionHeaderText = styled(FlexBox)(({ theme }) => ({
  flex: "1",
  gap: "0.75rem",
  "&:hover": {
    color: theme.colors.primary.main,
    "& + .caret-icon": { color: theme.colors.primary.main }
  }
}));

// ======================================================================================
interface Props {
  isFixedNave?: boolean;
  navList: CategoryItem[];
}

interface NavItemProps {
  item: NavWithChild;
  depth?: number;
}
// =======================================================================================

const NavItem = memo(({ item, depth = 0 }: NavItemProps) => {
  const marginLeft = `${depth}rem`;

  return (
    <NavLink href={item.href} color="gray.700">
      <SemiSpan ml={marginLeft} py="6px" color="inherit" display="block">
        {item.title}
      </SemiSpan>
      {item.child?.map((childItem) => (
        <NavItem key={childItem.title} item={childItem} depth={depth + 1} />
      ))}
    </NavLink>
  );
});

export default function SidenavBar({ isFixedNave, navList }: Props) {
  const { isFixed } = useScroll();

  return (
    <Card
      style={{
        borderRadius: 8,
        position: "relative",
        padding: "20px 20px 14px 24px",
        overflow: isFixedNave && isFixed ? "auto" : "unset"
      }}>
      {navList.map((item) => (
        <Box mb="0.5rem" key={item.title} color="gray.700">
          {item.child ? (
            <Accordion expanded>
              <AccordionHeader px="0px" py="6px" color="inherit" justifyContent="flex-start">
                <AccordionHeaderText>
                  <Icon variant="small" defaultColor="currentColor">
                    {item.icon}
                  </Icon>

                  <SemiSpan color="inherit" fontWeight="600" flex="1 1 0">
                    {item.title}
                  </SemiSpan>
                </AccordionHeaderText>
              </AccordionHeader>

              {item.child.map((childItem) => (
                <NavItem key={childItem.title} item={childItem as NavWithChild} />
              ))}
            </Accordion>
          ) : (
            <NavLink href={item.href} color="gray.700">
              <FlexBox py="6px" color="inherit">
                <Icon variant="small" mr="0.75rem">
                  {item.icon}
                </Icon>

                <SemiSpan color="inherit" fontWeight="600" mr="9px" flex="1 1 0">
                  {item.title}
                </SemiSpan>
              </FlexBox>
            </NavLink>
          )}
        </Box>
      ))}
    </Card>
  );
}
