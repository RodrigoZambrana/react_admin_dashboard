import { redirect } from "next/navigation";

export default function LegacyProfileEditPage() {
  redirect("/account/profile/edit");
}
