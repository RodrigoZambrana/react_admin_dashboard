import { redirect } from "next/navigation";

interface Params {
  id: string;
}

export default async function LegacyPaymentMethodDetailPage({ params }: { params: Promise<Params> }) {
  const resolved = await params;
  redirect(`/account/payment-methods/${resolved.id}`);
}
