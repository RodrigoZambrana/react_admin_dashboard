import { NextResponse, type NextRequest } from "next/server";

const internalStorefrontApiBaseUrl =
  process.env.STOREFRONT_API_URL ?? process.env.NEXT_PUBLIC_STOREFRONT_API_URL ?? null;

const shouldHandleCanonicalRedirect = (pathname: string) =>
  pathname.startsWith("/product/") || pathname.startsWith("/aberturas/");

const buildSeoResolveUrl = (request: NextRequest) => {
  const apiBaseUrl = internalStorefrontApiBaseUrl
    ? new URL("seo/resolve", `${internalStorefrontApiBaseUrl.replace(/\/+$/, "")}/`)
    : new URL("/api/storefront/seo/resolve", request.nextUrl.origin);
  apiBaseUrl.searchParams.set("path", request.nextUrl.pathname);
  apiBaseUrl.searchParams.set("locale", "es");
  return apiBaseUrl;
};

export async function middleware(request: NextRequest) {
  if (!shouldHandleCanonicalRedirect(request.nextUrl.pathname)) {
    return NextResponse.next();
  }

  try {
    const response = await fetch(buildSeoResolveUrl(request), {
      headers: {
        accept: "application/json",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      return NextResponse.next();
    }

    const document = (await response.json()) as { routePath?: string | null };
    const routePath = typeof document.routePath === "string" ? document.routePath.trim() : "";
    if (!routePath || routePath === request.nextUrl.pathname) {
      return NextResponse.next();
    }

    const target = new URL(routePath, request.nextUrl.origin);
    target.search = request.nextUrl.search;
    return NextResponse.redirect(target, 308);
  } catch {
    return NextResponse.next();
  }
}

export const config = {
  matcher: ["/product/:path*", "/aberturas/:path*"],
};
