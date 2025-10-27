import styled from "styled-components";

import Chip from "@component/Chip";
import Icon from "@component/icon/Icon";
import NavLink from "@component/nav-link";
import useCart from "@hook/useCart";
import useWindowSize from "@hook/useWindowSize";
import { layoutConstant } from "@utils/constants";

// STYLED COMPONENT
const Wrapper = styled.div`
  left: 0;
  right: 0;
  bottom: 0;
  display: none;
  position: fixed;
  align-items: center;
  justify-content: space-around;
  height: ${layoutConstant.mobileNavHeight};
  background: ${({ theme }) => theme.colors.body.paper};
  box-shadow: 0px 1px 4px 3px rgba(0, 0, 0, 0.1);
  z-index: 999;

  .link {
    flex: 1 1 0;
    display: flex;
    font-size: 13px;
    align-items: center;
    flex-direction: column;
    justify-content: center;
    position: relative;

    .icon {
      display: flex;
      margin-bottom: 4px;
      align-items: center;
      justify-content: center;
    }
  }

  .link-button {
    border: none;
    background: transparent;
    color: inherit;
    padding: 0;
  }

  @media (max-width: 900px) {
    display: flex;
    width: 100vw;
  }
`;

const HOME_PATH = process.env.NEXT_PUBLIC_STOREFRONT_HOME_PATH || "/market-1";

type MobileNavItem = {
  title: string;
  icon: string;
  href?: string;
  action?: string;
};

export default function MobileNavigationBar() {
  const { state } = useCart();
  const width = useWindowSize();

  const handleAction = (action: string) => () => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent(action));
    }
  };

  if (width <= 900) {
    return (
      <Wrapper>
        {list.map((item) => {
          const content = (
            <>
              <Icon className="icon" variant="small">
                {item.icon}
              </Icon>

              {item.title}

              {item.title === "Cart" && !!state.cart.length && (
                <Chip
                  top="4px"
                  px="0.25rem"
                  fontWeight="600"
                  bg="primary.main"
                  position="absolute"
                  color="primary.text"
                  left="calc(50% + 8px)">
                  {state.cart.length}
                </Chip>
              )}
            </>
          );

          if (item.action) {
            return (
              <button
                type="button"
                key={item.title}
                className="link link-button"
                onClick={handleAction(item.action)}>
                {content}
              </button>
            );
          }

          return (
            <NavLink className="link" href={item.href!} key={item.title}>
              {content}
            </NavLink>
          );
        })}
      </Wrapper>
    );
  }

  return null;
}

const list: MobileNavItem[] = [
  { title: "Menu", icon: "menu", action: "mobile-nav:open-menu" },
  {
    title: "Home",
    icon: "home",
    href: HOME_PATH.startsWith("/") ? HOME_PATH : `/${HOME_PATH}`
  },
  { title: "Categories", icon: "category", action: "mobile-nav:open-categories" },
  { title: "Cart", icon: "bag", action: "mobile-nav:open-cart" },
  { title: "Account", icon: "user-2", action: "mobile-nav:open-account" }
];
