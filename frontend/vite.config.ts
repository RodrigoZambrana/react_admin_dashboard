import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import dynamicImport from "vite-plugin-dynamic-import";

const normalizePrefix = (value: string | undefined): string => {
  if (!value) {
    return "/";
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return "/";
  }

  const prefixed = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  return prefixed === "/" ? "/" : prefixed.replace(/\/+$/u, "");
};

const appPrefixPath = normalizePrefix(process.env.VITE_APP_PREFIX_PATH);
const buildBase = appPrefixPath === "/" ? "/" : `${appPrefixPath}/`;

// https://vitejs.dev/config/
export default defineConfig({
  base: buildBase,
  plugins: [
    react({
      babel: {
        plugins: ["babel-plugin-macros"],
      },
    }),
    dynamicImport(),
  ],
  assetsInclude: ["**/*.md"],
  envPrefix: ["VITE_", "CLIENT_"],
  resolve: {
    alias: {
      "@": path.join(__dirname, "src"),
      "@common": path.join(__dirname, "../src/common"),
      "apexcharts/dist/apexcharts.common": path.resolve(
        __dirname,
        "node_modules/apexcharts/dist/apexcharts.esm.js",
      ),
    },
  },
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:4000",
        changeOrigin: true,
      },
      "/uploads": {
        target: "http://localhost:4000",
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: "build",
  },
  optimizeDeps: {
    include: ["apexcharts"],
  },
});
