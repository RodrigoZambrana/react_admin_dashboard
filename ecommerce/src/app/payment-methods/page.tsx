import { redirect } from "next/navigation";

export default function LegacyPaymentMethodsPage() {
  redirect("/account/payment-methods");
}
