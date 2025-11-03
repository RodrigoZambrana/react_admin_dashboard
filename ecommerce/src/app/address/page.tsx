import { redirect } from "next/navigation";

export default function LegacyAddressPage() {
  redirect("/account/address");
}
