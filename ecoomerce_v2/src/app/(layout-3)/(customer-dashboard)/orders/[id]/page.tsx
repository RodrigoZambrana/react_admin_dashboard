import { IDParams } from "interfaces";

import OrderDetailClient from "./OrderDetailClient";

export default async function OrderDetailsPage({ params }: IDParams) {
  const { id } = await params;

  return <OrderDetailClient identifier={id} />;
}

