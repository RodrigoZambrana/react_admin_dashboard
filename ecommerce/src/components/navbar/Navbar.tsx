"use client";

import { useTheme } from "styled-components";
import { IconCategoryFilled, IconChevronDown, IconChevronRight } from "@tabler/icons-react";

import Box from "../Box";
import Card from "../Card";
import Badge from "../badge";
import FlexBox from "../FlexBox";
import NavLink from "../nav-link";
import MenuItem from "../MenuItem";
import { Button } from "../buttons";
import Container from "../Container";
import Typography, { Span } from "../Typography";
import Categories from "../categories/Categories";

import StyledNavbar from "./styles";
import { useStorefrontNavigation, type StorefrontNavigationNode } from "@/hooks/useStorefrontNavigation";

// ==============================================================
type Nav = StorefrontNavigationNode;

type NavbarProps = { navListOpen?: boolean };
// ==============================================================

const NavItem = ({ nav, isRoot = false }: { nav: Nav; isRoot?: boolean }) => {
  const renderBadgeOrSpan = (title: string) =>
    nav.badge ? (
      <Badge style={{ marginRight: "0px" }} title={nav.badge}>
        {title}
      </Badge>
    ) : (
      <Span className="nav-link">{title}</Span>
    );

  const renderExternalLink = () => (
    <NavLink
      href={nav.url ?? "#"}
      key={nav.title}
      target="_blank"
      className="nav-link"
      rel="noopener noreferrer">
      {renderBadgeOrSpan(nav.title)}
    </NavLink>
  );

  const renderInternalLink = () => {
    const hrefValue = nav.url ?? "#";
    return (
      <NavLink className={isRoot ? "nav-link" : ""} href={hrefValue} key={nav.title}>
        {isRoot ? renderBadgeOrSpan(nav.title) : <MenuItem>{renderBadgeOrSpan(nav.title)}</MenuItem>}
      </NavLink>
    );
  };

  const renderNestedMenu = () => {
    if (isRoot) {
      return (
        <FlexBox
          className="root"
          position="relative"
          flexDirection="column"
          alignItems="center"
          key={nav.title}>
          {renderBadgeOrSpan(nav.title)}
          <div className="root-child">
            <Card borderRadius={8} mt="1.25rem" py="0.5rem" boxShadow="large" minWidth="230px">
              <NestedNav list={nav.child} />
            </Card>
          </div>
        </FlexBox>
      );
    }

    return (
      <Box className="parent" position="relative" minWidth="230px" key={nav.title}>
        <MenuItem color="gray.700" style={{ display: "flex", justifyContent: "space-between" }}>
          {renderBadgeOrSpan(nav.title)}
          <IconChevronRight stroke={1.5} size={16} />
        </MenuItem>

        <Box className="child" pl="0.5rem">
          <Card py="0.5rem" borderRadius={8} boxShadow="large" minWidth="230px">
            <NestedNav list={nav.child} />
          </Card>
        </Box>
      </Box>
    );
  };

  if (nav.url && nav.extLink) return renderExternalLink();
  if (nav.child) return renderNestedMenu();
  if (nav.url) return renderInternalLink();
  return null;
};

type NestedNavProps = {
  list?: Nav[];
  isRoot?: boolean;
};

const NestedNav = ({ list = [], isRoot = false }: NestedNavProps) => (
  <>
    {list.map((nav, index) => {
      const fallbackSegment = nav.url ?? `idx-${index}`;
      const navKey = `${nav.title}|${fallbackSegment}|${index}`;
      return <NavItem key={navKey} nav={nav} isRoot={isRoot} />;
    })}
  </>
);

const renderNestedNav = (list: Nav[], isRoot = false) => {
  return <NestedNav list={list} isRoot={isRoot} />;
};

export default function Navbar({ navListOpen }: NavbarProps) {
  const theme = useTheme();
  const { navItems, categoriesForMenu, categoryIcons } = useStorefrontNavigation();

  return (
    <StyledNavbar>
      <Container height="100%" display="flex" alignItems="center" justifyContent="space-between">
        <Categories
          open={navListOpen}
          categories={categoriesForMenu}
          icons={categoryIcons}
          handler={(handleOpen) => (
            <Button
              width="278px"
              variant="text"
              height="40px"
              bg="body.default"
              onClick={handleOpen}>
              <IconCategoryFilled
                key="category-icon"
                stroke={1.5}
                size={18}
                color={theme.colors.primary.main}
              />

              <Typography
                key="category-label"
                ml="10px"
                flex="1 1 0"
                fontWeight="600"
                textAlign="left"
                color="text.muted">
                Categories
              </Typography>

              <IconChevronDown
                key="category-chevron"
                className="dropdown-icon"
                size={18}
                stroke={1.5}
              />
            </Button>
          )}
        />

        <FlexBox style={{ gap: 32 }}>{renderNestedNav(navItems, true)}</FlexBox>
      </Container>
    </StyledNavbar>
  );
}
