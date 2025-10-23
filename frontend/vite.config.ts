import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import dynamicImport from 'vite-plugin-dynamic-import'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const resolvedClientSlug = env.VITE_CLIENT_SLUG || env.CLIENT_SLUG || "";

  return {
    define: {
      "import.meta.env.VITE_CLIENT_SLUG": JSON.stringify(resolvedClientSlug),
    },
    plugins: [react({
      babel: {
        plugins: [
          'babel-plugin-macros'
        ]
      }
    }),
    dynamicImport()],
    assetsInclude: ['**/*.md'],
    resolve: {
      alias: {
        '@': path.join(__dirname, 'src'),
        'apexcharts/dist/apexcharts.common': path.resolve(__dirname, 'node_modules/apexcharts/dist/apexcharts.esm.js'),
      },
    },
    server: {
      proxy: {
        '/api': {
          target: 'http://localhost:4000',
          changeOrigin: true,
          // if backend sits behind another path, add rewrite here
        },
        '/uploads': {
          target: 'http://localhost:4000',
          changeOrigin: true,
        },
      },
    },
    build: {
      outDir: 'build'
    },
    optimizeDeps: {
      include: ['apexcharts', 'react-apexcharts']
    }
  };
});
