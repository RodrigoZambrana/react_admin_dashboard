"use client";

import Box from "@component/Box";
import Card from "@component/Card";
import Modal from "@component/modal/Modal";
import Icon from "@component/icon/Icon";
import ProductIntro from "./ProductIntro";
import { IconButton } from "@component/buttons";

// ===================================================
type Props = {
  open: boolean;
  onClose: () => void;
  product: {
    slug: string;
    title: string;
    price: number;
    images: string[];
    id: string | number;
  };
};
// ===================================================

export default function ProductQuickView({ open, onClose, product }: Props) {
  return (
    <Modal open={open} onClose={onClose}>
      <Card p="1rem" width="100%" maxWidth="800px" borderRadius={8} position="relative">
        <ProductIntro
          id={product.id}
          title={product.title}
          price={product.price}
          images={product.images}
        />

        <IconButton
          onClick={onClose}
          style={{
            top: "0.5rem",
            right: "0.5rem",
            cursor: "pointer",
            padding: "0.5rem",
            position: "absolute"
          }}>
          <Icon className="close" color="primary" variant="small">
            close
          </Icon>
        </IconButton>
      </Card>
    </Modal>
  );
}
