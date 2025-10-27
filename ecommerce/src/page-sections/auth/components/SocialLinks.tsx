import { Fragment } from "react";
import { IconBrandFacebookFilled, IconBrandGoogleFilled } from "@tabler/icons-react";
import FlexBox from "@component/FlexBox";
import { Small } from "@component/Typography";

export default function SocialLinks() {
  return (
    <Fragment>
      <FlexBox
        mb="0.75rem"
        height="40px"
        color="white"
        bg="#3B5998"
        borderRadius={8}
        alignItems="center"
        justifyContent="center"
        style={{ cursor: "pointer" }}>
        <IconBrandFacebookFilled size={16} stroke={1.5} />

        <Small fontWeight="600" ml="0.5rem">
          Continue with Facebook
        </Small>
      </FlexBox>

      <FlexBox
        mb="1.25rem"
        height="40px"
        color="white"
        bg="#4285F4"
        borderRadius={8}
        alignItems="center"
        justifyContent="center"
        style={{ cursor: "pointer" }}>
        <IconBrandGoogleFilled size={16} stroke={1.5} />

        <Small fontWeight="600" ml="0.5rem">
          Continue with Google
        </Small>
      </FlexBox>
    </Fragment>
  );
}
