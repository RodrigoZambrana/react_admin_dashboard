import { NextResponse } from "next/server";

export const dynamic = "force-static";

export function GET() {
  return NextResponse.json({ status: "ok" });
}

export function HEAD() {
  return new Response(null, { status: 204 });
}
