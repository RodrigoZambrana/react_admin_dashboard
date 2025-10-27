"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { IconShoppingCart, IconUser } from "@tabler/icons-react";

import Login from "@sections/auth/Login";

import Modal from "@component/modal/Modal";
import FlexBox from "@component/FlexBox";
import MiniCart from "@component/mini-cart";
import Container from "@component/Container";
import { Tiny } from "@component/Typography";
import { IconButton } from "@component/buttons";
import Sidenav from "@component/sidenav/Sidenav";
import { SearchInput } from "@component/search-box";
import useCart from "@hook/useCart";
import StyledHeader from "./styles";
import Logo from "./Logo";

// ========================================================================
type HeaderProps = { className?: string };
// ========================================================================

export default function HeaderTwo({ className }: HeaderProps) {
  const { state } = useCart();
  const [open, setOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);

  const handleOpenCart = useCallback(() => setOpen(true), []);
  const handleCloseCart = useCallback(() => setOpen(false), []);
  const handleOpenLogin = useCallback(() => setLoginOpen(true), []);
  const handleCloseLogin = useCallback(() => setLoginOpen(false), []);

  const CART_HANDLE = (
    <FlexBox ml="20px" alignItems="flex-start" onClick={handleOpenCart}>
      <IconButton bg="gray.200" p="12px" size="small" borderRadius={8}>
        <IconShoppingCart size={16} stroke={1.5} />
      </IconButton>

      {state.cart.length > 0 && (
        <FlexBox
          px="5px"
          py="2px"
          mt="-9px"
          ml="-1rem"
          bg="primary.main"
          alignItems="center"
          borderRadius="300px"
          justifyContent="center">
          <Tiny color="white" fontWeight="600">
            {state.cart.length}
          </Tiny>
        </FlexBox>
      )}
    </FlexBox>
  );

  return (
    <StyledHeader className={className}>
      <Container display="flex" alignItems="center" justifyContent="space-between" height="100%">
        <FlexBox className="logo" alignItems="center" mr="1rem">
          <Link href="/">
            <Logo />
          </Link>
        </FlexBox>

        <FlexBox justifyContent="center" flex="1 1 0">
          <SearchInput />
        </FlexBox>

        <FlexBox className="header-right" alignItems="center">
          <IconButton
            ml="1rem"
            p="12px"
            size="small"
            bg="gray.200"
            borderRadius={8}
            onClick={handleOpenLogin}>
            <IconUser size={16} stroke={1.5} />
          </IconButton>

          <Modal open={loginOpen} onClose={handleCloseLogin}>
            <div>
              <Login />
            </div>
          </Modal>

          <Sidenav
            open={open}
            width={380}
            position="right"
            handle={CART_HANDLE}
            onClose={handleCloseCart}>
            <MiniCart />
          </Sidenav>
        </FlexBox>
      </Container>
    </StyledHeader>
  );
}
