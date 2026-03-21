"use client";

import Image from "next/image";
import { useCallback } from "react";
import styled, { CSSProperties } from "styled-components";
import Rating from "../rating";
import Icon from "../icon/Icon";
import FlexBox from "../FlexBox";
import { Button } from "../buttons";
import ProductQuickActions from "./ProductQuickActions";
import useCart from "@hook/useCart";

// STYLED COMPONENT
const Wrapper = styled.div`
  border-radius: 8px;
  display: inline-block;
  transition: all 250ms ease-in-out;
  background-color: ${({ theme }) => theme.colors.body.default};

  &:hover {
    box-shadow: ${({ theme }) => theme.shadows.regular};
    .details {
      .add-cart {
        display: flex;
      }
    }
    .overlay-actions {
      opacity: 1;
      pointer-events: auto;
      transform: none;
    }
  }

  .image-holder {
    position: relative;
    text-align: center;
    display: inlin-block;

    .sale-chip {
      top: 0.625rem;
      left: 0.625rem;
      color: white;
      font-size: 13px;
      position: absolute;
      border-radius: 500px;
      display: inline-block;
      padding: 0.4rem 0.78rem;
      background: ${({ theme }) => theme.colors.primary.main};
    }
  }

  .details {
    padding: 1rem;

    h4 {
      margin: 0 0 0.5rem;
      color: ${({ theme }) => theme.colors.text.secondary};
    }

    .price {
      display: flex;
      margin-top: 0.5rem;
      font-weight: 600;

      h4 {
        margin: 0px;
        padding-right: 0.5rem;
        color: ${({ theme }) => theme.colors.primary.main};
      }
      del {
        color: ${({ theme }) => theme.colors.text.hint};
      }
    }

    .icon-holder {
      display: flex;
      align-items: flex-end;
      flex-direction: column;
      justify-content: space-between;
    }

    .favorite-icon {
      cursor: pointer;
    }
    .outlined-icon {
      svg path {
        fill: ${({ theme }) => theme.colors.text.hint};
      }
    }
    .add-cart {
      display: none;
      margin-top: auto;
      align-items: center;

      span {
        font-size: 15px;
        font-weight: 600;
        padding: 0px 0.5rem;
      }
    }
  }

  .overlay-actions {
    opacity: 0;
    pointer-events: none;
    transform: translateY(-4px);
    transition: opacity 0.2s ease, transform 0.2s ease;
  }

  @media (hover: none) {
    .overlay-actions {
      opacity: 1;
      pointer-events: auto;
      transform: none;
    }
  }
`;

// ========================================================
type ProductCard3Props = {
  className?: string;
  style?: CSSProperties;
};
// ========================================================

export default function ProductCard3({ ...props }: ProductCard3Props) {
  const product = {
    id: 1001,
    slug: "asus-rog-strix-g15",
    title: "ASUS ROG Strix G15",
    price: 445,
    images: ["/assets/images/products/macbook.png"]
  };

  const { state, dispatch } = useCart();
  const cartItem = state.cart.find((item) => item.id === product.id);
  const primaryImage = product.images[0];

  const handleAddToCart = useCallback(() => {
    const nextQty = (cartItem?.qty ?? 0) + 1;
    dispatch({
      type: "CHANGE_CART_AMOUNT",
      payload: {
        id: product.id,
        qty: nextQty,
        slug: product.slug,
        price: product.price,
        imgUrl: primaryImage,
        name: product.title
      }
    });
  }, [dispatch, cartItem?.qty, product.id, product.slug, product.price, product.title, primaryImage]);

  return (
    <Wrapper {...props}>
      <div className="image-holder">
        <div className="sale-chip">50% off</div>
        <Image
          src={product.images[0]}
          alt={product.title}
          width={300}
          height={300}
          style={{ width: "100%", height: "auto" }}
        />
      </div>

      <div className="details">
        <FlexBox justifyContent="space-between">
          <div>
            <h4>{product.title}</h4>
          </div>

          <div className="icon-holder">
            <ProductQuickActions
              compact
              className="overlay-actions"
              productId={product.id}
              productSlug={product.slug}
              productTitle={product.title}
              productPrice={product.price}
              productImages={product.images}
              productImage={product.images[0]}
              onAddToCart={handleAddToCart}
            />
          </div>
        </FlexBox>

        <FlexBox justifyContent="space-between">
          <div>
            <Rating
              outof={5}
              value={3.5}
              color="warn"
              onChange={(value) => console.log(value, "from rating")}
            />
            <div className="price">
              <h4>$445.00</h4>
              <del>$250</del>
            </div>
          </div>

          <div className="add-cart">
            <Button variant="outlined" color="primary" padding="5px">
              <Icon variant="small">minus</Icon>
            </Button>
            <span>45</span>
            <Button variant="outlined" color="primary" padding="5px">
              <Icon variant="small">plus</Icon>
            </Button>
          </div>
        </FlexBox>
      </div>
    </Wrapper>
  );
}
