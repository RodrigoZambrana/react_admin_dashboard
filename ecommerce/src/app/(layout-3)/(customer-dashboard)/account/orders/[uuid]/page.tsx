import OrderDetailClient from "./OrderDetailClient";

interface OrderDetailPageProps {
  params: Promise<{ uuid: string }>;
}

export default async function AccountOrderDetailPage({ params }: OrderDetailPageProps) {
  const { uuid } = await params;
  return <OrderDetailClient identifier={uuid} />;
}
