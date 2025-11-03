"use server";

import { NextResponse } from "next/server";
import { loadStorefrontSnapshot } from "@/lib/snapshots/loaders";

export async function GET() {
  const record = await loadStorefrontSnapshot();

  if (!record) {
    return NextResponse.json({ message: "Snapshot unavailable." }, { status: 404 });
  }

  return NextResponse.json({
    snapshot: record.value,
    storedAt: record.storedAt,
  });
}
