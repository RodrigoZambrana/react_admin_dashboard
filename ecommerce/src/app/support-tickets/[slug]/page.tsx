import { redirect } from "next/navigation";

interface Params {
  slug: string;
}

export default async function LegacySupportTicketDetailPage({ params }: { params: Promise<Params> }) {
  const resolved = await params;
  redirect(`/account/support-tickets/${resolved.slug}`);
}
