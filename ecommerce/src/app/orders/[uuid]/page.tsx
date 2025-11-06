import { redirect } from "next/navigation";

interface Params {
  uuid: string;
}

export default async function LegacyOrderDetailPage({ params }: { params: Promise<Params> }) {
  const resolved = await params;
  redirect(`/account/orders/${resolved.uuid}`);
}
