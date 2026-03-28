import { Suspense } from "react";
import AddressClient from "./AddressClient";

export default function AccountAddressPage() {
  return (
    <Suspense fallback={null}>
      <AddressClient />
    </Suspense>
  );
}
