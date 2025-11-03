import AddressDetailsClient from "../AddressDetailsClient";

interface AddressDetailsPageProps {
  params: Promise<{ id: string }>;
}

export default async function AccountAddressDetailsPage({ params }: AddressDetailsPageProps) {
  const { id } = await params;
  return <AddressDetailsClient addressId={id} />;
}
