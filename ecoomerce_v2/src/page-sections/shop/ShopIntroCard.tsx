"use client";

import { IconMapPin, IconPhone } from "@tabler/icons-react";
import Box from "@component/Box";
import Rating from "@component/rating";
import Avatar from "@component/avatar";
import FlexBox from "@component/FlexBox";
import { Button } from "@component/buttons";
import { H3, SemiSpan, Small } from "@component/Typography";
import SocialLinks from "./SocialLinks";
import { ShopIntroWrapper } from "./styles";

export default function ShopIntroCard() {
  return (
    <ShopIntroWrapper mb="32px" pb="20px" overflow="hidden">
      <div className="cover-image" />

      <div className="shop-intro-content">
        <Avatar
          size={120}
          mr="37px"
          border="4px solid"
          borderColor="gray.100"
          src="/assets/images/faces/propic.png"
        />

        <div className="description-holder">
          <FlexBox
            mt="3px"
            mb="22px"
            flexWrap="wrap"
            alignItems="center"
            justifyContent="space-between">
            <Box
              my="8px"
              p="4px 16px"
              borderRadius="4px"
              bg="secondary.main"
              display="inline-block">
              <H3 fontWeight="600" color="gray.100">
                Scarlett Beauty
              </H3>
            </Box>

            <SocialLinks />
          </FlexBox>

          <FlexBox flexWrap="wrap" justifyContent="space-between" alignItems="center">
            <div>
              <FlexBox alignItems="center" mb="14px">
                <Rating color="warn" value={5} outof={5} readOnly />

                <Small color="text.muted" pl="0.75rem" display="block">
                  (45)
                </Small>
              </FlexBox>

              <FlexBox color="text.muted" mb="8px" maxWidth="270px">
                <IconMapPin size={28} />

                <SemiSpan color="text.muted" ml="12px">
                  845 N. Stonybrook Ave. Tonawanda, NY 14210, Denmark
                </SemiSpan>
              </FlexBox>

              <FlexBox color="text.muted" mb="8px" alignItems="center">
                <IconPhone size={18} />

                <SemiSpan color="text.muted" ml="12px">
                  (613) 343-9004
                </SemiSpan>
              </FlexBox>
            </div>

            <a href="mailto:scarletbeauty@xmail.com">
              <Button variant="outlined" color="primary" my="12px">
                Contact Vendor
              </Button>
            </a>
          </FlexBox>
        </div>
      </div>
    </ShopIntroWrapper>
  );
}
