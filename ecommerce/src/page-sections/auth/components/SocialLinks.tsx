import { Fragment } from "react";
import { IconBrandFacebookFilled, IconBrandGoogleFilled } from "@tabler/icons-react";
import FlexBox from "@component/FlexBox";
import { Small } from "@component/Typography";

type SocialLinksProps = {
  onGoogleClick?: () => void;
  googleDisabled?: boolean;
  googleLoading?: boolean;
  googleEnabled?: boolean;
};

export default function SocialLinks({
  onGoogleClick,
  googleDisabled = false,
  googleLoading = false,
  googleEnabled = true
}: SocialLinksProps) {
  const isGoogleDisabled = googleDisabled || googleLoading || !googleEnabled;
  const facebookEnabled = false;

  const handleGoogleClick = () => {
    if (isGoogleDisabled) {
      return;
    }
    onGoogleClick?.();
  };

  const googleLabel = googleLoading
    ? "Signing in with Google..."
    : googleEnabled
    ? "Continue with Google"
    : "Google sign-in unavailable";

  return (
    <Fragment>
      {facebookEnabled ? (
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
      ) : null}

      <FlexBox
        mb="1.25rem"
        height="40px"
        color={isGoogleDisabled ? "text.primary" : "white"}
        bg={isGoogleDisabled ? "gray.300" : "#4285F4"}
        borderRadius={8}
        alignItems="center"
        justifyContent="center"
        role="button"
        tabIndex={isGoogleDisabled ? -1 : 0}
        aria-disabled={isGoogleDisabled}
        onClick={handleGoogleClick}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            handleGoogleClick();
          }
        }}
        style={{
          cursor: isGoogleDisabled ? "not-allowed" : "pointer",
          opacity: isGoogleDisabled ? 0.6 : 1
        }}>
        <IconBrandGoogleFilled size={16} stroke={1.5} />

        <Small fontWeight="600" ml="0.5rem">
          {googleLabel}
        </Small>
      </FlexBox>

      {!googleEnabled ? (
        <Small
          mt="-0.5rem"
          mb="1.25rem"
          display="block"
          color="gray.600"
          textAlign="center">
          Enable Google sign-in from Storefront settings to activate this option.
        </Small>
      ) : null}
    </Fragment>
  );
}
