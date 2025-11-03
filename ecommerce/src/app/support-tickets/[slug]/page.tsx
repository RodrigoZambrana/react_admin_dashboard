import { redirect } from "next/navigation";

interface Params {
  slug: string;
}

interface LegacyTicketParams {
  params: Promise<Params> | Params;
}

export default async function LegacySupportTicketDetailPage({ params }: LegacyTicketParams) {
  const resolved = await params;
  redirect(`/account/support-tickets/${resolved.slug}`);
}
