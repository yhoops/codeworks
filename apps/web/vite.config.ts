import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": {
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ""),
        target: process.env.CODEWORKS_API_ORIGIN ?? "http://127.0.0.1:3000"
      }
    }
  },
  test: {
    environment: "jsdom",
    environmentOptions: {
      jsdom: {
        url: "http://localhost/"
      }
    },
    include: ["src/**/*.{test,spec}.{ts,tsx}"]
  }
});
