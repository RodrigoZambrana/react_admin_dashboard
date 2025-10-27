import OrderDetailClient from "./OrderDetailClient";

interface OrderDetailPageProps {
  params: { uuid: string };
}

export default function OrderDetailsPage({ params }: OrderDetailPageProps) {
  const identifier = decodeURIComponent(params.uuid);
  return <OrderDetailClient identifier={identifier} />;
}
