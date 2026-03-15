import { defineConfig } from "vite";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(async ({ mode }) => {
  const plugins: any[] = [];

  try {
    const { default: react } = await import("@vitejs/plugin-react-swc");
    plugins.push(react());
  } catch {
    if (mode === "development") {
      console.warn("[vite] SWC plugin is unavailable. Starting without SWC.");
    }
  }

  if (mode === "development") {
    plugins.push(componentTagger());
  }

  return {
    server: {
      host: "::",
      port: 8080,
    },
    build: {
      outDir: path.resolve(__dirname, "../server/public_html"),
      emptyOutDir: true,
      minify: "esbuild",
      rollupOptions: {
        onwarn(warning, warn) {
          if (warning.code === "MODULE_LEVEL_DIRECTIVE") {
            return;
          }
          warn(warning);
        },
        output: {
          manualChunks(id) {
            if (!id.includes("node_modules")) return;

            if (id.includes("react") || id.includes("scheduler")) {
              return "vendor-react";
            }

            if (id.includes("react-router")) {
              return "vendor-router";
            }

            if (id.includes("socket.io-client")) {
              return "vendor-socket";
            }

            if (id.includes("@tanstack")) {
              return "vendor-query";
            }

            if (id.includes("@radix-ui")) {
              return "vendor-radix";
            }

            return "vendor-misc";
          },
        },
      },
    },
    esbuild: mode === "production" ? { drop: ["console", "debugger"] } : undefined,
    plugins,
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
