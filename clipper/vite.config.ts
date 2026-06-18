import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

const host = process.env.TAURI_DEV_HOST;

export default defineConfig(async () => ({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  clearScreen: false,
  build: {
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ["react", "react-dom"],
          motion: ["framer-motion"],
          hljs: ["highlight.js"],
          tauri: [
            "@tauri-apps/api",
            "@tauri-apps/plugin-clipboard-manager",
            "@tauri-apps/plugin-global-shortcut",
            "@tauri-apps/plugin-autostart",
            "@tauri-apps/plugin-dialog",
            "@tauri-apps/plugin-notification",
            "@tauri-apps/plugin-opener",
          ],
        },
      },
    },
  },
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? { protocol: "ws", host, port: 1421 }
      : undefined,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
}));
