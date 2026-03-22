"use server";

import { NextRequest, NextResponse } from "next/server";

import { isSnapshotFallbackEnabled } from "@/lib/resilience-flags";
import { captureStorefrontSnapshot } from "@/lib/snapshots/capture";
import { loadStorefrontSnapshot } from "@/lib/snapshots/loaders";

const TOKEN_HEADER = "x-snapshot-token";

const isAuthorised = (request: NextRequest) => {
  const expected = process.env.SNAPSHOT_ACCESS_TOKEN;
  if (!expected) {
    return false;
  }
  const provided = request.headers.get(TOKEN_HEADER);
  return provided === expected;
};

export async function GET(request: NextRequest) {
  if (!isSnapshotFallbackEnabled()) {
    return NextResponse.json({ ok: false, message: "Not found." }, { status: 404 });
  }

  if (!isAuthorised(request)) {
    return NextResponse.json({ ok: false, message: "Unauthorised" }, { status: 403 });
  }

  const record = await loadStorefrontSnapshot();
  if (!record) {
    return NextResponse.json(
      { ok: false, message: "No snapshot available." },
      { status: 404 },
    );
  }
  return NextResponse.json({
    ok: true,
    storedAt: record.storedAt,
    snapshot: record.value,
  });
}

export async function POST(request: NextRequest) {
  if (!isSnapshotFallbackEnabled()) {
    return NextResponse.json({ ok: false, message: "Not found." }, { status: 404 });
  }

  if (!isAuthorised(request)) {
    return NextResponse.json({ ok: false, message: "Unauthorised" }, { status: 401 });
  }

  try {
    const snapshot = await captureStorefrontSnapshot();
    return NextResponse.json({
      ok: true,
      storedAt: snapshot.capturedAt,
      snapshot,
    });
  } catch (error) {
    console.error("[snapshot] Failed to capture storefront snapshot", error);
    return NextResponse.json(
      { ok: false, message: "Failed to capture snapshot" },
      { status: 500 },
    );
  }
}
