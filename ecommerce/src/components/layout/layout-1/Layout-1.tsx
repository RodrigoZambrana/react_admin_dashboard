"use client";

import { PropsWithChildren, ReactElement } from "react";
import Topbar from "@component/topbar";
import Sticky from "@component/sticky";
import { Header } from "@component/header";
import { Footer1 } from "@component/footer";
import MobileNavigationBar from "@component/mobile-navigation";
import { StyledRoot } from "./styles";

// ===============================================================================
interface Props {
  title?: string;
  navbar?: ReactElement;
}
// ===============================================================================

export default function ShopLayout({ navbar, children }: PropsWithChildren<Props>) {
  return (
    <StyledRoot>
      <Topbar />

      <Sticky fixedOn={0} scrollDistance={300}>
        <Header />
      </Sticky>

      {navbar ? (
        <>
          <div className="section-after-sticky">{navbar}</div>
          {children}
        </>
      ) : (
        <div className="section-after-sticky">{children}</div>
      )}

      <MobileNavigationBar />

      <Footer1 />
    </StyledRoot>
  );
}
