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

const remotePatterns = [
  toRemotePattern(process.env.NEXT_PUBLIC_STOREFRONT_API_URL),
  toRemotePattern(process.env.STOREFRONT_API_URL),
  toRemotePattern(process.env.NEXT_PUBLIC_SITE_URL),
  { protocol: "https" as const, hostname: "cloudflare-ipfs.com" },
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
  webpack(config) {
    config.resolve = config.resolve ?? {};
    config.resolve.alias = config.resolve.alias ?? {};
    config.resolve.alias["@common"] = path.resolve(__dirname, "../src/common");
    return config;
  }
};

export default nextConfig;
