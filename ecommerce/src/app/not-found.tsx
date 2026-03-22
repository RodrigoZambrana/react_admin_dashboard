"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import Image from "@component/Image";
import FlexBox from "@component/FlexBox";
import { Button } from "@component/buttons";
import { useTranslation } from "@/state/i18n-context";

export default function NotFound() {
  const router = useRouter();
  const t = useTranslation();
  const handleGoBack = () => router.back();

  return (
    <FlexBox
      px="1rem"
      minHeight="100vh"
      alignItems="center"
      flexDirection="column"
      justifyContent="center">
      <Image
        src="/assets/images/illustrations/404.svg"
        alt={t("notFound.imageAlt", { defaultMessage: "Page not found" })}
        maxWidth="320px"
        width="100%"
        mb="2rem"
      />

      <FlexBox flexWrap="wrap">
        <Button variant="outlined" color="primary" m="0.5rem" onClick={handleGoBack}>
          {t("notFound.actions.back", { defaultMessage: "Go Back" })}
        </Button>

        <Link href="/">
          <Button variant="contained" color="primary" m="0.5rem">
            {t("notFound.actions.home", { defaultMessage: "Go to Home" })}
          </Button>
        </Link>
      </FlexBox>
    </FlexBox>
  );
}
