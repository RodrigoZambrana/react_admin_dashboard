import { redirect } from "next/navigation";

interface Params {
  uuid: string;
}

interface LegacyOrderParams {
  params: Promise<Params> | Params;
}

export default async function LegacyOrderDetailPage({ params }: LegacyOrderParams) {
  const resolved = await params;
  redirect(`/account/orders/${resolved.uuid}`);
}
