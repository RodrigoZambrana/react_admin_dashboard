import type { NextConfig } from "next";
import path from "path";

const toRemotePattern = (value: string | undefined | null) => {
  if (!value) {
    return null;
  }

  try {
    const url = new URL(value);
    return {
      protocol: url.protocol.replace(":", "") as "http" | "https",
      hostname: url.hostname
    };
  } catch {
    return null;
  }
};

const toOrigin = (value: string | undefined | null) => {
  if (!value) {
    return null;
  }

  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
};

const remotePatterns = [
  toRemotePattern(process.env.NEXT_PUBLIC_STOREFRONT_API_URL),
  toRemotePattern(process.env.STOREFRONT_API_URL),
  toRemotePattern(process.env.NEXT_PUBLIC_SITE_URL),
  toRemotePattern(process.env.NEXT_PUBLIC_MEDIA_BASE_URL),
  { protocol: "https" as const, hostname: "cloudflare-ipfs.com" },
  { protocol: "https" as const, hostname: "res.cloudinary.com" },
  { protocol: "https" as const, hostname: "**.googleusercontent.com" },
  { protocol: "http" as const, hostname: "localhost" },
  { protocol: "https" as const, hostname: "localhost" },
  { protocol: "http" as const, hostname: "127.0.0.1" },
  { protocol: "https" as const, hostname: "127.0.0.1" }
].filter((pattern, index, list): pattern is { protocol: "http" | "https"; hostname: string } => {
  if (!pattern) {
    return false;
  }
  return list.findIndex(
    (candidate) =>
      candidate?.protocol === pattern.protocol &&
      candidate?.hostname === pattern.hostname
  ) === index;
});

const backendOrigin =
  toOrigin(process.env.STOREFRONT_API_URL) ??
  toOrigin(process.env.NEXT_PUBLIC_STOREFRONT_API_URL) ??
  "http://localhost:4000";

const legacyAssetRewrites = [
  {
    source: "/media/:path*",
    destination: `${backendOrigin}/media/:path*`
  },
  {
    source: "/uploads/:path*",
    destination: `${backendOrigin}/uploads/:path*`
  },
  {
    source: "/img/:path*",
    destination: `${backendOrigin}/uploads/cms/legacy-assets/img/:path*`
  },
  {
    source: "/css/:path*",
    destination: `${backendOrigin}/uploads/cms/legacy-assets/css/:path*`
  },
  {
    source: "/js/:path*",
    destination: `${backendOrigin}/uploads/cms/legacy-assets/js/:path*`
  },
  {
    source: "/lib/:path*",
    destination: `${backendOrigin}/uploads/cms/legacy-assets/lib/:path*`
  },
  {
    source: "/assets/css/:path*",
    destination: `${backendOrigin}/uploads/cms/legacy-assets/assets/css/:path*`
  },
  {
    source: "/assets/img/:path*",
    destination: `${backendOrigin}/uploads/cms/legacy-assets/assets/img/:path*`
  },
  {
    source: "/assets/js/:path*",
    destination: `${backendOrigin}/uploads/cms/legacy-assets/assets/js/:path*`
  },
  {
    source: "/assets/webfonts/:path*",
    destination: `${backendOrigin}/uploads/cms/legacy-assets/assets/webfonts/:path*`
  },
  {
    source: "/catalogo/assets/:path*",
    destination: `${backendOrigin}/uploads/cms/legacy-assets/catalogo/assets/:path*`
  },
  {
    source: "/construccion.urucortinas.com.uy/:path*",
    destination: `${backendOrigin}/uploads/cms/legacy-assets/construccion.urucortinas.com.uy/:path*`
  }
];

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: path.resolve(__dirname, ".."),
  compiler: {
    styledComponents: true
  },
  images: {
    remotePatterns
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Cross-Origin-Opener-Policy",
            value: "same-origin-allow-popups"
          }
        ]
      }
    ];
  },
  async rewrites() {
    return legacyAssetRewrites;
  },
  async redirects() {
    return [
      {
        source: "/articulos/dvh.html",
        destination: "/guias/dvh",
        permanent: true
      },
      {
        source: "/contact",
        destination: "/contacto",
        permanent: true
      },
      {
        source: "/contacto.html",
        destination: "/contacto",
        permanent: true
      }
    ];
  },
  webpack(config) {
    config.resolve = config.resolve ?? {};
    config.resolve.alias = config.resolve.alias ?? {};
    config.resolve.alias["@common"] = path.resolve(__dirname, "../src/common");
    return config;
  }
};

export default nextConfig;
