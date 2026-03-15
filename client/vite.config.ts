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
    console.warn("[vite] SWC plugin is unavailable. Starting without SWC.");
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
    },
    plugins,
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
