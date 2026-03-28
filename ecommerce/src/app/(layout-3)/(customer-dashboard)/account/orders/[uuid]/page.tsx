import { Suspense } from "react";
import OrderDetailClient from "./OrderDetailClient";

interface OrderDetailPageProps {
  params: Promise<{ uuid: string }>;
}

export default async function AccountOrderDetailPage({ params }: OrderDetailPageProps) {
  const { uuid } = await params;
  return (
    <Suspense fallback={null}>
      <OrderDetailClient identifier={uuid} />
    </Suspense>
  );
}
