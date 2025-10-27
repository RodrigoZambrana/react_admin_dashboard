"use client";

import { useCallback, useEffect, useState } from "react";
import { Link as Scroll } from "react-scroll";
import { IconMenu2 } from "@tabler/icons-react";
import debounce from "lodash/debounce";

import Box from "@component/Box";
import FlexBox from "@component/FlexBox";
import Container from "@component/Container";
import NextImage from "@component/NextImage";
import Sidenav from "@component/sidenav/Sidenav";
import { IconButton, Button } from "@component/buttons";
// STYLED COMPONENT
import { HeaderWrapper, SideNavWrapper } from "./styles";

import logo from "../../../../public/assets/images/logo.svg";

const HEADER_HEIGHT = 72;

const LINKS = [
  { id: 1, to: "features", label: "Features" },
  { id: 2, to: "demos", label: "Demos" },
  { id: 3, to: "technologies", label: "Technologies" }
];

export default function Header() {
  const [open, setOpen] = useState(false);
  const [isFixed, setFixed] = useState(false);

  const handleOpenSidenav = useCallback(() => setOpen(true), []);
  const handleCloseSidenav = useCallback(() => setOpen(false), []);

  const scrollListener = useCallback(
    debounce(() => {
      if (window.scrollY >= HEADER_HEIGHT) setFixed(true);
      else setFixed(false);
    }, 50),
    []
  );

  useEffect(() => {
    if (!window) return;

    scrollListener();
    window.addEventListener("scroll", scrollListener);
    return () => window.removeEventListener("scroll", scrollListener);
  }, []);

  return (
    <HeaderWrapper fixed={isFixed}>
      <Container>
        <FlexBox justifyContent="space-between" alignItems="center" height={HEADER_HEIGHT}>
          <Scroll to="top" duration={400} smooth={true} isDynamic>
            <Box cursor="pointer">
              <NextImage src={logo} alt="logo" />
            </Box>
          </Scroll>

          <FlexBox className="right-links" alignItems="center">
            {LINKS.map((item) => (
              <Scroll
                key={item.id}
                to={item.to}
                duration={400}
                offset={-HEADER_HEIGHT - 16}
                smooth={true}>
                <p className="link">{item.label}</p>
              </Scroll>
            ))}

            <a href="https://bonik-documentation.vercel.app/" target="_blank">
              <p className="link">Documentation</p>
            </a>

            <a href="https://1.envato.market/oeNbNe">
              <Button variant="outlined" color="secondary">
                Purchase Now
              </Button>
            </a>
          </FlexBox>

          {/* mobile menu */}
          <Sidenav
            width={260}
            open={open}
            position="right"
            onClose={handleCloseSidenav}
            handle={
              <IconButton className="menu" onClick={handleOpenSidenav}>
                <IconMenu2 size={20} />
              </IconButton>
            }>
            <SideNavWrapper>
              {LINKS.map((item) => (
                <Scroll
                  key={item.id}
                  to={item.to}
                  smooth={true}
                  duration={400}
                  offset={-HEADER_HEIGHT - 16}>
                  <p className="link" onClick={handleCloseSidenav}>
                    <span />
                    {item.label}
                  </p>
                </Scroll>
              ))}

              <a href="https://bonik-documentation.vercel.app/" target="_blank">
                <p className="link">
                  <span />
                  Documentation
                </p>
              </a>

              <Button className="purchase-button" variant="outlined" color="primary">
                Purchase Now
              </Button>
            </SideNavWrapper>
          </Sidenav>
        </FlexBox>
      </Container>
    </HeaderWrapper>
  );
}
