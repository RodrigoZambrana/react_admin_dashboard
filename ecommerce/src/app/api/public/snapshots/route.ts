"use server";

import { NextResponse } from "next/server";
import { isSnapshotFallbackEnabled } from "@/lib/resilience-flags";
import { loadStorefrontSnapshot } from "@/lib/snapshots/loaders";

export async function GET() {
  if (!isSnapshotFallbackEnabled()) {
    return NextResponse.json({ message: "Not found." }, { status: 404 });
  }

  const record = await loadStorefrontSnapshot();

  if (!record) {
    return NextResponse.json({ message: "Snapshot unavailable." }, { status: 404 });
  }

  return NextResponse.json({
    snapshot: record.value,
    storedAt: record.storedAt,
  });
}
