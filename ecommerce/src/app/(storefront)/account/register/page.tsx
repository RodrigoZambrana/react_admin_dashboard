import { redirect } from "next/navigation";

export default function AccountRegisterPage() {
  redirect("/auth/register");
}
