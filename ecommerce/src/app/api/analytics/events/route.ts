import { NextRequest, NextResponse } from "next/server";

import { env } from "@/lib/env";

const forwardToBackend = async (payload: string, request: NextRequest) => {
  const endpoint = new URL("events", `${env.analyticsApiBaseUrl.replace(/\/?$/, "/")}`);
  return fetch(endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-correlation-id": request.headers.get("x-correlation-id") ?? "",
      "x-request-id": request.headers.get("x-request-id") ?? "",
    },
    body: payload,
    cache: "no-store",
  });
};

export async function POST(request: NextRequest) {
  const body = await request.text();
  if (!body.trim()) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  try {
    JSON.parse(body);
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const response = await forwardToBackend(body, request);
  const text = await response.text();

  return new NextResponse(text, {
    status: response.status,
    headers: {
      "content-type": response.headers.get("content-type") ?? "application/json",
    },
  });
}
