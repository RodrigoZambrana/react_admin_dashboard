import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = fileURLToPath(new URL(".", import.meta.url));

export default {
  test: {
    environment: "node",
    include: ["src/**/*.spec.ts", "src/**/*.spec.tsx"],
  },
  resolve: {
    alias: {
      "@": resolve(rootDir, "src"),
      "@component": resolve(rootDir, "src/components"),
      "@context": resolve(rootDir, "src/contexts"),
      "@data": resolve(rootDir, "src/data"),
      "@hook": resolve(rootDir, "src/hooks"),
      "@lib": resolve(rootDir, "src/lib"),
      "@models": resolve(rootDir, "src/models"),
      "@reducer": resolve(rootDir, "src/reducers"),
      "@sections": resolve(rootDir, "src/page-sections"),
      "@state": resolve(rootDir, "src/state"),
      "@utils": resolve(rootDir, "src/utils"),
      "@common": resolve(rootDir, "../src/common"),
    },
  },
};
