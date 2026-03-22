"use client";

import InfoPage from "@/components/storefront/InfoPage";

export default function ForgotPasswordPageClient() {
  return (
    <InfoPage
      titleKey="account.forgotPassword.title"
      titleDefault="Reset password"
      bodyKey="account.forgotPassword.body"
      bodyDefault="Customers will be able to request a password reset link from this page."
    />
  );
}
