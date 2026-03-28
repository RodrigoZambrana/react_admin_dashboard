import { Suspense } from "react";
import OrdersClient from "./OrdersClient";

export default function AccountOrdersPage() {
  return (
    <Suspense fallback={null}>
      <OrdersClient />
    </Suspense>
  );
}
