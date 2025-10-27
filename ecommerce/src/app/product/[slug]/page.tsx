import { redirect } from "next/navigation"

interface LegacyProductProps {
  params: { slug: string }
}

export default function LegacyProductRedirect({ params }: LegacyProductProps) {
  redirect(`/products/${params.slug}`)
}
