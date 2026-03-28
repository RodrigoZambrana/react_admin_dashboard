import { Suspense } from "react";
import ProfileEditClient from "./ProfileEditClient";

export default function AccountProfileEditPage() {
  return (
    <Suspense fallback={null}>
      <ProfileEditClient />
    </Suspense>
  );
}
