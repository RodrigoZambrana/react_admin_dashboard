import { Suspense } from "react";
import ProfileClient from "./ProfileClient";

export default function AccountProfilePage() {
  return (
    <Suspense fallback={null}>
      <ProfileClient />
    </Suspense>
  );
}
