import { revalidatePath, revalidateTag } from "next/cache";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type RevalidatePayload = {
  secret?: string;
  paths?: string[];
  tags?: string[];
};

const normalizeItems = (items: unknown): string[] =>
  Array.isArray(items)
    ? Array.from(
        new Set(
          items
            .map((item) => (typeof item === "string" ? item.trim() : ""))
            .filter((item) => item.length > 0),
        ),
      )
    : [];

export async function POST(request: NextRequest) {
  const expectedSecret = process.env.NEXT_REVALIDATE_SECRET?.trim();
  const payload = (await request.json().catch(() => ({}))) as RevalidatePayload;
  const providedSecret =
    request.headers.get("x-revalidate-secret")?.trim() ?? payload.secret?.trim() ?? "";

  if (!expectedSecret || providedSecret !== expectedSecret) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const paths = normalizeItems(payload.paths);
  const tags = normalizeItems(payload.tags);

  for (const tag of tags) {
    revalidateTag(tag);
  }

  for (const path of paths) {
    revalidatePath(path);
  }

  return NextResponse.json({
    ok: true,
    revalidated: {
      paths,
      tags,
    },
  });
}
