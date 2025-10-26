import path from "path"
import { fileURLToPath } from "url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const nextConfig = {
  images: {
    unoptimized: true,
  },
  poweredByHeader: false,
  experimental: {
    typedRoutes: false,
  },
  sassOptions: {
    includePaths: [path.join(__dirname, "public/assets/scss")],
  },
  webpack: (config) => {
    config.module.rules.push({
      test: /\.svg$/i,
      issuer: { and: [/[\\/]?(js|ts|jsx|tsx)$/] },
      use: ["@svgr/webpack"],
    })
    return config
  },
}

export default nextConfig
