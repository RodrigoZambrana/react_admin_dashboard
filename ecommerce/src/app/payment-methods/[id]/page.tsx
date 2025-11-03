import { redirect } from "next/navigation";

interface Params {
  id: string;
}

interface LegacyPaymentMethodParams {
  params: Promise<Params> | Params;
}

export default async function LegacyPaymentMethodDetailPage({ params }: LegacyPaymentMethodParams) {
  const resolved = await params;
  redirect(`/account/payment-methods/${resolved.id}`);
}
